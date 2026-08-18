import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * PATCH /api/admin/team/[id]
 * Updates an existing team's metadata (name, fullName, color, city).
 * Does NOT touch statistical fields (elo, matches, wins, etc.) — those are
 * managed by the walk-forward recompute when matches are added/deleted.
 *
 * Body (all optional):
 *   { name?, fullName?, color?, city? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, fullName, color, city } = body;

    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `Team ${id} not found` }, { status: 404 });
    }

    const update: any = {};
    if (name !== undefined) {
      if (!/^[A-Za-z0-9 ]{1,20}$/.test(name)) {
        return NextResponse.json(
          { error: 'Name must be 1-20 letters/numbers/spaces' },
          { status: 400 }
        );
      }
      update.name = name;
    }
    if (fullName !== undefined) update.fullName = fullName;
    if (city !== undefined) update.city = city?.trim() || null;
    if (color !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return NextResponse.json(
          { error: 'Color must be a hex code like #d32f2f' },
          { status: 400 }
        );
      }
      update.color = color;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.team.update({ where: { id }, data: update });

    return NextResponse.json({
      ok: true,
      team: {
        id: updated.id,
        name: updated.name,
        fullName: updated.fullName,
        color: updated.color,
        city: updated.city,
      },
    });
  } catch (e: any) {
    console.error('Update team error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/team/[id]
 * Deletes a team AND all matches it played in + those matches' predictions.
 * This is necessary because matches reference teams as foreign keys.
 *
 * Use with caution — irreversible. Returns counts of what was deleted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `Team ${id} not found` }, { status: 404 });
    }

    // Find all matches this team played in
    const matchesAsA = await db.match.findMany({
      where: { teamAId: id },
      select: { id: true },
    });
    const matchesAsB = await db.match.findMany({
      where: { teamBId: id },
      select: { id: true },
    });
    const matchIds = [...matchesAsA.map((m) => m.id), ...matchesAsB.map((m) => m.id)];

    // Count predictions for those matches
    const predCount = await db.prediction.count({
      where: { matchId: { in: matchIds } },
    });

    // Cascade delete: predictions → matches → team
    if (matchIds.length > 0) {
      await db.prediction.deleteMany({ where: { matchId: { in: matchIds } } });
      await db.match.deleteMany({ where: { id: { in: matchIds } } });
    }
    await db.team.delete({ where: { id } });

    return NextResponse.json({
      ok: true,
      deleted: {
        teamId: id,
        matches: matchIds.length,
        predictions: predCount,
      },
    });
  } catch (e: any) {
    console.error('Delete team error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
