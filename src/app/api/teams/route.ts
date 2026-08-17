import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/teams?league=IPL
 * Returns teams for a given league, sorted by ELO descending.
 */
export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get('league') || 'IPL';

  const teams = await db.team.findMany({
    where: { leagueId },
    orderBy: { elo: 'desc' },
  });

  const result = teams.map((t) => {
    const batRr = t.totalBallsFaced > 0 ? t.totalRunsScored / (t.totalBallsFaced / 6) : 0;
    const bowlRr = t.totalBallsBowled > 0 ? t.totalRunsConceded / (t.totalBallsBowled / 6) : 0;
    const formArr: number[] = t.recentForm ? JSON.parse(t.recentForm) : [];
    const form5 = formArr.length > 0 ? formArr.reduce((a: number, b: number) => a + b, 0) / formArr.length : 0;
    const winPct = t.matches > 0 ? t.wins / t.matches : 0;
    const bfWinPct = t.battingFirstMatches > 0 ? t.battingFirstWins / t.battingFirstMatches : 0;
    const chWinPct = t.chasingMatches > 0 ? t.chasingWins / t.chasingMatches : 0;
    return {
      id: t.id,
      name: t.name,
      fullName: t.fullName,
      city: t.city,
      color: t.color,
      elo: t.elo,
      matches: t.matches,
      wins: t.wins,
      winPct,
      batRunRate: batRr,
      bowlRunRate: bowlRr,
      form5,
      battingFirstWinPct: bfWinPct,
      chasingWinPct: chWinPct,
    };
  });

  return NextResponse.json({ teams: result, league: leagueId });
}
