import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/admin/league
 * Creates a new league. Body:
 *   { id, name, fullName, country, season, weights: {elo, rr, form, wpct, h2h, momentum} }
 *
 * The weights are stored as JSON and used by the prediction engine for this league.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, fullName, country, season, weights } = body;

    if (!id || !name || !fullName || !country || !season) {
      return NextResponse.json(
        { error: 'Required: id, name, fullName, country, season' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await db.league.findUnique({ where: { id } });
    if (existing) {
      return NextResponse.json({ error: `League ${id} already exists` }, { status: 409 });
    }

    // Validate weights if provided
    const w = weights || { elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 };
    const weightKeys = ['elo', 'rr', 'form', 'wpct', 'h2h', 'momentum'];
    for (const k of weightKeys) {
      if (typeof w[k] !== 'number' || w[k] < 0 || w[k] > 1) {
        return NextResponse.json({ error: `Weight ${k} must be a number 0-1` }, { status: 400 });
      }
    }
    const totalW = weightKeys.reduce((s, k) => s + w[k], 0);
    if (Math.abs(totalW - 1.0) > 0.05) {
      return NextResponse.json(
        { error: `Weights should sum to 1.0 (got ${totalW.toFixed(2)}). Normalizing...` },
        { status: 400 }
      );
    }

    const league = await db.league.create({
      data: {
        id,
        name,
        fullName,
        country,
        season,
        optimalWeights: JSON.stringify(w),
        bestSystem: 'Optimized-Weighted',
        bestAccuracy: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      league: {
        id: league.id,
        name: league.name,
        fullName: league.fullName,
        country: league.country,
        season: league.season,
        weights: w,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
