import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  initTeamState, applyMatchResult, predictAllSystems, type TeamState,
} from '@/lib/prediction-engine';

/**
 * Recompute walk-forward predictions and team states for a league.
 * Used by both POST (add) and DELETE (remove) handlers.
 */
async function recomputeLeague(leagueId: string) {
  // Delete all existing predictions
  await db.prediction.deleteMany({ where: { match: { leagueId } } });

  // Reset team states
  const teams = await db.team.findMany({ where: { leagueId } });
  const states: Record<string, TeamState> = {};
  for (const t of teams) states[t.id] = initTeamState(t.id);

  // Walk through all matches in order
  const allMatches = await db.match.findMany({
    where: { leagueId },
    orderBy: { matchNo: 'asc' },
  });

  let predCount = 0;
  for (const m of allMatches) {
    const aState = states[m.teamAId];
    const bState = states[m.teamBId];
    if (!aState || !bState) continue;

    // Generate predictions BEFORE applying this match's result.
    // Even for the first match (both teams at 0 history), we generate a 0.5
    // prediction — this matches the original Python backtest behavior.
    const preds = predictAllSystems(aState, bState, leagueId);
    const mAWon = m.winnerId === m.teamAId;
    for (const p of preds) {
      await db.prediction.create({
        data: {
          matchId: m.id, teamAId: m.teamAId, teamBId: m.teamBId,
          system: p.system, probA: p.probA, correct: (p.probA > 0.5) === mAWon,
        },
      });
      predCount++;
    }

    applyMatchResult(states, {
      matchNo: m.matchNo, date: m.date,
      teamAId: m.teamAId, teamAScore: m.teamAScore, teamAWickets: m.teamAWickets, teamAOvers: m.teamAOvers,
      teamBId: m.teamBId, teamBScore: m.teamBScore, teamBWickets: m.teamBWickets, teamBOvers: m.teamBOvers,
      winnerId: m.winnerId, battingFirstId: m.battingFirstId || m.teamAId, note: m.note || undefined,
    });
  }

  // Persist updated team states
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

  // Update league's best system + accuracy
  const allPreds = await db.prediction.findMany({
    where: { match: { leagueId } },
  });
  const bySystem: Record<string, { correct: number; total: number }> = {};
  for (const p of allPreds) {
    if (!bySystem[p.system]) bySystem[p.system] = { correct: 0, total: 0 };
    bySystem[p.system].total++;
    if (p.correct) bySystem[p.system].correct++;
  }
  let bestSys = 'Optimized-Weighted';
  let bestAcc = 0;
  for (const [sys, r] of Object.entries(bySystem)) {
    const acc = r.total > 0 ? r.correct / r.total : 0;
    if (acc > bestAcc) {
      bestAcc = acc;
      bestSys = sys;
    }
  }
  await db.league.update({
    where: { id: leagueId },
    data: { bestSystem: bestSys, bestAccuracy: bestAcc },
  });

  return { predCount, bestSys, bestAcc };
}

