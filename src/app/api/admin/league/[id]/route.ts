import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidationLeague } from '@/lib/constants';

/**
 * PATCH /api/admin/league/[id]
 * Updates an existing league's metadata and/or weights.
 *
 * Body (all fields optional):
 *   { name?, fullName?, country?, season?, weights? }
 *
 * If weights are provided, validates they sum to 1.0 (within tolerance).
 * Does NOT trigger a prediction recompute — weights only affect FUTURE
 * predictions (e.g. when a user calls /api/predict or adds a new match).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Lock: prevent editing validation leagues
    if (isValidationLeague(id)) {
      return NextResponse.json(
        { error: `League ${id} is locked (validation data). It cannot be edited.` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, fullName, country, season, weights } = body;

    const existing = await db.league.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `League ${id} not found` }, { status: 404 });
    }

    // Validate weights if provided
    let optimalWeights: string | undefined;
    if (weights) {
      const w = weights;
      const weightKeys = ['elo', 'rr', 'form', 'wpct', 'h2h', 'momentum'];
      for (const k of weightKeys) {
        if (typeof w[k] !== 'number' || w[k] < 0 || w[k] > 1) {
          return NextResponse.json({ error: `Weight ${k} must be a number 0-1` }, { status: 400 });
        }
      }
      const totalW = weightKeys.reduce((s, k) => s + w[k], 0);
      if (Math.abs(totalW - 1.0) > 0.05) {
        return NextResponse.json(
          { error: `Weights must sum to 1.0 (got ${totalW.toFixed(2)})` },
          { status: 400 }
        );
      }
      optimalWeights = JSON.stringify(w);
    }

    // Build update payload (only include fields that were provided)
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (fullName !== undefined) update.fullName = fullName;
    if (country !== undefined) update.country = country;
    if (season !== undefined) update.season = season;
    if (optimalWeights !== undefined) update.optimalWeights = optimalWeights;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.league.update({
      where: { id },
      data: update,
    });

    return NextResponse.json({
      ok: true,
      league: {
        id: updated.id,
        name: updated.name,
        fullName: updated.fullName,
        country: updated.country,
        season: updated.season,
        weights: updated.optimalWeights ? JSON.parse(updated.optimalWeights) : null,
      },
    });
  } catch (e: any) {
    console.error('Update league error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/league/[id]
 * Deletes a league and all its teams, matches, and predictions.
 * Use with caution — this is irreversible.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Lock: prevent deleting validation leagues
    if (isValidationLeague(id)) {
      return NextResponse.json(
        { error: `League ${id} is locked (validation data). It cannot be deleted.` },
        { status: 403 }
      );
    }

    const existing = await db.league.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `League ${id} not found` }, { status: 404 });
    }

    // Count what will be deleted (for the response message)
    const teamCount = await db.team.count({ where: { leagueId: id } });
    const matchCount = await db.match.count({ where: { leagueId: id } });
    const predCount = await db.prediction.count({ where: { match: { leagueId: id } } });

    // Cascade delete: predictions → matches → teams → league
    // Prisma doesn't auto-cascade for SQLite, so we do it manually.
    await db.prediction.deleteMany({ where: { match: { leagueId: id } } });
    await db.match.deleteMany({ where: { leagueId: id } });
    await db.team.deleteMany({ where: { leagueId: id } });
    await db.league.delete({ where: { id } });

    return NextResponse.json({
      ok: true,
      deleted: {
        leagueId: id,
        teams: teamCount,
        matches: matchCount,
        predictions: predCount,
      },
    });
  } catch (e: any) {
    console.error('Delete league error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
