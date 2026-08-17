import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/matches?league=IPL&limit=20
 * Returns recent matches with prediction results (for Opt-Weighted system).
 */
export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get('league') || 'IPL';
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

  const matches = await db.match.findMany({
    where: { leagueId },
    include: {
      teamA: true,
      teamB: true,
      predictions: { where: { system: { contains: 'Opt-Weighted' } } },
    },
    orderBy: { matchNo: 'asc' },
    take: limit,
  });

  const result = matches.map((m) => {
    const pred = m.predictions[0];
    return {
      id: m.id,
      matchNo: m.matchNo,
      date: m.date,
      note: m.note,
      teamA: { id: m.teamA.id, name: m.teamA.name, color: m.teamA.color, score: m.teamAScore, wkts: m.teamAWickets, overs: m.teamAOvers },
      teamB: { id: m.teamB.id, name: m.teamB.name, color: m.teamB.color, score: m.teamBScore, wkts: m.teamBWickets, overs: m.teamBOvers },
      winnerId: m.winnerId,
      winner: m.winnerId === m.teamAId ? m.teamA.name : m.teamB.name,
      prediction: pred ? { probA: pred.probA, correct: pred.correct } : null,
    };
  });

  return NextResponse.json({ matches: result, league: leagueId });
}
