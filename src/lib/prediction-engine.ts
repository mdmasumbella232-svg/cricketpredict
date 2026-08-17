/**
 * Cricket Prediction Engine (TypeScript port)
 * Ported from /home/z/my-project/scripts/ipl_predict_enhanced.py
 *
 * Core capabilities:
 *   - TeamState with rolling statistics (run rate, wicket rate, form, ELO, H2H)
 *   - ELO rating with margin-of-victory multiplier (K=32, max 2x MOV)
 *   - 13 engineered features for match prediction
 *   - 6 prediction systems: ELO-Raw, ELO+Momentum, Weighted-Score,
 *     Optimized-Weighted (league-tunable), Pythagorean, Bayesian-Shrunk
 *   - Walk-forward simulation (no look-ahead bias)
 */

export interface TeamState {
  id: string;
  elo: number;
  matches: number;
  wins: number;
  totalRunsScored: number;
  totalBallsFaced: number;
  totalWicketsLost: number;
  totalRunsConceded: number;
  totalBallsBowled: number;
  totalWicketsTaken: number;
  battingFirstMatches: number;
  battingFirstWins: number;
  chasingMatches: number;
  chasingWins: number;
  battingFirstTotalRuns: number;
  chasingTotalRuns: number;
  recentForm: number[]; // last 5 results, oldest first
  h2h: Record<string, [number, number]>; // opponentId -> [wins, losses]
}

export interface MatchFeatures {
  eloDiff: number;
  eloProbA: number;
  batRrDiff: number;
  bowlStrengthDiff: number;
  batWkDiff: number;
  bowlWkDiff: number;
  formDiff: number;
  wpctDiff: number;
  h2hDiff: number;
  bfWinDiff: number;
  chWinDiff: number;
  bfAvgDiff: number;
  expDiff: number;
}

export interface Weights {
  elo: number;
  rr: number;
  form: number;
  wpct: number;
  h2h: number;
  momentum: number;
}

// Per-league optimal weights discovered via grid search
export const LEAGUE_WEIGHTS: Record<string, Weights> = {
  IPL: { elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 },
  PSL: { elo: 0.50, rr: 0.05, form: 0.05, wpct: 0.10, h2h: 0.15, momentum: 0.15 },
  BBL: { elo: 0.60, rr: 0.20, form: 0.20, wpct: 0.10, h2h: 0.05, momentum: 0.00 },
  CPL: { elo: 0.20, rr: 0.10, form: 0.20, wpct: 0.15, h2h: 0.05, momentum: 0.30 },
  DEFAULT: { elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 },
};

// ============================================================
// Helpers
// ============================================================

export function initTeamState(id: string): TeamState {
  return {
    id,
    elo: 1500,
    matches: 0,
    wins: 0,
    totalRunsScored: 0,
    totalBallsFaced: 0,
    totalWicketsLost: 0,
    totalRunsConceded: 0,
    totalBallsBowled: 0,
    totalWicketsTaken: 0,
    battingFirstMatches: 0,
    battingFirstWins: 0,
    chasingMatches: 0,
    chasingWins: 0,
    battingFirstTotalRuns: 0,
    chasingTotalRuns: 0,
    recentForm: [],
    h2h: {},
  };
}

export function battingRunRate(s: TeamState): number {
  if (s.totalBallsFaced === 0) return 0;
  return s.totalRunsScored / (s.totalBallsFaced / 6);
}

export function bowlingRunRate(s: TeamState): number {
  if (s.totalBallsBowled === 0) return 0;
  return s.totalRunsConceded / (s.totalBallsBowled / 6);
}

export function battingWktRate(s: TeamState): number {
  if (s.totalBallsFaced === 0) return 0;
  return s.totalWicketsLost / (s.totalBallsFaced / 6);
}

export function bowlingWktRate(s: TeamState): number {
  if (s.totalBallsBowled === 0) return 0;
  return s.totalWicketsTaken / (s.totalBallsBowled / 6);
}

export function winPct(s: TeamState): number {
  return s.matches === 0 ? 0 : s.wins / s.matches;
}

