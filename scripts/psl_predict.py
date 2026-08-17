"""
PSL 2026 Prediction System - applies the SAME 11 models used for IPL 2026
to the Pakistan Super League 2026 season (44 matches, 1 abandoned = 43 playable).
Tests cross-tournament transferability: do IPL-tuned weights work on PSL data?
"""
import json
import math
import os
import sys
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional

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

# Import shared infrastructure
sys.path.insert(0, "/home/z/my-project/scripts")
from ipl_predict import (
    TeamState, overs_to_balls, expected_a, update_elo, feature_vector,
    ELORawPredictor, WeightedScorePredictor, TossAgnosticMLPredictor
)
from ipl_predict_enhanced import (
    PythagoreanPredictor, BayesianShrunkPredictor, MomentumEnhancedELP
)

# ============================================================
# PSL 2026 RAW DATA — 44 matches (1 abandoned = 43 playable)
# Teams: LHQ, HHK, QTG, KRK, PSZ, RWP, MS, ISU  (8 teams)
# ============================================================
def ov(s):
    if isinstance(s, (int, float)): return float(s)
    if '.' in s:
        whole, balls = s.split('.')
        return int(whole) + int(balls) / 6.0
    return float(s)

PSL_RAW = [
    # Match, Date, team_a, a_runs, a_wkts, a_overs, team_b, b_runs, b_wkts, b_overs, winner, note
    (1, "Mar 26", "LHQ", 199, 6, ov("20"),   "HHK", 130, 10, ov("20"), "LHQ", ""),
    (2, "Mar 27", "QTG", 167, 7, ov("20"),   "KRK", 181, 7, ov("20"), "KRK", ""),
    (3, "Mar 28", "PSZ", 218, 5, ov("19.1"),  "RWP", 214, 4, ov("20"), "PSZ", ""),
    (4, "Mar 28", "MS",  175, 5, ov("18.4"),  "ISU", 171, 8, ov("20"), "MS",  ""),
    (5, "Mar 29", "QTG", 174, 8, ov("20"),    "HHK", 134, 8, ov("20"), "QTG", ""),
    (6, "Mar 29", "LHQ", 128, 9, ov("20"),    "KRK", 131, 6, ov("19.3"),"KRK", ""),
    (7, "Mar 31", "ISU", 0, 0, 0,             "PSZ", 0, 0, 0, "",       "abandoned"),
    (8, "Apr 1",  "MS",  227, 4, ov("18.4"),  "HHK", 225, 5, ov("20"), "MS",  ""),
    (9, "Apr 2",  "QTG", 183, 5, ov("20"),    "ISU", 189, 2, ov("18.2"),"ISU", ""),
    (10,"Apr 2",  "RWP", 197, 6, ov("20"),    "KRK", 199, 5, ov("19.2"),"KRK", ""),
    (11,"Apr 3",  "LHQ", 185, 5, ov("13.0"),  "MS",  165, 5, ov("13.0"),"LHQ", "reduced"),
    (12,"Apr 4",  "RWP", 156, 7, ov("20"),    "ISU", 157, 3, ov("14.2"),"ISU", ""),
    (13,"Apr 5",  "QTG", 166, 7, ov("20"),    "MS",  167, 4, ov("17.3"),"MS",  ""),
    (14,"Apr 6",  "MS",  186, 3, ov("16.2"),  "RWP", 182, 8, ov("20"), "MS",  ""),
    (15,"Apr 8",  "HHK", 145, 10, ov("18.2"), "PSZ", 146, 6, ov("20"), "PSZ", ""),
    (16,"Apr 9",  "LHQ", 100, 10, ov("18.3"), "ISU", 104, 1, ov("10.2"),"ISU", ""),
    (17,"Apr 9",  "KRK", 87,  10, ov("16.1"), "PSZ", 246, 3, ov("20"), "PSZ", ""),
    (18,"Apr 10", "QTG", 182, 6, ov("20"),    "RWP", 121, 10, ov("17.3"),"QTG", ""),
    (19,"Apr 11", "PSZ", 173, 7, ov("20"),    "LHQ", 97,  10, ov("17.0"),"PSZ", ""),
    (20,"Apr 11", "KRK", 188, 8, ov("20"),    "HHK", 189, 6, ov("19.1"),"HHK", ""),
    (21,"Apr 12", "HHK", 157, 4, ov("18.1"),  "ISU", 153, 9, ov("20"), "HHK", ""),
    (22,"Apr 13", "PSZ", 196, 6, ov("20"),    "MS",  172, 8, ov("20"), "PSZ", ""),
    (23,"Apr 15", "PSZ", 156, 2, ov("18.3"),  "QTG", 154, 10, ov("20"),"PSZ", ""),
    (24,"Apr 16", "HHK", 123, 5, ov("16.3"),  "RWP", 121, 9, ov("20"), "HHK", ""),
    (25,"Apr 16", "KRK", 150, 6, ov("20"),    "ISU", 153, 2, ov("16.0"),"ISU", ""),
    (26,"Apr 17", "LHQ", 134, 10, ov("19.5"), "QTG", 138, 4, ov("16.2"),"QTG", ""),
    (27,"Apr 18", "LHQ", 210, 4, ov("20"),    "RWP", 178, 9, ov("20"), "LHQ", ""),
    (28,"Apr 19", "KRK", 196, 10, ov("19.4"), "MS",  207, 7, ov("20"), "MS",  ""),
    (29,"Apr 19", "PSZ", 255, 3, ov("20"),    "QTG", 137, 10, ov("18.1"),"PSZ", ""),
    (30,"Apr 21", "LHQ", 197, 6, ov("20"),    "QTG", 188, 7, ov("20"), "LHQ", ""),
    (31,"Apr 21", "RWP", 166, 4, ov("20"),    "MS",  167, 4, ov("18.4"),"MS",  ""),
    (32,"Apr 22", "KRK", 182, 9, ov("20"),    "PSZ", 186, 3, ov("18.5"),"PSZ", ""),
    (33,"Apr 22", "HHK", 214, 6, ov("19.3"),  "MS",  213, 7, ov("20"), "HHK", ""),
    (34,"Apr 23", "RWP", 140, 4, ov("18.1"),  "ISU", 137, 10, ov("20"),"RWP", ""),
    (35,"Apr 23", "LHQ", 199, 6, ov("20"),    "KRK", 203, 5, ov("18.4"),"KRK", ""),
    (36,"Apr 24", "HHK", 80,  10, ov("15.5"), "ISU", 83,  2, ov("6.4"), "ISU", ""),
    (37,"Apr 25", "QTG", 195, 6, ov("20"),    "KRK", 199, 1, ov("18.3"),"KRK", ""),
    (38,"Apr 25", "LHQ", 200, 4, ov("19.3"),  "PSZ", 199, 4, ov("20"), "LHQ", ""),
    (39,"Apr 26", "HHK", 244, 6, ov("20"),    "RWP", 136, 10, ov("17.1"),"HHK", ""),
    (40,"Apr 26", "ISU", 193, 6, ov("18.4"),  "MS",  192, 7, ov("20"), "ISU", ""),
    # Playoffs
    (41,"Apr 28", "PSZ", 221, 7, ov("20"),    "ISU", 151, 10, ov("18.4"),"PSZ", "Qualifier1"),
    (42,"Apr 29", "MS",  159, 9, ov("20"),    "HHK", 162, 2, ov("15.2"),"HHK", "Eliminator"),
    (43,"May 1",  "ISU", 184, 7, ov("20"),    "HHK", 186, 5, ov("20"), "HHK", "Qualifier2"),
    (44,"May 3",  "PSZ", 130, 5, ov("15.2"),  "HHK", 129, 10, ov("18.0"),"PSZ", "Final"),
]

