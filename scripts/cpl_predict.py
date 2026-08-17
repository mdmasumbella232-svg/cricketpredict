"""
CPL 2025 Prediction System Validation - Fourth league test
==========================================================
Applies the same prediction systems to the Caribbean Premier League 2025
season (34 matches, 2 abandoned/no-result = 32 playable).
Tests generalisation across four T20 tournaments on four continents.
"""
import json
import math
import os
import sys
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

sys.path.insert(0, "/home/z/my-project/scripts")
from ipl_predict import (
    TeamState, overs_to_balls, expected_a, update_elo, feature_vector,
    ELORawPredictor, WeightedScorePredictor, TossAgnosticMLPredictor
)
from ipl_predict_enhanced import (
    PythagoreanPredictor, BayesianShrunkPredictor, MomentumEnhancedELP
)

def ov(s):
    if isinstance(s, (int, float)): return float(s)
    if '.' in s:
        whole, balls = s.split('.')
        return int(whole) + int(balls) / 6.0
    return float(s)

# ============================================================
# CPL 2025 RAW DATA — 34 matches (2 abandoned = 32 playable)
# Teams: SKNP, ABF, GAW, BT, TKR, SLK (6 teams)
# Note: Source data has "BR" appearing twice as typo for "BT" (Barbados Royals)
# ============================================================
CPL_RAW = [
    # (match_no, date, team_a, a_runs, a_wkts, a_overs, team_b, b_runs, b_wkts, b_overs, winner, note)
    (1, "Aug 15", "SKNP", 125, 4, ov("15.0"), "ABF", 121, 10, ov("17.1"), "SKNP", ""),
    (2, "Aug 16", "SKNP", 153, 8, ov("20"),   "GAW", 154, 5, ov("17.2"), "GAW", ""),
    (3, "Aug 17", "ABF",  152, 4, ov("19.4"), "BT",  151, 6, ov("20"),  "ABF", ""),
    (4, "Aug 17", "SKNP", 219, 7, ov("20"),   "TKR", 231, 5, ov("20"),  "TKR", ""),
    (5, "Aug 18", "ABF",  0, 0, 0,             "SLK", 0, 0, 0, "",       "abandoned"),
    (6, "Aug 20", "SKNP", 197, 6, ov("20"),    "SLK", 200, 8, ov("20"), "SLK", ""),
    (7, "Aug 21", "ABF",  167, 6, ov("20"),    "TKR", 159, 6, ov("20"), "ABF", ""),
    (8, "Aug 22", "SKNP", 174, 8, ov("20"),    "BT",  162, 10, ov("18.2"),"SKNP", ""),
    (9, "Aug 23", "ABF",  128, 10, ov("15.2"), "GAW", 211, 3, ov("20"), "GAW", ""),
    (10,"Aug 24", "SLK", 165, 6, ov("20"),     "TKR", 183, 7, ov("20"), "TKR", ""),
    (11,"Aug 24", "ABF",  137, 3, ov("19.4"),  "SKNP", 133, 9, ov("20"),"ABF", ""),
    (12,"Aug 25", "SLK", 0, 0, 0,              "BT",  0, 0, 0, "",       "no_result"),
    (13,"Aug 27", "SLK", 203, 6, ov("18.1"),   "GAW", 202, 6, ov("20"), "SLK", ""),
    (14,"Aug 28", "TKR", 152, 2, ov("18.4"),   "ABF", 146, 7, ov("20"), "TKR", ""),
    (15,"Aug 29", "SLK", 180, 3, ov("17.0"),   "SKNP", 177, 3, ov("20"),"SLK", ""),
    (16,"Aug 30", "TKR", 179, 3, ov("17.5"),   "BT",  178, 6, ov("20"), "TKR", ""),
    (17,"Aug 31", "TKR", 169, 4, ov("17.2"),    "GAW", 163, 9, ov("20"), "TKR", ""),
    (18,"Aug 31", "SLK", 206, 4, ov("17.5"),    "ABF", 204, 4, ov("20"), "SLK", ""),
    (19,"Sep 1",  "TKR", 179, 6, ov("20"),     "SKNP", 167, 6, ov("20"),"TKR", ""),
    (20,"Sep 4",  "TKR", 109, 10, ov("18.1"),  "SLK", 112, 3, ov("11.1"),"SLK", ""),
    (21,"Sep 5",  "BT",  165, 6, ov("20"),      "GAW", 170, 6, ov("19.4"),"GAW", ""),
    (22,"Sep 6",  "BT",  187, 4, ov("20"),      "ABF", 188, 6, ov("20"), "ABF", ""),
    (23,"Sep 7",  "GAW", 168, 7, ov("19.5"),    "TKR", 167, 5, ov("20"), "GAW", ""),
    (24,"Sep 7",  "BT",  191, 5, ov("20"),      "SLK", 164, 9, ov("20"), "BT", ""),  # source typo "BR" -> "BT"
    (25,"Sep 8",  "GAW", 144, 8, ov("20"),     "SKNP", 149, 6, ov("20"), "SKNP", ""),
    (26,"Sep 11", "GAW", 99, 10, ov("18.1"),    "ABF", 103, 6, ov("19.1"),"ABF", ""),
    (27,"Sep 12", "BT",  149, 7, ov("20"),      "SKNP", 150, 7, ov("20"), "SKNP", ""),
    (28,"Sep 13", "BT",  172, 3, ov("19.0"),    "TKR", 166, 8, ov("20"), "BT", ""),  # source typo "BR" -> "BT"
    (29,"Sep 13", "GAW", 188, 8, ov("20"),      "SLK", 185, 4, ov("20"), "GAW", ""),
    (30,"Sep 15", "GAW", 189, 6, ov("20"),      "BT",  125, 10, ov("18.2"),"GAW", ""),
    # Playoffs
    (31,"Sep 17", "TKR", 168, 1, ov("17.3"),    "ABF", 166, 8, ov("20"), "TKR", "Eliminator1"),
    (32,"Sep 18", "SLK", 143, 10, ov("19.1"),   "GAW", 157, 10, ov("19.5"), "GAW", "Qualifier1"),
    (33,"Sep 20", "TKR", 194, 4, ov("20"),      "SLK", 138, 8, ov("20"), "TKR", "Qualifier2"),
    (34,"Sep 22", "GAW", 130, 8, ov("20"),      "TKR", 133, 7, ov("18.0"), "TKR", "Final"),
]

