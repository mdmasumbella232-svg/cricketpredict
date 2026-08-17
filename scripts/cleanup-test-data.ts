import { db } from '../src/lib/db';
import { initTeamState, applyMatchResult, predictAllSystems, type TeamState } from '../src/lib/prediction-engine';

async function main() {
  // Delete test match #75 from IPL
  const testMatch = await db.match.findFirst({ where: { leagueId: 'IPL', matchNo: 75 } });
  if (testMatch) {
    await db.prediction.deleteMany({ where: { matchId: testMatch.id } });
    await db.match.delete({ where: { id: testMatch.id } });
    console.log('Deleted test match #75');
  } else {
    console.log('No test match #75 found');
  }

  // Delete BPL league if exists
  try {
    await db.league.delete({ where: { id: 'BPL' } });
    console.log('Deleted BPL league');
  } catch {
    console.log('BPL not found');
  }

  // Recompute IPL
  await db.prediction.deleteMany({ where: { match: { leagueId: 'IPL' } } });
  const teams = await db.team.findMany({ where: { leagueId: 'IPL' } });
  const states: Record<string, TeamState> = {};
  for (const t of teams) states[t.id] = initTeamState(t.id);
  const allMatches = await db.match.findMany({ where: { leagueId: 'IPL' }, orderBy: { matchNo: 'asc' } });
  let predCount = 0;
  for (const m of allMatches) {
    const aState = states[m.teamAId];
    const bState = states[m.teamBId];
    if (!aState || !bState) continue;
    if (aState.matches > 0 || bState.matches > 0) {
      const preds = predictAllSystems(aState, bState, 'IPL');
      const mAWon = m.winnerId === m.teamAId;
      for (const p of preds) {
        await db.prediction.create({
          data: { matchId: m.id, teamAId: m.teamAId, teamBId: m.teamBId, system: p.system, probA: p.probA, correct: (p.probA > 0.5) === mAWon }
        });
        predCount++;
      }
    }
    applyMatchResult(states, {
      matchNo: m.matchNo, date: m.date, teamAId: m.teamAId, teamAScore: m.teamAScore, teamAWickets: m.teamAWickets, teamAOvers: m.teamAOvers,
      teamBId: m.teamBId, teamBScore: m.teamBScore, teamBWickets: m.teamBWickets, teamBOvers: m.teamBOvers,
      winnerId: m.winnerId, battingFirstId: m.battingFirstId || m.teamAId, note: m.note || undefined,
    });
  }
  for (const t of teams) {
    const s = states[t.id];
    await db.team.update({
      where: { id: t.id },
      data: {
        elo: s.elo, matches: s.matches, wins: s.wins,
        totalRunsScored: s.totalRunsScored, totalBallsFaced: s.totalBallsFaced,
        totalWicketsLost: s.totalWicketsLost, totalRunsConceded: s.totalRunsConceded,
        totalBallsBowled: s.totalBallsBowled, totalWicketsTaken: s.totalWicketsTaken,
        battingFirstMatches: s.battingFirstMatches, battingFirstWins: s.battingFirstWins,
        chasingMatches: s.chasingMatches, chasingWins: s.chasingWins,
        battingFirstTotalRuns: s.battingFirstTotalRuns, chasingTotalRuns: s.chasingTotalRuns,
        recentForm: JSON.stringify(s.recentForm), h2h: JSON.stringify(s.h2h),
      },
    });
  }
  // Update league best
  const allPreds = await db.prediction.findMany({ where: { match: { leagueId: 'IPL' } } });
  const bySys: Record<string, { c: number; t: number }> = {};
  for (const p of allPreds) {
    if (!bySys[p.system]) bySys[p.system] = { c: 0, t: 0 };
    bySys[p.system].t++;
    if (p.correct) bySys[p.system].c++;
  }
  let bestSys = 'Optimized-Weighted'; let bestAcc = 0;
  for (const [s, r] of Object.entries(bySys)) {
    const acc = r.t > 0 ? r.c / r.t : 0;
    if (acc > bestAcc) { bestAcc = acc; bestSys = s; }
  }
  await db.league.update({ where: { id: 'IPL' }, data: { bestSystem: bestSys, bestAccuracy: bestAcc } });
  console.log(`IPL recomputed: ${predCount} predictions, best=${bestSys} (${(bestAcc*100).toFixed(1)}%)`);
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
