import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/system-comparison
 * Returns accuracy of each prediction system across all leagues.
 */
export async function GET() {
  const predictions = await db.prediction.findMany({
    include: { match: { select: { leagueId: true } } },
  });

  // Group by system -> league -> {correct, total}
  const bySystem: Record<string, Record<string, { correct: number; total: number }>> = {};
  for (const p of predictions) {
    const league = p.match.leagueId;
    if (!bySystem[p.system]) bySystem[p.system] = {};
    if (!bySystem[p.system][league]) bySystem[p.system][league] = { correct: 0, total: 0 };
    bySystem[p.system][league].total++;
    if (p.correct) bySystem[p.system][league].correct++;
  }

  const systems = Object.keys(bySystem).sort();
  const leagues = ['IPL', 'PSL', 'BBL', 'CPL'];

  const rows = systems.map((sys) => {
    const perLeague: Record<string, { accuracy: number; correct: number; total: number }> = {};
    let totalCorrect = 0;
    let totalCount = 0;
    for (const lg of leagues) {
      const r = bySystem[sys][lg];
      if (r) {
        perLeague[lg] = {
          accuracy: r.correct / r.total,
          correct: r.correct,
          total: r.total,
        };
        totalCorrect += r.correct;
        totalCount += r.total;
      } else {
        perLeague[lg] = { accuracy: 0, correct: 0, total: 0 };
      }
    }
    return {
      system: sys,
      perLeague,
      avg: totalCount > 0 ? totalCorrect / totalCount : 0,
      totalCorrect,
      totalCount,
    };
  });

  // Sort by avg accuracy desc
  rows.sort((a, b) => b.avg - a.avg);

  return NextResponse.json({ systems: rows, leagues });
}