# Batting-first team per match (inferred from result type)
CPL_BATTING_FIRST = {
    1:  "ABF",   # SKNP won by 6 wkts (chased)
    2:  "SKNP",  # GAW won by 5 wkts (chased)
    3:  "BT",    # ABF won by 6 wkts (chased)
    4:  "TKR",   # TKR won by 12 runs (batted first)
    5:  None,    # abandoned
    6:  "SLK",   # SLK won by 3 runs (batted first)
    7:  "ABF",   # ABF won by 8 runs (batted first)
    8:  "SKNP",  # SKNP won by 12 runs (batted first)
    9:  "GAW",   # GAW won by 83 runs (batted first)
    10: "TKR",   # TKR won by 18 runs (batted first)
    11: "SKNP",  # ABF won by 7 wkts (chased)
    12: None,    # no result
    13: "GAW",   # SLK won by 4 wkts (chased)
    14: "ABF",   # TKR won by 8 wkts (chased)
    15: "SKNP",  # SLK won by 7 wkts (chased)
    16: "BT",    # TKR won by 7 wkts (chased)
    17: "GAW",   # TKR won by 6 wkts (chased)
    18: "ABF",   # SLK won by 6 wkts (chased)
    19: "TKR",   # TKR won by 12 runs (batted first)
    20: "TKR",   # SLK won by 7 wkts (chased)
    21: "BT",    # GAW won by 4 wkts (chased)
    22: "BT",    # ABF won by 4 wkts (chased)
    23: "TKR",   # GAW won by 3 wkts (chased)
    24: "BT",    # BT won by 27 runs (batted first)
    25: "SKNP",  # SKNP won by 5 runs (batted first)
    26: "GAW",   # ABF won by 4 wkts (chased)
    27: "SKNP",  # SKNP won by 1 run (batted first)
    28: "TKR",   # BT won by 7 wkts (chased)
    29: "SLK",   # GAW won by 2 wkts (chased)
    30: "GAW",   # GAW won by 64 runs (batted first)
    31: "ABF",   # TKR won by 9 wkts (chased)
    32: "GAW",   # GAW won by 14 runs (batted first)
    33: "TKR",   # TKR won by 56 runs (batted first)
    34: "GAW",   # TKR won by 3 wkts (chased)
}

