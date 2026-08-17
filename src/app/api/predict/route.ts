import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  initTeamState, applyMatchResult, predictAllSystems, type TeamState,
} from '@/lib/prediction-engine';

/**
 * GET /api/predict?league=IPL&teamA=IPL_RCB&teamB=IPL_SRH
 * Predicts a hypothetical match between teamA and teamB in the given league,
 * using the LIVE team states (post-walk-forward through all completed matches).
 *
 * Returns all 6 prediction systems' probabilities.
 */
export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get('league') || 'IPL';
  const teamAId = req.nextUrl.searchParams.get('teamA');
  const teamBId = req.nextUrl.searchParams.get('teamB');

  if (!teamAId || !teamBId) {
    return NextResponse.json({ error: 'teamA and teamB query params required' }, { status: 400 });
  }
  if (teamAId === teamBId) {
    return NextResponse.json({ error: 'teamA and teamB must be different' }, { status: 400 });
  }

  const teamARow = await db.team.findUnique({ where: { id: teamAId } });
  const teamBRow = await db.team.findUnique({ where: { id: teamBId } });
  if (!teamARow || !teamBRow) {
    return NextResponse.json({ error: 'team not found' }, { status: 404 });
  }

  // Reconstruct TeamState from DB columns
  const stateA = hydrate(teamARow);
  const stateB = hydrate(teamBRow);

  const preds = predictAllSystems(stateA, stateB, leagueId);
  const winner = preds.find((p) => p.system.includes('Opt-Weighted')) || preds[0];
  const winnerName = winner.predictedWinner === 'A' ? teamARow.name : teamBRow.name;

  return NextResponse.json({
    league: leagueId,
    teamA: { id: teamARow.id, name: teamARow.name, fullName: teamARow.fullName, color: teamARow.color, elo: teamARow.elo },
    teamB: { id: teamBRow.id, name: teamBRow.name, fullName: teamBRow.fullName, color: teamBRow.color, elo: teamBRow.elo },
    predictions: preds,
    consensus: {
      winner: winnerName,
      winnerSide: winner.predictedWinner,
      probA: winner.probA,
      probB: 1 - winner.probA,
      confidence: winner.confidence,
    },
  });
}

function hydrate(row: any): TeamState {
  return {
    id: row.id,
    elo: row.elo,
    matches: row.matches,
    wins: row.wins,
    totalRunsScored: row.totalRunsScored,
    totalBallsFaced: row.totalBallsFaced,
    totalWicketsLost: row.totalWicketsLost,
    totalRunsConceded: row.totalRunsConceded,
    totalBallsBowled: row.totalBallsBowled,
    totalWicketsTaken: row.totalWicketsTaken,
    battingFirstMatches: row.battingFirstMatches,
    battingFirstWins: row.battingFirstWins,
    chasingMatches: row.chasingMatches,
    chasingWins: row.chasingWins,
    battingFirstTotalRuns: row.battingFirstTotalRuns,
    chasingTotalRuns: row.chasingTotalRuns,
    recentForm: row.recentForm ? JSON.parse(row.recentForm) : [],
    h2h: row.h2h ? JSON.parse(row.h2h) : {},
  };
}
