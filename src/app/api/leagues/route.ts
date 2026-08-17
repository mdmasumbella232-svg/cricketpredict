import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const leagues = await db.league.findMany({
    include: { _count: { select: { teams: true, matches: true } } },
    orderBy: { id: 'asc' },
  });
  const result = leagues.map((l) => ({
    id: l.id, name: l.name, fullName: l.fullName, country: l.country, season: l.season,
    teamCount: l._count.teams, matchCount: l._count.matches,
    bestSystem: l.bestSystem, bestAccuracy: l.bestAccuracy,
    optimalWeights: l.optimalWeights ? JSON.parse(l.optimalWeights) : null,
  }));
  return NextResponse.json({ leagues: result });
}