CPL_TEAMS = ["SKNP", "ABF", "GAW", "BT", "TKR", "SLK"]

# Optimal weights from previous leagues
IPL_OPTIMAL_WEIGHTS = {"elo": 0.30, "rr": 0.15, "form": 0.10, "wpct": 0.15, "h2h": 0.10, "momentum": 0.20}
PSL_OPTIMAL_WEIGHTS = {"elo": 0.50, "rr": 0.05, "form": 0.05, "wpct": 0.10, "h2h": 0.15, "momentum": 0.15}
BBL_OPTIMAL_WEIGHTS = {"elo": 0.60, "rr": 0.20, "form": 0.20, "wpct": 0.10, "h2h": 0.05, "momentum": 0.00}


class OptimizedWeightedPredictor:
    name = "Optimized-Weighted"
    def __init__(self, weights, label):
        self.weights = weights
        self.name = label
    def predict_proba(self, feats, state_a, state_b):
        elo = feats["elo_prob_a"]
        form = 0.5 + feats["form_diff"] / 2.0
        rr_score = feats["bat_rr_diff"] + feats["bowl_strength_diff"] + feats["bowl_wk_diff"] - feats["bat_wk_diff"]
        rr_prob = 1.0 / (1.0 + math.exp(-rr_score / 2.0))
        wpct = 0.5 + feats["wpct_diff"] / 2.0
        h2h = 0.5 + feats["h2h_diff"] / 2.0
        momentum = 0.5 + (state_a.form_last5() - state_b.form_last5()) / 2.0
        w = self.weights
        prob = (w["elo"] * elo + w["form"] * form + w["rr"] * rr_prob +
                w["wpct"] * wpct + w["h2h"] * h2h + w["momentum"] * momentum)
        total_w = sum(w.values())
        return prob / total_w if total_w > 0 else 0.5


def update_states(states, m, bf_team):
    mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
    a_bat_first = (bf_team == ta)
    a_balls_batted = overs_to_balls(oa_) if note not in ("super_over",) else 120
    b_balls_batted = overs_to_balls(ob_) if note not in ("super_over",) else 120
    sa = states[ta]; sb = states[tb]
    sa.matches += 1; sa.total_runs_scored += ra_; sa.total_balls_faced += a_balls_batted
    sa.total_wkts_lost += wa; sa.total_runs_conceded += rb_; sa.total_balls_bowled += b_balls_batted
    sa.total_wkts_taken += wb
    if winner == ta: sa.wins += 1; sa.recent.append(1)
    else: sa.recent.append(0)
    if a_bat_first:
        sa.bf_matches += 1; sa.bf_total_runs += ra_
        if winner == ta: sa.bf_wins += 1
    else:
        sa.ch_matches += 1; sa.ch_total_runs += ra_
        if winner == ta: sa.ch_wins += 1
    sb.matches += 1; sb.total_runs_scored += rb_; sb.total_balls_faced += b_balls_batted
    sb.total_wkts_lost += wb; sb.total_runs_conceded += ra_; sb.total_balls_bowled += a_balls_batted
    sb.total_wkts_taken += wa
    if winner == tb: sb.wins += 1; sb.recent.append(1)
    else: sb.recent.append(0)
    if not a_bat_first:
        sb.bf_matches += 1; sb.bf_total_runs += rb_
        if winner == tb: sb.bf_wins += 1
    else:
        sb.ch_matches += 1; sb.ch_total_runs += rb_
        if winner == tb: sb.ch_wins += 1
    if winner == ta:
        sa.h2h[tb][0] += 1; sb.h2h[ta][1] += 1
    else:
        sa.h2h[tb][1] += 1; sb.h2h[ta][0] += 1
    if a_bat_first:
        if winner == ta:
            margin_runs = ra_ - rb_; wkts_margin = None
        else:
            margin_runs = None; wkts_margin = 10 - wb
    else:
        if winner == tb:
            margin_runs = rb_ - ra_; wkts_margin = None
        else:
            margin_runs = None; wkts_margin = 10 - wa
    new_a, new_b = update_elo(sa.elo, sb.elo, winner == ta,
                              margin_runs=margin_runs, a_wkts_margin=wkts_margin)
    sa.elo = new_a; sb.elo = new_b