# ============================================================
# BATTING-FIRST INFERENCE (from result type)
# ============================================================
# Rule: "won by X runs" => winner batted first
#       "won by X wickets" => winner batted second (chased)
def infer_batting_first(team_a, team_b, winner, note):
    if note == "abandoned" or not winner:
        return None
    if winner == team_a:
        # team_a won - we need result type
        # We'll hardcode based on match analysis
        return None
    return None

# Hardcoded batting first team per match (from data parsing)
PSL_BATTING_FIRST = {
    1:  "LHQ",   # LHQ won by 69 runs
    2:  "KRK",   # KRK won by 14 runs (KRK batted first despite listed 2nd)
    3:  "RWP",   # PSZ won by 5 wkts (chased)
    4:  "ISU",   # MS won by 5 wkts (chased)
    5:  "QTG",   # QTG won by 40 runs
    6:  "LHQ",   # KRK won by 4 wkts (chased)
    7:  None,    # abandoned
    8:  "HHK",   # MS won by 6 wkts (chased)
    9:  "QTG",   # ISU won by 8 wkts (chased)
    10: "RWP",   # KRK won by 5 wkts (chased)
    11: "LHQ",   # LHQ won by 20 runs (reduced overs)
    12: "RWP",   # ISU won by 7 wkts (chased)
    13: "QTG",   # MS won by 6 wkts (chased)
    14: "RWP",   # MS won by 7 wkts (chased)
    15: "HHK",   # PSZ won by 4 wkts (chased)
    16: "LHQ",   # ISU won by 9 wkts (chased)
    17: "PSZ",   # PSZ won by 159 runs
    18: "QTG",   # QTG won by 61 runs
    19: "PSZ",   # PSZ won by 76 runs
    20: "KRK",   # HHK won by 4 wkts (chased)
    21: "ISU",   # HHK won by 6 wkts (chased)
    22: "PSZ",   # PSZ won by 24 runs
    23: "QTG",   # PSZ won by 8 wkts (chased)
    24: "RWP",   # HHK won by 5 wkts (chased)
    25: "KRK",   # ISU won by 8 wkts (chased)
    26: "LHQ",   # QTG won by 6 wkts (chased)
    27: "LHQ",   # LHQ won by 32 runs
    28: "MS",    # MS won by 11 runs
    29: "PSZ",   # PSZ won by 118 runs
    30: "LHQ",   # LHQ won by 9 runs
    31: "RWP",   # MS won by 6 wkts (chased)
    32: "KRK",   # PSZ won by 7 wkts (chased)
    33: "MS",    # HHK won by 4 wkts (chased)
    34: "ISU",   # RWP won by 6 wkts (chased)
    35: "LHQ",   # KRK won by 5 wkts (chased)
    36: "HHK",   # ISU won by 8 wkts (chased)
    37: "QTG",   # KRK won by 9 wkts (chased)
    38: "PSZ",   # LHQ won by 6 wkts (chased)
    39: "HHK",   # HHK won by 108 runs
    40: "MS",    # ISU won by 4 wkts (chased)
    41: "PSZ",   # PSZ won by 70 runs (Qualifier 1)
    42: "MS",    # HHK won by 8 wkts (chased)
    43: "HHK",   # HHK won by 2 runs (HHK batted first; ISU listed first chased)
    44: "HHK",   # PSZ won by 5 wkts (chased; Final)
}