/**
 * POST /api/admin/match
 * Adds a new match and recomputes the league's walk-forward predictions.
 *
 * Body:
 *   {
 *     leagueId, date,
 *     teamAId (short code like "RCB" or full ID like "IPL_RCB"),
 *     teamAScore, teamAWickets, teamAOvers (decimal, e.g. 15.4),
 *     teamBId, teamBScore, teamBWickets, teamBOvers,
 *     winnerId ("A" or "B"),
 *     battingFirstId ("A" or "B"),
 *     note?,
 *     createTeamsIfMissing? (default true),
 *     teamAColor?, teamBColor?, teamAFullName?, teamBFullName?,
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      leagueId, date,
      teamAId, teamAScore, teamAWickets, teamAOvers,
      teamBId, teamBScore, teamBWickets, teamBOvers,
      winnerId, battingFirstId, note,
      createTeamsIfMissing = true,
      teamAColor, teamBColor,
      teamAFullName, teamBFullName,
    } = body;

    if (!leagueId || !date || !teamAId || !teamBId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (teamAId === teamBId) {
      return NextResponse.json({ error: 'Teams must be different' }, { status: 400 });
    }
    if (typeof teamAScore !== 'number' || typeof teamBScore !== 'number') {
      return NextResponse.json({ error: 'Scores must be numbers' }, { status: 400 });
    }
    if (typeof teamAOvers !== 'number' || typeof teamBOvers !== 'number') {
      return NextResponse.json({ error: 'Overs must be numbers (e.g. 20 or 15.4)' }, { status: 400 });
    }
    if (!['A', 'B'].includes(winnerId)) {
      return NextResponse.json({ error: 'winnerId must be "A" or "B"' }, { status: 400 });
    }
    if (!['A', 'B'].includes(battingFirstId)) {
      return NextResponse.json({ error: 'battingFirstId must be "A" or "B"' }, { status: 400 });
    }

    const league = await db.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      return NextResponse.json({ error: `League ${leagueId} not found` }, { status: 404 });
    }

    const resolveTeamId = (raw: string) => (raw.includes('_') ? raw : `${leagueId}_${raw}`);
    const fullAId = resolveTeamId(teamAId);
    const fullBId = resolveTeamId(teamBId);

    // Ensure teams exist
    const ensureTeam = async (id: string, fallbackName: string, color?: string, fullName?: string) => {
      let team = await db.team.findUnique({ where: { id } });
      if (!team && createTeamsIfMissing) {
        const shortName = id.split('_')[1] || fallbackName;
        team = await db.team.create({
          data: {
            id,
            name: shortName,
            fullName: fullName || shortName,
            color: color || '#64748b',
            leagueId,
          },
        });
      } else if (!team) {
        throw new Error(`Team ${id} not found. Set createTeamsIfMissing=true to auto-create.`);
      }
      return team;
    };

    await ensureTeam(fullAId, teamAId, teamAColor, teamAFullName);
    await ensureTeam(fullBId, teamBId, teamBColor, teamBFullName);

    // Determine next match number
    const maxMatch = await db.match.findFirst({
      where: { leagueId },
      orderBy: { matchNo: 'desc' },
      select: { matchNo: true },
    });
    const nextMatchNo = (maxMatch?.matchNo || 0) + 1;
    const newMatchId = `${leagueId}_${nextMatchNo}`;

    const aWon = winnerId === 'A';
    const aBattedFirst = battingFirstId === 'A';

    await db.match.create({
      data: {
        id: newMatchId,
        leagueId,
        matchNo: nextMatchNo,
        date,
        teamAId: fullAId,
        teamAScore,
        teamAWickets,
        teamAOvers,
        teamBId: fullBId,
        teamBScore,
        teamBWickets,
        teamBOvers,
        winnerId: aWon ? fullAId : fullBId,
        battingFirstId: aBattedFirst ? fullAId : fullBId,
        note: note || null,
      },
    });

    // Recompute the entire league
    const { predCount, bestSys, bestAcc } = await recomputeLeague(leagueId);

    return NextResponse.json({
      ok: true,
      match: {
        id: newMatchId,
        matchNo: nextMatchNo,
        date,
        teamAId: fullAId,
        teamBId: fullBId,
        winnerId: aWon ? fullAId : fullBId,
      },
      predictionsRegenerated: predCount,
      leagueBestSystem: bestSys,
      leagueBestAccuracy: bestAcc,
    });
  } catch (e: any) {
    console.error('Add match error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/match?leagueId=IPL&matchId=IPL_75
 * Deletes a match and recomputes the league's walk-forward predictions.
 */
export async function DELETE(req: NextRequest) {
  try {
    const leagueId = req.nextUrl.searchParams.get('leagueId');
    const matchId = req.nextUrl.searchParams.get('matchId');
    if (!leagueId || !matchId) {
      return NextResponse.json({ error: 'leagueId and matchId required' }, { status: 400 });
    }

    const match = await db.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    await db.prediction.deleteMany({ where: { matchId } });
    await db.match.delete({ where: { id: matchId } });

    const { predCount } = await recomputeLeague(leagueId);

    return NextResponse.json({ ok: true, predictionsRegenerated: predCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