def cpl_grid_search():
    print("\nRunning CPL grid search for optimal weights...")
    best_w = IPL_OPTIMAL_WEIGHTS.copy()
    best_acc = 0
    search_grid = []
    for elo_w in [0.20, 0.30, 0.40, 0.50, 0.60, 0.70]:
        for rr_w in [0.05, 0.10, 0.15, 0.20, 0.25]:
            for form_w in [0.05, 0.10, 0.15, 0.20]:
                for wpct_w in [0.05, 0.10, 0.15]:
                    for h2h_w in [0.05, 0.10, 0.15, 0.20]:
                        momentum_w = max(0, 1 - elo_w - rr_w - form_w - wpct_w - h2h_w)
                        if momentum_w < 0 or momentum_w > 0.30:
                            continue
                        search_grid.append({"elo": elo_w, "rr": rr_w, "form": form_w,
                                            "wpct": wpct_w, "h2h": h2h_w, "momentum": momentum_w})
    print(f"  Testing {len(search_grid)} weight combinations...")
    for w in search_grid:
        pred = OptimizedWeightedPredictor(weights=w, label="test")
        states = {t: TeamState() for t in CPL_TEAMS}
        for t in CPL_TEAMS: states[t].elo = 1500.0
        correct = 0; total = 0
        for m in CPL_RAW:
            mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
            if note in ("abandoned", "no_result") or winner == "": continue
            bf_team = CPL_BATTING_FIRST.get(mid)
            if bf_team is None: continue
            fvec = feature_vector(states[ta], states[tb], bf_team, ta, tb)
            p = pred.predict_proba(fvec, states[ta], states[tb])
            pred_a = (p > 0.5)
            actual_a_won = (winner == ta)
            if pred_a == actual_a_won: correct += 1
            total += 1
            update_states(states, m, bf_team)
        acc = correct / total
        if acc > best_acc:
            best_acc = acc; best_w = w.copy()
            print(f"  New best: {best_acc*100:.1f}% with {w}")
    print(f"\nCPL-optimal weights: {best_w} (acc={best_acc*100:.1f}%)")
    return best_w