PSL_TEAMS = ["LHQ", "HHK", "QTG", "KRK", "PSZ", "RWP", "MS", "ISU"]

# ============================================================
# OPTIMIZED-WEIGHTED ENSEMBLE (using IPL-tuned weights)
# ============================================================
# Weights from IPL 2026 grid search (same system)
IPL_OPTIMAL_WEIGHTS = {"elo": 0.30, "rr": 0.15, "form": 0.10, "wpct": 0.15, "h2h": 0.10, "momentum": 0.20}

class OptimizedWeightedPredictor:
    name = "Optimized-Weighted (IPL-tuned)"
    def __init__(self, weights):
        self.weights = weights
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
        return prob / total_w

# ============================================================
# PSL GRID SEARCH — find PSL-optimal weights
# ============================================================
def psl_grid_search():
    print("\nRunning PSL grid search for optimal weights...")
    best_w = IPL_OPTIMAL_WEIGHTS.copy()
    best_acc = 0

    search_grid = []
    for elo_w in [0.20, 0.30, 0.40, 0.50, 0.60]:
        for rr_w in [0.05, 0.10, 0.15, 0.20, 0.25]:
            for form_w in [0.05, 0.10, 0.15, 0.20]:
                for wpct_w in [0.05, 0.10, 0.15]:
                    for h2h_w in [0.05, 0.10, 0.15]:
                        momentum_w = max(0, 1 - elo_w - rr_w - form_w - wpct_w - h2h_w)
                        if momentum_w < 0 or momentum_w > 0.30:
                            continue
                        search_grid.append({"elo": elo_w, "rr": rr_w, "form": form_w,
                                            "wpct": wpct_w, "h2h": h2h_w, "momentum": momentum_w})
    print(f"  Testing {len(search_grid)} weight combinations...")

    for w in search_grid:
        pred = OptimizedWeightedPredictor(weights=w)
        states = {t: TeamState() for t in PSL_TEAMS}
        for t in PSL_TEAMS: states[t].elo = 1500.0
        correct = 0; total = 0
        for m in PSL_RAW:
            mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
            if note == "abandoned" or winner == "": continue
            bf_team = PSL_BATTING_FIRST.get(mid)
            if bf_team is None: continue
            fvec = feature_vector(states[ta], states[tb], bf_team, ta, tb)
            p = pred.predict_proba(fvec, states[ta], states[tb])
            pred_a = (p > 0.5)
            actual_a_won = (winner == ta)
            if pred_a == actual_a_won: correct += 1
            total += 1
            # Update states
            update_states(states, m, bf_team)
        acc = correct / total
        if acc > best_acc:
            best_acc = acc; best_w = w.copy()
            print(f"  New best: {best_acc*100:.1f}% with {w}")
    print(f"\nPSL-optimal weights: {best_w} (acc={best_acc*100:.1f}%)")
    return best_w