export function formLast5(s: TeamState): number {
  if (s.recentForm.length === 0) return 0.5;
  return s.recentForm.reduce((a, b) => a + b, 0) / s.recentForm.length;
}

export function bfWinPct(s: TeamState): number {
  return s.battingFirstMatches === 0 ? 0 : s.battingFirstWins / s.battingFirstMatches;
}

export function chWinPct(s: TeamState): number {
  return s.chasingMatches === 0 ? 0 : s.chasingWins / s.chasingMatches;
}

export function bfAvg(s: TeamState): number {
  return s.battingFirstMatches === 0 ? 0 : s.battingFirstTotalRuns / s.battingFirstMatches;
}

// ============================================================
// ELO
// ============================================================

export function expectedA(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

export function updateElo(
  eloA: number,
  eloB: number,
  aWon: boolean,
  marginRuns: number | null,
  wktsMargin: number | null,
  k = 32
): [number, number] {
  const ea = expectedA(eloA, eloB);
  const sA = aWon ? 1 : 0;
  let mov = 1;
  if (marginRuns !== null) {
    mov = Math.min(2, 1 + Math.abs(marginRuns) / 100);
  } else if (wktsMargin !== null) {
    mov = Math.min(2, 1 + wktsMargin / 5);
  }
  const newA = eloA + k * mov * (sA - ea);
  const newB = eloB + k * mov * (1 - sA - (1 - ea));
  return [newA, newB];
}

// ============================================================
// Features
// ============================================================

export function buildFeatures(a: TeamState, b: TeamState): MatchFeatures {
  const eloDiff = a.elo - b.elo;
  const eloProbA = expectedA(a.elo, b.elo);
  const batRrDiff = battingRunRate(a) - battingRunRate(b);
  // bowl_strength_diff: positive = A bowls better (concedes less)
  const bowlStrengthDiff = bowlingRunRate(b) - bowlingRunRate(a);
  const batWkDiff = battingWktRate(a) - battingWktRate(b); // negative = A loses fewer wickets
  const bowlWkDiff = bowlingWktRate(a) - bowlingWktRate(b); // positive = A takes more wickets
  const formDiff = formLast5(a) - formLast5(b);
  const wpctDiff = winPct(a) - winPct(b);

  const h2hAB = a.h2h[b.id] || [0, 0];
  const h2hTotal = h2hAB[0] + h2hAB[1];
  const h2hDiff = h2hTotal > 0 ? (h2hAB[0] - h2hAB[1]) / h2hTotal : 0;

  const bfWinDiff = bfWinPct(a) - bfWinPct(b);
  const chWinDiff = chWinPct(a) - chWinPct(b);
  const bfAvgDiff = bfAvg(a) - bfAvg(b);
  const expDiff = a.matches - b.matches;

  return {
    eloDiff,
    eloProbA,
    batRrDiff,
    bowlStrengthDiff,
    batWkDiff,
    bowlWkDiff,
    formDiff,
    wpctDiff,
    h2hDiff,
    bfWinDiff,
    chWinDiff,
    bfAvgDiff,
    expDiff,
  };
}

// ============================================================
// Predictors
// ============================================================

export function predictELORaw(f: MatchFeatures): number {
  return f.eloProbA;
}

export function predictELOMomentum(f: MatchFeatures, a: TeamState, b: TeamState): number {
  const momentumShift = 0.15 * (formLast5(a) - formLast5(b));
  return Math.max(0.01, Math.min(0.99, f.eloProbA + momentumShift));
}

export function predictWeightedScore(f: MatchFeatures): number {
  const elo = f.eloProbA;
  const form = 0.5 + f.formDiff / 2;
  const rrScore = f.batRrDiff + f.bowlStrengthDiff + f.bowlWkDiff - f.batWkDiff;
  const rrProb = 1 / (1 + Math.exp(-rrScore / 2));
  const wpct = 0.5 + f.wpctDiff / 2;
  const h2h = 0.5 + f.h2hDiff / 2;
  // Heuristic weights (IPL default)
  const prob = 0.4 * elo + 0.18 * form + 0.18 * rrProb + 0.12 * wpct + 0.07 * h2h + 0.05 * 0.5;
  return prob;
}

export function predictOptimizedWeighted(f: MatchFeatures, a: TeamState, b: TeamState, w: Weights): number {
  const elo = f.eloProbA;
  const form = 0.5 + f.formDiff / 2;
  const rrScore = f.batRrDiff + f.bowlStrengthDiff + f.bowlWkDiff - f.batWkDiff;
  const rrProb = 1 / (1 + Math.exp(-rrScore / 2));
  const wpct = 0.5 + f.wpctDiff / 2;
  const h2h = 0.5 + f.h2hDiff / 2;
  const momentum = 0.5 + (formLast5(a) - formLast5(b)) / 2;
  const prob = w.elo * elo + w.form * form + w.rr * rrProb + w.wpct * wpct + w.h2h * h2h + w.momentum * momentum;
  const totalW = Object.values(w).reduce((s, v) => s + v, 0);
  return totalW > 0 ? prob / totalW : 0.5;
}

export function predictPythagorean(a: TeamState, b: TeamState): number {
  const exp = 2;
  const aScored = Math.max(0.1, battingRunRate(a));
  const aAllowed = Math.max(0.1, bowlingRunRate(a));
  const bScored = Math.max(0.1, battingRunRate(b));
  const bAllowed = Math.max(0.1, bowlingRunRate(b));
  const aPyth = Math.pow(aScored, exp) / (Math.pow(aScored, exp) + Math.pow(aAllowed, exp));
  const bPyth = Math.pow(bScored, exp) / (Math.pow(bScored, exp) + Math.pow(bAllowed, exp));
  const num = aPyth * (1 - bPyth);
  const denom = num + bPyth * (1 - aPyth) + 1e-9;
  return num / denom;
}

export function predictBayesianShrunk(a: TeamState, b: TeamState, leagueMeanRr: number): number {
  const k = 5;
  const aBat = (battingRunRate(a) * a.matches + leagueMeanRr * k) / (a.matches + k);
  const aBowl = (bowlingRunRate(a) * a.matches + leagueMeanRr * k) / (a.matches + k);
  const bBat = (battingRunRate(b) * b.matches + leagueMeanRr * k) / (b.matches + k);
  const bBowl = (bowlingRunRate(b) * b.matches + leagueMeanRr * k) / (b.matches + k);
  const aOffenseVsB = (aBat + (leagueMeanRr - bBowl + leagueMeanRr)) / 2;
  const bOffenseVsA = (bBat + (leagueMeanRr - aBowl + leagueMeanRr)) / 2;
  const diff = aOffenseVsB - bOffenseVsA;
  return 1 / (1 + Math.exp(-diff / 1.5));
}

// ============================================================
// State Update (apply match result to team states)
// ============================================================

export interface MatchInput {
  matchNo: number;
  date: string;
  teamAId: string;
  teamAScore: number;
  teamAWickets: number;
  teamAOvers: number;
  teamBId: string;
  teamBScore: number;
  teamBWickets: number;
  teamBOvers: number;
  winnerId: string;
  battingFirstId: string; // team that batted first
  note?: string;
}

function oversToBalls(overs: number): number {
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  return whole * 6 + balls;
}

export function applyMatchResult(states: Record<string, TeamState>, m: MatchInput): void {
  const a = states[m.teamAId];
  const b = states[m.teamBId];
  if (!a || !b) return;

  const aBattedFirst = m.battingFirstId === m.teamAId;
  const aBalls = oversToBalls(m.teamAOvers);
  const bBalls = oversToBalls(m.teamBOvers);
  const aWon = m.winnerId === m.teamAId;

  // Update A
  a.matches++;
  a.totalRunsScored += m.teamAScore;
  a.totalBallsFaced += aBalls;
  a.totalWicketsLost += m.teamAWickets;
  a.totalRunsConceded += m.teamBScore;
  a.totalBallsBowled += bBalls;
  a.totalWicketsTaken += m.teamBWickets;
  if (aWon) a.wins++;
  a.recentForm.push(aWon ? 1 : 0);
  if (a.recentForm.length > 5) a.recentForm.shift();
  if (aBattedFirst) {
    a.battingFirstMatches++;
    a.battingFirstTotalRuns += m.teamAScore;
    if (aWon) a.battingFirstWins++;
  } else {
    a.chasingMatches++;
    a.chasingTotalRuns += m.teamAScore;
    if (aWon) a.chasingWins++;
  }

  // Update B
  b.matches++;
  b.totalRunsScored += m.teamBScore;
  b.totalBallsFaced += bBalls;
  b.totalWicketsLost += m.teamBWickets;
  b.totalRunsConceded += m.teamAScore;
  b.totalBallsBowled += aBalls;
  b.totalWicketsTaken += m.teamAWickets;
  if (!aWon) b.wins++;
  b.recentForm.push(!aWon ? 1 : 0);
  if (b.recentForm.length > 5) b.recentForm.shift();
  if (!aBattedFirst) {
    b.battingFirstMatches++;
    b.battingFirstTotalRuns += m.teamBScore;
    if (!aWon) b.battingFirstWins++;
  } else {
    b.chasingMatches++;
    b.chasingTotalRuns += m.teamBScore;
    if (!aWon) b.chasingWins++;
  }

  // H2H
  if (aWon) {
    if (!a.h2h[b.id]) a.h2h[b.id] = [0, 0];
    a.h2h[b.id][0]++;
    if (!b.h2h[a.id]) b.h2h[a.id] = [0, 0];
    b.h2h[a.id][1]++;
  } else {
    if (!a.h2h[b.id]) a.h2h[b.id] = [0, 0];
    a.h2h[b.id][1]++;
    if (!b.h2h[a.id]) b.h2h[a.id] = [0, 0];
    b.h2h[a.id][0]++;
  }

  // ELO update with margin
  let marginRuns: number | null = null;
  let wktsMargin: number | null = null;
  if (aBattedFirst) {
    if (aWon) {
      marginRuns = m.teamAScore - m.teamBScore;
    } else {
      wktsMargin = 10 - m.teamBWickets;
    }
  } else {
    if (!aWon) {
      marginRuns = m.teamBScore - m.teamAScore;
    } else {
      wktsMargin = 10 - m.teamAWickets;
    }
  }
  const [newA, newB] = updateElo(a.elo, b.elo, aWon, marginRuns, wktsMargin);
  a.elo = newA;
  b.elo = newB;
}

// ============================================================
// Full prediction (all systems) for one match
// ============================================================

export interface SystemPrediction {
  system: string;
  probA: number;
  predictedWinner: string; // 'A' or 'B'
  confidence: 'Low' | 'Medium' | 'High';
}

export function predictAllSystems(
  a: TeamState,
  b: TeamState,
  leagueId: string
): SystemPrediction[] {
  const f = buildFeatures(a, b);
  const w = LEAGUE_WEIGHTS[leagueId] || LEAGUE_WEIGHTS.DEFAULT;
  const allBatRr = [battingRunRate(a), battingRunRate(b)].filter((r) => r > 0);
  const leagueMeanRr = allBatRr.length > 0 ? allBatRr.reduce((s, v) => s + v, 0) / allBatRr.length : 8.5;

  const preds: { system: string; probA: number }[] = [
    { system: 'ELO-Raw', probA: predictELORaw(f) },
    { system: 'ELO+Momentum', probA: predictELOMomentum(f, a, b) },
    { system: 'Weighted-Score', probA: predictWeightedScore(f) },
    { system: `Opt-Weighted (${leagueId}-tuned)`, probA: predictOptimizedWeighted(f, a, b, w) },
    { system: 'Pythagorean', probA: predictPythagorean(a, b) },
    { system: 'Bayesian-Shrunk', probA: predictBayesianShrunk(a, b, leagueMeanRr) },
  ];

  return preds.map((p) => {
    const predictedWinner = p.probA > 0.5 ? 'A' : 'B';
    const conf = Math.abs(p.probA - 0.5);
    const confidence: 'Low' | 'Medium' | 'High' = conf < 0.08 ? 'Low' : conf < 0.18 ? 'Medium' : 'High';
    return { ...p, predictedWinner, confidence };
  });
}