def run_cpl_backtest(weights_ipl, weights_psl, weights_bbl, weights_cpl):
    states = {t: TeamState() for t in CPL_TEAMS}
    for t in CPL_TEAMS: states[t].elo = 1500.0
    WARMUP = 4  # very small warmup for shortest season
    predictions = {
        "ELO-Raw": [],
        "ELO+Momentum": [],
        "Weighted-Score": [],
        "Opt-Weighted (IPL-tuned)": [],
        "Opt-Weighted (PSL-tuned)": [],
        "Opt-Weighted (BBL-tuned)": [],
        "Opt-Weighted (CPL-tuned)": [],
        "Pythagorean": [],
        "Bayesian-Shrunk": [],
        "LogReg": [],
        "RandomForest": [],
        "GradientBoosting": [],
        "Ensemble-Stacked": [],
        "Baseline-50/50": [],
    }
    train_features = []; train_labels = []
    ml_models = {
        "LogReg": TossAgnosticMLPredictor(LogisticRegression(max_iter=2000, C=0.5), "LogReg"),
        "RandomForest": TossAgnosticMLPredictor(RandomForestClassifier(n_estimators=200, max_depth=5, random_state=42), "RandomForest"),
        "GradientBoosting": TossAgnosticMLPredictor(GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=42), "GradientBoosting"),
        "Ensemble-Stacked": TossAgnosticMLPredictor(
            VotingClassifier(estimators=[
                ("lr", LogisticRegression(max_iter=2000, C=0.5)),
                ("rf", RandomForestClassifier(n_estimators=200, max_depth=5, random_state=42)),
                ("gb", GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=42)),
            ], voting="soft"), "Ensemble-Stacked"),
    }
    last_trained_at = -100
    pyth = PythagoreanPredictor()
    bayes = BayesianShrunkPredictor(prior_k=5.0)
    momentum_elo = MomentumEnhancedELP(momentum_weight=0.15)
    opt_ipl = OptimizedWeightedPredictor(weights=weights_ipl, label="IPL")
    opt_psl = OptimizedWeightedPredictor(weights=weights_psl, label="PSL")
    opt_bbl = OptimizedWeightedPredictor(weights=weights_bbl, label="BBL")
    opt_cpl = OptimizedWeightedPredictor(weights=weights_cpl, label="CPL")
    elo_history = {t: [1500.0] for t in CPL_TEAMS}
    match_count = 0
    for m in CPL_RAW:
        mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
        if note in ("abandoned", "no_result") or winner == "": continue
        bf_team = CPL_BATTING_FIRST.get(mid)
        if bf_team is None: continue
        match_count += 1
        fvec = feature_vector(states[ta], states[tb], bf_team, ta, tb)
        all_bat_rr = [s.batting_run_rate() for s in states.values() if s.matches > 0]
        league_mean_rr = float(np.mean(all_bat_rr)) if all_bat_rr else 8.5
        actual_a_won = (winner == ta)
        p = ELORawPredictor().predict_proba(fvec)
        predictions["ELO-Raw"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = momentum_elo.predict_proba(fvec, states[ta], states[tb])
        predictions["ELO+Momentum"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = WeightedScorePredictor().predict_proba(fvec)
        predictions["Weighted-Score"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = opt_ipl.predict_proba(fvec, states[ta], states[tb])
        predictions["Opt-Weighted (IPL-tuned)"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = opt_psl.predict_proba(fvec, states[ta], states[tb])
        predictions["Opt-Weighted (PSL-tuned)"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = opt_bbl.predict_proba(fvec, states[ta], states[tb])
        predictions["Opt-Weighted (BBL-tuned)"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = opt_cpl.predict_proba(fvec, states[ta], states[tb])
        predictions["Opt-Weighted (CPL-tuned)"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = pyth.predict_proba(fvec, states[ta], states[tb])
        predictions["Pythagorean"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = bayes.predict_proba(fvec, states[ta], states[tb], league_mean_rr)
        predictions["Bayesian-Shrunk"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        predictions["Baseline-50/50"].append((mid, ta, tb, 0.5, winner, actual_a_won))
        if match_count >= WARMUP:
            if match_count - last_trained_at >= 3 and len(train_features) >= 8:
                for model in ml_models.values():
                    try: model.fit(train_features, train_labels)
                    except Exception as e: print(f"  Train fail at {mid}: {e}")
                last_trained_at = match_count
            if len(train_features) >= 8:
                for name, model in ml_models.items():
                    try: p = model.predict_proba_single(fvec)
                    except: p = 0.5
                    predictions[name].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        train_features.append(fvec)
        train_labels.append(1 if winner == ta else 0)
        update_states(states, m, bf_team)
        for t in CPL_TEAMS:
            elo_history[t].append(states[t].elo)
    return predictions, states, elo_history


if __name__ == "__main__":
    print("=" * 70)
    print("CPL 2025 PREDICTION SYSTEM VALIDATION (4th league test)")
    print("=" * 70)
    cpl_weights = cpl_grid_search()
    predictions, final_states, elo_history = run_cpl_backtest(
        IPL_OPTIMAL_WEIGHTS, PSL_OPTIMAL_WEIGHTS, BBL_OPTIMAL_WEIGHTS, cpl_weights)
    results = {}
    for system, preds in predictions.items():
        if not preds:
            results[system] = {"n": 0, "accuracy": 0, "brier": 0, "logloss": 0, "correct": 0}; continue
        y_true = [1 if w == ta else 0 for (_, ta, _, _, w, _) in preds]
        y_prob = [p for (_, _, _, p, _, _) in preds]
        correct_flags = [(p > 0.5) == (w == ta) for (_, ta, _, p, w, _) in preds]
        correct_count = int(sum(correct_flags))
        n = len(preds); acc = correct_count / n
        try: brier = brier_score_loss(y_true, y_prob)
        except: brier = float('nan')
        try: ll = log_loss(y_true, y_prob, labels=[0,1])
        except: ll = float('nan')
        results[system] = {"n": n, "accuracy": float(acc), "brier": float(brier),
                           "logloss": float(ll), "correct": correct_count}

    print("\n=== CPL 2025 Backtest Results ===")
    print(f"{'System':<35} {'N':>4} {'Correct':>8} {'Acc':>7} {'Brier':>7} {'LogLoss':>8}")
    print("-" * 75)
    for sys_name, r in sorted(results.items(), key=lambda x: -x[1]["accuracy"]):
        print(f"{sys_name:<35} {r['n']:>4} {r['correct']:>8} {r['accuracy']*100:>6.1f}% {r['brier']:>7.3f} {r['logloss']:>8.3f}")

    # Charts
    # 1. Model comparison
    fig, ax = plt.subplots(figsize=(11, 6.5), constrained_layout=True)
    sorted_sys = sorted(results.items(), key=lambda x: -x[1]["accuracy"])
    names = [s[0] for s in sorted_sys]
    accs = [s[1]["accuracy"] * 100 for s in sorted_sys]
    colors_bar = []
    for n in names:
        if 'CPL-tuned' in n: colors_bar.append('#d32f2f')
        elif 'IPL-tuned' in n: colors_bar.append('#94761e')
        elif 'PSL-tuned' in n: colors_bar.append('#418d5b')
        elif 'BBL-tuned' in n: colors_bar.append('#0288d1')
        elif n in ('ELO-Raw','ELO+Momentum','Weighted-Score','Pythagorean','Bayesian-Shrunk'): colors_bar.append('#5d4037')
        else: colors_bar.append('#816d31')
    bars = ax.barh(names, accs, color=colors_bar)
    ax.axvline(50, color='#a94f47', linestyle='--', alpha=0.6, label='50% baseline')
    for bar, acc in zip(bars, accs):
        ax.text(acc + 0.5, bar.get_y() + bar.get_height()/2, f"{acc:.1f}%", va='center', fontsize=9)
    ax.set_xlabel('Backtest Accuracy (%)')
    ax.set_title('CPL 2025: Prediction System Accuracy Comparison', fontweight='bold')
    ax.set_xlim(35, 85)
    ax.invert_yaxis()
    ax.grid(axis='x', alpha=0.3)
    plt.savefig('/home/z/my-project/download/cpl_chart_model_comparison.png', dpi=150)
    plt.close()
    print("Saved cpl_chart_model_comparison.png")

    # 2. ELO progression
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    team_colors = {'SKNP':'#d32f2f','ABF':'#1976d2','GAW':'#388e3c','BT':'#7b1fa2',
                   'TKR':'#f57c00','SLK':'#00838f'}
    for t in CPL_TEAMS:
        if t in elo_history:
            ax.plot(range(len(elo_history[t])), elo_history[t], label=t,
                    color=team_colors.get(t,'#888'), linewidth=2.2)
    ax.set_xlabel('Match # in Season')
    ax.set_ylabel('ELO Rating')
    ax.set_title('Team ELO Rating Trajectory - CPL 2025', fontweight='bold')
    ax.legend(loc='upper left', bbox_to_anchor=(1.01, 1.0), fontsize=9)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/cpl_chart_elo_trajectory.png', dpi=150)
    plt.close()
    print("Saved cpl_chart_elo_trajectory.png")

    # 3. Cumulative accuracy
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    top_systems = ["Opt-Weighted (CPL-tuned)", "Opt-Weighted (IPL-tuned)",
                   "Opt-Weighted (PSL-tuned)", "Opt-Weighted (BBL-tuned)",
                   "ELO-Raw", "Baseline-50/50"]
    for sys_name in top_systems:
        preds = predictions.get(sys_name, [])
        if not preds: continue
        cum_correct = 0; cum_total = 0; x_vals = []; y_vals = []
        for (mid, ta, tb, p, w, c) in preds:
            cum_total += 1; cum_correct += int(c)
            x_vals.append(mid); y_vals.append(cum_correct / cum_total * 100)
        ax.plot(x_vals, y_vals, label=sys_name, linewidth=2)
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_xlabel('Match #')
    ax.set_ylabel('Cumulative Accuracy (%)')
    ax.set_title('CPL 2025: Cumulative Prediction Accuracy', fontweight='bold')
    ax.legend(loc='lower right', fontsize=8.5)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/cpl_chart_cumulative_acc.png', dpi=150)
    plt.close()
    print("Saved cpl_chart_cumulative_acc.png")

    # 4. Final team ratings
    fig, ax = plt.subplots(figsize=(10, 5), constrained_layout=True)
    sorted_teams = sorted(CPL_TEAMS, key=lambda t: -final_states[t].elo)
    elos = [final_states[t].elo for t in sorted_teams]
    bar_colors = [team_colors.get(t,'#888') for t in sorted_teams]
    bars = ax.bar(sorted_teams, elos, color=bar_colors)
    for bar, e in zip(bars, elos):
        ax.text(bar.get_x() + bar.get_width()/2, e + 5, f"{e:.0f}", ha='center', fontsize=10, fontweight='bold')
    ax.set_ylabel('Final ELO Rating')
    ax.set_title('Final Team ELO Ratings - End of CPL 2025', fontweight='bold')
    ax.set_ylim(min(elos)-30, max(elos)+30)
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/cpl_chart_final_elo.png', dpi=150)
    plt.close()
    print("Saved cpl_chart_final_elo.png")

    # 5. FOUR-LEAGUE COMPARISON
    try:
        with open("/home/z/my-project/download/ipl_predictions.json") as f:
            ipl_results = json.load(f)["results"]
    except: ipl_results = {}
    try:
        with open("/home/z/my-project/download/psl_predictions.json") as f:
            psl_results = json.load(f)["results"]
    except: psl_results = {}
    try:
        with open("/home/z/my-project/download/bbl_predictions.json") as f:
            bbl_results = json.load(f)["results"]
    except: bbl_results = {}

    fig, ax = plt.subplots(figsize=(13, 6), constrained_layout=True)
    common_systems = ["ELO-Raw", "Weighted-Score", "Pythagorean", "Bayesian-Shrunk",
                      "LogReg", "RandomForest", "GradientBoosting", "Ensemble-Stacked"]
    x = np.arange(len(common_systems))
    width = 0.21
    ipl_accs = [ipl_results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    psl_accs = [psl_results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    bbl_accs = [bbl_results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    cpl_accs = [results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    ax.bar(x - 1.5*width, ipl_accs, width, label='IPL 2026 (73)', color='#67604b')
    ax.bar(x - 0.5*width, psl_accs, width, label='PSL 2026 (43)', color='#94761e')
    ax.bar(x + 0.5*width, bbl_accs, width, label='BBL 2025-26 (43)', color='#0288d1')
    ax.bar(x + 1.5*width, cpl_accs, width, label='CPL 2025 (32)', color='#d32f2f')
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_ylabel('Accuracy (%)')
    ax.set_title('Four-League Validation: Same Models, Four Tournaments', fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels([s.replace('-Stacked','') for s in common_systems], rotation=20, ha='right')
    ax.legend(loc='upper right', ncol=2)
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_four_league_comparison.png', dpi=150)
    plt.close()
    print("Saved chart_four_league_comparison.png")

    # 6. WEIGHT TRANSFER matrix
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    leagues = ['IPL 2026', 'PSL 2026', 'BBL 2025-26', 'CPL 2025']
    tunings = ['IPL-tuned', 'PSL-tuned', 'BBL-tuned', 'CPL-tuned']
    # Matrix: rows = leagues, cols = tuning source
    matrix = [
        # IPL row: only had its own tuning initially
        [ipl_results.get("Optimized-Weighted", {}).get("accuracy", 0) * 100, None, None, None],
        # PSL row: had IPL-tuned and PSL-tuned
        [psl_results.get("Opt-Weighted (IPL-tuned)", {}).get("accuracy", 0) * 100,
         psl_results.get("Opt-Weighted (PSL-tuned)", {}).get("accuracy", 0) * 100, None, None],
        # BBL row: had IPL, PSL, BBL
        [bbl_results.get("Opt-Weighted (IPL-tuned)", {}).get("accuracy", 0) * 100,
         bbl_results.get("Opt-Weighted (PSL-tuned)", {}).get("accuracy", 0) * 100,
         bbl_results.get("Opt-Weighted (BBL-tuned)", {}).get("accuracy", 0) * 100, None],
        # CPL row: all four
        [results.get("Opt-Weighted (IPL-tuned)", {}).get("accuracy", 0) * 100,
         results.get("Opt-Weighted (PSL-tuned)", {}).get("accuracy", 0) * 100,
         results.get("Opt-Weighted (BBL-tuned)", {}).get("accuracy", 0) * 100,
         results.get("Opt-Weighted (CPL-tuned)", {}).get("accuracy", 0) * 100],
    ]
    x = np.arange(len(leagues))
    colors = ['#94761e','#418d5b','#0288d1','#d32f2f']
    for i, t in enumerate(tunings):
        vals = [matrix[j][i] if matrix[j][i] is not None else np.nan for j in range(len(leagues))]
        ax.bar(x + (i-1.5)*0.18, vals, 0.18, label=t, color=colors[i])
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_ylabel('Accuracy (%)')
    ax.set_title('Optimized-Weighted: Four-League Weight Transfer', fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(leagues)
    ax.legend(loc='lower right', ncol=2)
    ax.grid(axis='y', alpha=0.3)
    ax.set_ylim(30, 80)
    plt.savefig('/home/z/my-project/download/chart_weight_transfer_4leagues.png', dpi=150)
    plt.close()
    print("Saved chart_weight_transfer_4leagues.png")

    # Save JSON
    out = {
        "results": results,
        "cpl_optimal_weights": cpl_weights,
        "ipl_optimal_weights": IPL_OPTIMAL_WEIGHTS,
        "psl_optimal_weights": PSL_OPTIMAL_WEIGHTS,
        "bbl_optimal_weights": BBL_OPTIMAL_WEIGHTS,
        "final_team_stats": {t: {
            "matches": final_states[t].matches, "wins": final_states[t].wins,
            "elo": final_states[t].elo,
            "bat_run_rate": final_states[t].batting_run_rate(),
            "bowl_run_rate": final_states[t].bowling_run_rate(),
            "form_last5": final_states[t].form_last5(),
            "win_pct": final_states[t].win_pct(),
            "bf_win_pct": final_states[t].bf_win_pct(),
            "ch_win_pct": final_states[t].ch_win_pct(),
        } for t in CPL_TEAMS},
        "per_match_preds": {sys: [
            {"match": m, "team_a": a, "team_b": b, "prob_a": float(p), "winner": w, "correct": bool(c)}
            for (m, a, b, p, w, c) in plist
        ] for sys, plist in predictions.items()},
    }
    with open("/home/z/my-project/download/cpl_predictions.json", "w") as f:
        json.dump(out, f, indent=2)
    print("Saved /home/z/my-project/download/cpl_predictions.json")

    print("\n=== Final CPL Team Ratings ===")
    for i, t in enumerate(sorted(CPL_TEAMS, key=lambda x: -final_states[x].elo), 1):
        s = final_states[t]
        print(f"{i}. {t:<5} ELO={s.elo:6.0f}  M={s.matches:2d}  W={s.wins:2d}  "
              f"WPct={s.win_pct()*100:5.1f}%  BatRR={s.batting_run_rate():.2f}  "
              f"BowlRR={s.bowling_run_rate():.2f}  Form5={s.form_last5()*100:.0f}%")