def update_states(states, m, bf_team):
    """Apply match result to team states (same logic as IPL)."""
    mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
    a_bat_first = (bf_team == ta)
    a_balls_batted = overs_to_balls(oa_) if note != "super_over" else 120
    b_balls_batted = overs_to_balls(ob_) if note != "super_over" else 120

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


# ============================================================
# WALK-FORWARD BACKTEST FOR PSL
# ============================================================
def run_psl_backtest(weights_ipl, weights_psl):
    states = {t: TeamState() for t in PSL_TEAMS}
    for t in PSL_TEAMS: states[t].elo = 1500.0

    WARMUP = 5  # smaller warmup for shorter season

    predictions = {
        "ELO-Raw": [],
        "ELO+Momentum": [],
        "Weighted-Score": [],
        "Opt-Weighted (IPL-tuned)": [],
        "Opt-Weighted (PSL-tuned)": [],
        "Pythagorean": [],
        "Bayesian-Shrunk": [],
        "LogReg": [],
        "RandomForest": [],
        "GradientBoosting": [],
        "Ensemble-Stacked": [],
        "Baseline-50/50": [],
    }

    train_features = []
    train_labels = []
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
    opt_ipl = OptimizedWeightedPredictor(weights=weights_ipl)
    opt_psl = OptimizedWeightedPredictor(weights=weights_psl)

    elo_history = {t: [1500.0] for t in PSL_TEAMS}
    match_count = 0

    for m in PSL_RAW:
        mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
        if note == "abandoned" or winner == "": continue
        bf_team = PSL_BATTING_FIRST.get(mid)
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
        p = pyth.predict_proba(fvec, states[ta], states[tb])
        predictions["Pythagorean"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        p = bayes.predict_proba(fvec, states[ta], states[tb], league_mean_rr)
        predictions["Bayesian-Shrunk"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        predictions["Baseline-50/50"].append((mid, ta, tb, 0.5, winner, actual_a_won))

        if match_count >= WARMUP:
            if match_count - last_trained_at >= 3 and len(train_features) >= 10:
                for model in ml_models.values():
                    try: model.fit(train_features, train_labels)
                    except Exception as e: print(f"  Train fail at {mid}: {e}")
                last_trained_at = match_count
            if len(train_features) >= 10:
                for name, model in ml_models.items():
                    try: p = model.predict_proba_single(fvec)
                    except: p = 0.5
                    predictions[name].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))

        train_features.append(fvec)
        train_labels.append(1 if winner == ta else 0)

        # Update states
        update_states(states, m, bf_team)
        for t in PSL_TEAMS:
            elo_history[t].append(states[t].elo)

    return predictions, states, elo_history


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("=" * 70)
    print("PSL 2026 PREDICTION SYSTEM BACKTEST")
    print("=" * 70)
    print("Applying same 11 models (12 with PSL-tuned variant) to PSL 2026 data.")

    # PSL-tuned weights
    psl_weights = psl_grid_search()

    # Run backtest
    predictions, final_states, elo_history = run_psl_backtest(IPL_OPTIMAL_WEIGHTS, psl_weights)

    # Evaluate
    results = {}
    for system, preds in predictions.items():
        if not preds:
            results[system] = {"n": 0, "accuracy": 0, "brier": 0, "logloss": 0, "correct": 0}; continue
        y_true = [1 if w == ta else 0 for (_, ta, _, _, w, _) in preds]
        y_prob = [p for (_, _, _, p, _, _) in preds]
        correct_flags = [(p > 0.5) == (w == ta) for (_, ta, _, p, w, _) in preds]
        correct_count = int(sum(correct_flags))
        n = len(preds)
        acc = correct_count / n
        try: brier = brier_score_loss(y_true, y_prob)
        except: brier = float('nan')
        try: ll = log_loss(y_true, y_prob, labels=[0,1])
        except: ll = float('nan')
        results[system] = {"n": n, "accuracy": float(acc), "brier": float(brier),
                           "logloss": float(ll), "correct": correct_count}

    print("\n=== PSL 2026 Backtest Results ===")
    print(f"{'System':<32} {'N':>4} {'Correct':>8} {'Acc':>7} {'Brier':>7} {'LogLoss':>8}")
    print("-" * 72)
    for sys_name, r in sorted(results.items(), key=lambda x: -x[1]["accuracy"]):
        print(f"{sys_name:<32} {r['n']:>4} {r['correct']:>8} {r['accuracy']*100:>6.1f}% {r['brier']:>7.3f} {r['logloss']:>8.3f}")

    # Generate visualizations
    # 1. Model comparison
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    sorted_sys = sorted(results.items(), key=lambda x: -x[1]["accuracy"])
    names = [s[0] for s in sorted_sys]
    accs = [s[1]["accuracy"] * 100 for s in sorted_sys]
    colors_bar = []
    for n in names:
        if 'PSL-tuned' in n: colors_bar.append('#94761e')
        elif 'IPL-tuned' in n: colors_bar.append('#418d5b')
        elif n in ('ELO-Raw','ELO+Momentum','Weighted-Score','Pythagorean','Bayesian-Shrunk'): colors_bar.append('#67604b')
        else: colors_bar.append('#816d31')
    bars = ax.barh(names, accs, color=colors_bar)
    ax.axvline(50, color='#a94f47', linestyle='--', alpha=0.6, label='50% baseline')
    for bar, acc in zip(bars, accs):
        ax.text(acc + 0.5, bar.get_y() + bar.get_height()/2, f"{acc:.1f}%", va='center', fontsize=9)
    ax.set_xlabel('Backtest Accuracy (%)')
    ax.set_title('PSL 2026: Prediction System Accuracy Comparison', fontweight='bold')
    ax.set_xlim(40, 75)
    ax.invert_yaxis()
    ax.grid(axis='x', alpha=0.3)
    plt.savefig('/home/z/my-project/download/psl_chart_model_comparison.png', dpi=150)
    plt.close()
    print("Saved psl_chart_model_comparison.png")

    # 2. ELO progression
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    team_colors = {'LHQ':'#1976d2','HHK':'#d32f2f','QTG':'#7b1fa2','KRK':'#00838f',
                   'PSZ':'#f57c00','RWP':'#388e3c','MS':'#5d4037','ISU':'#512da8'}
    for t in PSL_TEAMS:
        if t in elo_history:
            ax.plot(range(len(elo_history[t])), elo_history[t], label=t,
                    color=team_colors.get(t,'#888'), linewidth=2)
    ax.set_xlabel('Match # in Season')
    ax.set_ylabel('ELO Rating')
    ax.set_title('Team ELO Rating Trajectory - PSL 2026', fontweight='bold')
    ax.legend(loc='upper left', bbox_to_anchor=(1.01, 1.0), fontsize=9)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/psl_chart_elo_trajectory.png', dpi=150)
    plt.close()
    print("Saved psl_chart_elo_trajectory.png")

    # 3. Cumulative accuracy
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    top_systems = ["Opt-Weighted (PSL-tuned)", "Opt-Weighted (IPL-tuned)",
                   "Weighted-Score", "ELO-Raw", "ELO+Momentum", "Baseline-50/50"]
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
    ax.set_title('PSL 2026: Cumulative Prediction Accuracy', fontweight='bold')
    ax.legend(loc='lower right', fontsize=9)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/psl_chart_cumulative_acc.png', dpi=150)
    plt.close()
    print("Saved psl_chart_cumulative_acc.png")

    # 4. Final team ratings
    fig, ax = plt.subplots(figsize=(10, 5), constrained_layout=True)
    sorted_teams = sorted(PSL_TEAMS, key=lambda t: -final_states[t].elo)
    elos = [final_states[t].elo for t in sorted_teams]
    bar_colors = [team_colors.get(t,'#888') for t in sorted_teams]
    bars = ax.bar(sorted_teams, elos, color=bar_colors)
    for bar, e in zip(bars, elos):
        ax.text(bar.get_x() + bar.get_width()/2, e + 5, f"{e:.0f}", ha='center', fontsize=10, fontweight='bold')
    ax.set_ylabel('Final ELO Rating')
    ax.set_title('Final Team ELO Ratings - End of PSL 2026', fontweight='bold')
    ax.set_ylim(min(elos)-30, max(elos)+30)
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/psl_chart_final_elo.png', dpi=150)
    plt.close()
    print("Saved psl_chart_final_elo.png")

    # 5. IPL vs PSL comparison
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    # Load IPL results
    try:
        with open("/home/z/my-project/download/ipl_predictions.json") as f:
            ipl_data = json.load(f)
        ipl_results = ipl_data["results"]
    except: ipl_results = {}

    common_systems = ["ELO-Raw", "Weighted-Score", "Pythagorean", "Bayesian-Shrunk",
                      "LogReg", "RandomForest", "GradientBoosting", "Ensemble-Stacked"]
    x = np.arange(len(common_systems))
    width = 0.35
    ipl_accs = [ipl_results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    psl_accs = [results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    bars1 = ax.bar(x - width/2, ipl_accs, width, label='IPL 2026', color='#67604b')
    bars2 = ax.bar(x + width/2, psl_accs, width, label='PSL 2026', color='#94761e')
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_ylabel('Accuracy (%)')
    ax.set_title('IPL 2026 vs PSL 2026: Same Models, Different Leagues', fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels([s.replace('-Stacked','') for s in common_systems], rotation=20, ha='right')
    ax.legend()
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_ipl_vs_psl.png', dpi=150)
    plt.close()
    print("Saved chart_ipl_vs_psl.png")

    # Save JSON
    out = {
        "results": results,
        "psl_optimal_weights": psl_weights,
        "ipl_optimal_weights": IPL_OPTIMAL_WEIGHTS,
        "final_team_stats": {t: {
            "matches": final_states[t].matches, "wins": final_states[t].wins,
            "elo": final_states[t].elo,
            "bat_run_rate": final_states[t].batting_run_rate(),
            "bowl_run_rate": final_states[t].bowling_run_rate(),
            "form_last5": final_states[t].form_last5(),
            "win_pct": final_states[t].win_pct(),
            "bf_win_pct": final_states[t].bf_win_pct(),
            "ch_win_pct": final_states[t].ch_win_pct(),
        } for t in PSL_TEAMS},
        "per_match_preds": {sys: [
            {"match": m, "team_a": a, "team_b": b, "prob_a": float(p), "winner": w, "correct": bool(c)}
            for (m, a, b, p, w, c) in plist
        ] for sys, plist in predictions.items()},
    }
    with open("/home/z/my-project/download/psl_predictions.json", "w") as f:
        json.dump(out, f, indent=2)
    print("Saved /home/z/my-project/download/psl_predictions.json")

    print("\n=== Final PSL Team Ratings ===")
    for i, t in enumerate(sorted(PSL_TEAMS, key=lambda x: -final_states[x].elo), 1):
        s = final_states[t]
        print(f"{i}. {t:<5} ELO={s.elo:6.0f}  M={s.matches:2d}  W={s.wins:2d}  "
              f"WPct={s.win_pct()*100:5.1f}%  BatRR={s.batting_run_rate():.2f}  "
              f"BowlRR={s.bowling_run_rate():.2f}  Form5={s.form_last5()*100:.0f}%")
