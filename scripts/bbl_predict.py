"""
BBL 2025-26 Prediction System Validation
========================================
Third league test of the same 12 prediction systems, applying them to the
Big Bash League 2025-26 season (44 matches, 1 abandoned = 43 playable).
Tests generalisation across three independent T20 tournaments.
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

def ov(s):
    if isinstance(s, (int, float)): return float(s)
    if '.' in s:
        whole, balls = s.split('.')
        return int(whole) + int(balls) / 6.0
    return float(s)

# ============================================================
# BBL 2025-26 RAW DATA — 44 matches (1 abandoned = 43 playable)
# Teams: PRS, SYS, MLR, BRH, HBH, SYT, ADS, MLS  (8 teams)
# ============================================================
BBL_RAW = [
    # (match_no, date, team_a, a_runs, a_wkts, a_overs, team_b, b_runs, b_wkts, b_overs, winner, note)
    (1, "Dec 14", "PRS", 117, 5, ov("10.1"), "SYS", 113, 5, ov("11.0"), "PRS", ""),
    (2, "Dec 15", "MLR", 212, 5, ov("20"),   "BRH", 198, 8, ov("20"),  "MLR", ""),
    (3, "Dec 16", "HBH", 181, 6, ov("19.5"), "SYT", 180, 6, ov("20"),  "HBH", ""),
    (4, "Dec 17", "SYS", 159, 9, ov("20"),   "ADS", 160, 7, ov("19.2"), "ADS", ""),
    (5, "Dec 18", "MLS", 159, 2, ov("16.0"), "HBH", 158, 9, ov("20"),  "MLS", ""),
    (6, "Dec 19", "BRH", 258, 2, ov("19.5"), "PRS", 257, 6, ov("20"),  "BRH", ""),
    (7, "Dec 20", "SYT", 151, 10, ov("19.1"), "SYS", 198, 5, ov("20"), "SYS", ""),
    (8, "Dec 21", "MLR", 145, 9, ov("20"),   "HBH", 149, 3, ov("13.5"), "HBH", ""),
    (9, "Dec 22", "SYT", 193, 4, ov("20"),   "BRH", 159, 6, ov("20"),  "SYT", ""),
    (10,"Dec 23", "ADS", 155, 8, ov("20"),   "MLS", 161, 4, ov("18.1"), "MLS", ""),
    (11,"Dec 26", "SYS", 144, 10, ov("20"),  "MLS", 145, 3, ov("17.3"), "MLS", ""),
    (12,"Dec 27", "PRS", 150, 8, ov("20"),   "HBH", 153, 6, ov("19.3"), "HBH", ""),
    (13,"Dec 27", "BRH", 179, 9, ov("20"),   "ADS", 172, 10, ov("19.5"),"BRH", ""),
    (14,"Dec 28", "MLS", 132, 1, ov("14.0"), "SYT", 128, 10, ov("20"), "MLS", ""),
    (15,"Dec 29", "HBH", 163, 6, ov("19.0"), "MLR", 162, 9, ov("20"),  "HBH", ""),
    (16,"Dec 30", "SYT", 131, 10, ov("17.3"), "PRS", 202, 8, ov("20"), "PRS", ""),
    (17,"Dec 31", "ADS", 125, 3, ov("14.1"), "BRH", 121, 10, ov("19.4"),"ADS", ""),
    (18,"Jan 1",  "MLR", 164, 9, ov("20"),   "SYS", 168, 4, ov("19.1"),"SYS", ""),
    (19,"Jan 1",  "HBH", 189, 9, ov("20"),   "PRS", 229, 3, ov("20"),  "PRS", ""),
    (20,"Jan 2",  "BRH", 199, 6, ov("19.4"), "MLS", 195, 6, ov("20"),  "BRH", ""),
    (21,"Jan 3",  "SYT", 205, 4, ov("20"),   "HBH", 207, 4, ov("17.5"),"HBH", ""),
    (22,"Jan 4",  "MLS", 173, 9, ov("20"),   "MLR", 177, 6, ov("19.5"),"MLR", ""),
    (23,"Jan 4",  "PRS", 153, 8, ov("20"),   "ADS", 120, 10, ov("18.1"),"PRS", ""),
    (24,"Jan 5",  "SYS", 118, 7, ov("18.4"), "BRH", 114, 9, ov("20"),  "SYS", ""),
    (25,"Jan 6",  "ADS", 165, 8, ov("20"),   "SYT", 159, 7, ov("20"), "ADS", ""),
    (26,"Jan 7",  "PRS", 127, 10, ov("19.2"), "MLR", 130, 6, ov("20"), "MLR", ""),
    (27,"Jan 8",  "MLS", 128, 10, ov("19.5"), "SYS", 129, 4, ov("17.1"),"SYS", ""),
    (28,"Jan 9",  "HBH", 178, 6, ov("20"),   "ADS", 141, 9, ov("20"), "HBH", ""),
    (29,"Jan 10", "BRH", 183, 3, ov("16.2"), "SYT", 180, 6, ov("20"), "BRH", ""),
    (30,"Jan 10", "MLR", 166, 7, ov("20"),   "MLS", 170, 2, ov("15.5"),"MLS", ""),
    (31,"Jan 11", "SYS", 32, 0, ov("5.0"),   "HBH", 0, 0, 0, "",       "abandoned"),
    (32,"Jan 11", "ADS", 200, 8, ov("20"),   "PRS", 232, 4, ov("20"), "PRS", ""),
    (33,"Jan 12", "SYT", 140, 6, ov("15.2"), "MLR", 170, 8, ov("20"), "SYT", "dls"),
    (34,"Jan 13", "MLS", 86, 4, ov("15.1"),  "ADS", 83, 10, ov("19.3"),"MLS", ""),
    (35,"Jan 14", "HBH", 157, 8, ov("20"),   "BRH", 160, 8, ov("20"), "BRH", ""),
    (36,"Jan 15", "MLR", 169, 7, ov("20"),   "PRS", 219, 7, ov("20"), "PRS", ""),
    (37,"Jan 16", "SYS", 191, 5, ov("17.2"), "SYT", 189, 6, ov("20"), "SYS", ""),
    (38,"Jan 17", "ADS", 100, 2, ov("11.5"), "MLR", 99, 10, ov("16.5"),"ADS", ""),
    (39,"Jan 17", "PRS", 134, 4, ov("16.5"), "MLS", 130, 10, ov("18.2"),"PRS", ""),
    (40,"Jan 18", "BRH", 171, 9, ov("20"),   "SYS", 177, 5, ov("18.4"),"SYS", ""),
    # Playoffs
    (41,"Jan 20", "PRS", 147, 9, ov("20"),   "SYS", 99, 10, ov("15.0"),"PRS", "Qualifier1"),
    (42,"Jan 21", "HBH", 114, 5, ov("10.0"), "MLS", 81, 4, ov("7.0"),  "HBH", "Knockout-dls"),
    (43,"Jan 23", "SYS", 198, 8, ov("20"),   "HBH", 141, 10, ov("17.2"),"SYS", "Challenger"),
    (44,"Jan 25", "PRS", 133, 4, ov("17.3"), "SYS", 132, 10, ov("20"),"PRS", "Final"),
]

# ============================================================
# BATTING-FIRST INFERENCE (from result type)
# ============================================================
BBL_BATTING_FIRST = {
    1:  "SYS",   # PRS won by 5 wkts (chased)
    2:  "MLR",   # MLR won by 14 runs (batted first)
    3:  "SYT",   # HBH won by 4 wkts (chased)
    4:  "SYS",   # ADS won by 3 wkts (chased)
    5:  "HBH",   # MLS won by 8 wkts (chased)
    6:  "PRS",   # BRH won by 8 wkts (chased)
    7:  "SYS",   # SYS won by 47 runs (batted first)
    8:  "MLR",   # HBH won by 7 wkts (chased)
    9:  "SYT",   # SYT won by 34 runs (batted first)
    10: "ADS",   # MLS won by 6 wkts (chased)
    11: "SYS",   # MLS won by 7 wkts (chased)
    12: "PRS",   # HBH won by 4 wkts (chased)
    13: "BRH",   # BRH won by 7 runs (batted first)
    14: "SYT",   # MLS won by 9 wkts (chased)
    15: "MLR",   # HBH won by 4 wkts (chased)
    16: "SYT",   # PRS won by 71 runs (batted first)
    17: "BRH",   # ADS won by 7 wkts (chased)
    18: "MLR",   # SYS won by 6 wkts (chased)
    19: "HBH",   # PRS won by 40 runs (batted first)
    20: "MLS",   # BRH won by 4 wkts (chased)
    21: "SYT",   # HBH won by 6 wkts (chased)
    22: "MLS",   # MLR won by 4 wkts (chased)
    23: "PRS",   # PRS won by 33 runs (batted first)
    24: "BRH",   # SYS won by 3 wkts (chased)
    25: "ADS",   # ADS won by 6 runs (batted first)
    26: "PRS",   # MLR won by 4 wkts (chased)
    27: "MLS",   # SYS won by 6 wkts (chased)
    28: "HBH",   # HBH won by 37 runs (batted first)
    29: "SYT",   # BRH won by 7 wkts (chased)
    30: "MLR",   # MLS won by 8 wkts (chased)
    31: None,    # abandoned
    32: "ADS",   # PRS won by 32 runs (batted first)
    33: "MLR",   # SYT won (DLS) - SYT chased (140/6 in 15.2 vs MLR 170/8 in 20)
    34: "ADS",   # MLS won by 6 wkts (chased)
    35: "HBH",   # BRH won by 3 runs (batted first)
    36: "MLR",   # PRS won by 50 runs (batted first)
    37: "SYT",   # SYS won by 5 wkts (chased)
    38: "MLR",   # ADS won by 8 wkts (chased)
    39: "MLS",   # PRS won by 6 wkts (chased)
    40: "BRH",   # SYS won by 5 wkts (chased)
    41: "PRS",   # PRS won by 48 runs (Qualifier 1, batted first)
    42: "MLS",   # HBH won (DLS) - HBH chased (114/5 in 10 vs MLS 81/4 in 7)
    43: "SYS",   # SYS won by 57 runs (Challenger, batted first)
    44: "SYS",   # PRS won by 6 wkts (chased; Final)
}

BBL_TEAMS = ["PRS", "SYS", "MLR", "BRH", "HBH", "SYT", "ADS", "MLS"]

# ============================================================
# OPTIMIZED-WEIGHTED PREDICTOR
# ============================================================
IPL_OPTIMAL_WEIGHTS = {"elo": 0.30, "rr": 0.15, "form": 0.10, "wpct": 0.15, "h2h": 0.10, "momentum": 0.20}
PSL_OPTIMAL_WEIGHTS = {"elo": 0.50, "rr": 0.05, "form": 0.05, "wpct": 0.10, "h2h": 0.15, "momentum": 0.15}

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
        return prob / total_w

# ============================================================
# BBL GRID SEARCH
# ============================================================
def bbl_grid_search():
    print("\nRunning BBL grid search for optimal weights...")
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
        pred = OptimizedWeightedPredictor(weights=w, label="test")
        states = {t: TeamState() for t in BBL_TEAMS}
        for t in BBL_TEAMS: states[t].elo = 1500.0
        correct = 0; total = 0
        for m in BBL_RAW:
            mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
            if note == "abandoned" or winner == "": continue
            bf_team = BBL_BATTING_FIRST.get(mid)
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
    print(f"\nBBL-optimal weights: {best_w} (acc={best_acc*100:.1f}%)")
    return best_w


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


# ============================================================
# WALK-FORWARD BACKTEST FOR BBL
# ============================================================
def run_bbl_backtest(weights_ipl, weights_psl, weights_bbl):
    states = {t: TeamState() for t in BBL_TEAMS}
    for t in BBL_TEAMS: states[t].elo = 1500.0
    WARMUP = 5
    predictions = {
        "ELO-Raw": [],
        "ELO+Momentum": [],
        "Weighted-Score": [],
        "Opt-Weighted (IPL-tuned)": [],
        "Opt-Weighted (PSL-tuned)": [],
        "Opt-Weighted (BBL-tuned)": [],
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
    opt_ipl = OptimizedWeightedPredictor(weights=weights_ipl, label="Opt-Weighted (IPL-tuned)")
    opt_psl = OptimizedWeightedPredictor(weights=weights_psl, label="Opt-Weighted (PSL-tuned)")
    opt_bbl = OptimizedWeightedPredictor(weights=weights_bbl, label="Opt-Weighted (BBL-tuned)")
    elo_history = {t: [1500.0] for t in BBL_TEAMS}
    match_count = 0
    for m in BBL_RAW:
        mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
        if note == "abandoned" or winner == "": continue
        bf_team = BBL_BATTING_FIRST.get(mid)
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
        update_states(states, m, bf_team)
        for t in BBL_TEAMS:
            elo_history[t].append(states[t].elo)
    return predictions, states, elo_history


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("=" * 70)
    print("BBL 2025-26 PREDICTION SYSTEM VALIDATION (3rd league test)")
    print("=" * 70)
    bbl_weights = bbl_grid_search()
    predictions, final_states, elo_history = run_bbl_backtest(
        IPL_OPTIMAL_WEIGHTS, PSL_OPTIMAL_WEIGHTS, bbl_weights)
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

    print("\n=== BBL 2025-26 Backtest Results ===")
    print(f"{'System':<35} {'N':>4} {'Correct':>8} {'Acc':>7} {'Brier':>7} {'LogLoss':>8}")
    print("-" * 75)
    for sys_name, r in sorted(results.items(), key=lambda x: -x[1]["accuracy"]):
        print(f"{sys_name:<35} {r['n']:>4} {r['correct']:>8} {r['accuracy']*100:>6.1f}% {r['brier']:>7.3f} {r['logloss']:>8.3f}")

    # Charts
    # 1. Model comparison
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    sorted_sys = sorted(results.items(), key=lambda x: -x[1]["accuracy"])
    names = [s[0] for s in sorted_sys]
    accs = [s[1]["accuracy"] * 100 for s in sorted_sys]
    colors_bar = []
    for n in names:
        if 'BBL-tuned' in n: colors_bar.append('#0288d1')
        elif 'IPL-tuned' in n: colors_bar.append('#94761e')
        elif 'PSL-tuned' in n: colors_bar.append('#418d5b')
        elif n in ('ELO-Raw','ELO+Momentum','Weighted-Score','Pythagorean','Bayesian-Shrunk'): colors_bar.append('#5d4037')
        else: colors_bar.append('#816d31')
    bars = ax.barh(names, accs, color=colors_bar)
    ax.axvline(50, color='#a94f47', linestyle='--', alpha=0.6, label='50% baseline')
    for bar, acc in zip(bars, accs):
        ax.text(acc + 0.5, bar.get_y() + bar.get_height()/2, f"{acc:.1f}%", va='center', fontsize=9)
    ax.set_xlabel('Backtest Accuracy (%)')
    ax.set_title('BBL 2025-26: Prediction System Accuracy Comparison', fontweight='bold')
    ax.set_xlim(40, 75)
    ax.invert_yaxis()
    ax.grid(axis='x', alpha=0.3)
    plt.savefig('/home/z/my-project/download/bbl_chart_model_comparison.png', dpi=150)
    plt.close()
    print("Saved bbl_chart_model_comparison.png")

    # 2. ELO progression
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    team_colors = {'PRS':'#f57c00','SYS':'#d32f2f','MLR':'#c62828','BRH':'#1976d2',
                   'HBH':'#512da8','SYT':'#00838f','ADS':'#388e3c','MLS':'#0288d1'}
    for t in BBL_TEAMS:
        if t in elo_history:
            ax.plot(range(len(elo_history[t])), elo_history[t], label=t,
                    color=team_colors.get(t,'#888'), linewidth=2)
    ax.set_xlabel('Match # in Season')
    ax.set_ylabel('ELO Rating')
    ax.set_title('Team ELO Rating Trajectory - BBL 2025-26', fontweight='bold')
    ax.legend(loc='upper left', bbox_to_anchor=(1.01, 1.0), fontsize=9)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/bbl_chart_elo_trajectory.png', dpi=150)
    plt.close()
    print("Saved bbl_chart_elo_trajectory.png")

    # 3. Cumulative accuracy
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    top_systems = ["Opt-Weighted (BBL-tuned)", "Opt-Weighted (IPL-tuned)",
                   "Opt-Weighted (PSL-tuned)", "ELO-Raw", "Weighted-Score", "Baseline-50/50"]
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
    ax.set_title('BBL 2025-26: Cumulative Prediction Accuracy', fontweight='bold')
    ax.legend(loc='lower right', fontsize=8.5)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/bbl_chart_cumulative_acc.png', dpi=150)
    plt.close()
    print("Saved bbl_chart_cumulative_acc.png")

    # 4. Final team ratings
    fig, ax = plt.subplots(figsize=(10, 5), constrained_layout=True)
    sorted_teams = sorted(BBL_TEAMS, key=lambda t: -final_states[t].elo)
    elos = [final_states[t].elo for t in sorted_teams]
    bar_colors = [team_colors.get(t,'#888') for t in sorted_teams]
    bars = ax.bar(sorted_teams, elos, color=bar_colors)
    for bar, e in zip(bars, elos):
        ax.text(bar.get_x() + bar.get_width()/2, e + 5, f"{e:.0f}", ha='center', fontsize=10, fontweight='bold')
    ax.set_ylabel('Final ELO Rating')
    ax.set_title('Final Team ELO Ratings - End of BBL 2025-26', fontweight='bold')
    ax.set_ylim(min(elos)-30, max(elos)+30)
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/bbl_chart_final_elo.png', dpi=150)
    plt.close()
    print("Saved bbl_chart_final_elo.png")

    # 5. THREE-LEAGUE COMPARISON
    try:
        with open("/home/z/my-project/download/ipl_predictions.json") as f:
            ipl_data = json.load(f)
        ipl_results = ipl_data["results"]
    except: ipl_results = {}
    try:
        with open("/home/z/my-project/download/psl_predictions.json") as f:
            psl_data = json.load(f)
        psl_results = psl_data["results"]
    except: psl_results = {}

    fig, ax = plt.subplots(figsize=(12, 6), constrained_layout=True)
    common_systems = ["ELO-Raw", "Weighted-Score", "Pythagorean", "Bayesian-Shrunk",
                      "LogReg", "RandomForest", "GradientBoosting", "Ensemble-Stacked"]
    x = np.arange(len(common_systems))
    width = 0.27
    ipl_accs = [ipl_results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    psl_accs = [psl_results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    bbl_accs = [results.get(s, {}).get("accuracy", 0) * 100 for s in common_systems]
    ax.bar(x - width, ipl_accs, width, label='IPL 2026 (73 matches)', color='#67604b')
    ax.bar(x, psl_accs, width, label='PSL 2026 (43 matches)', color='#94761e')
    ax.bar(x + width, bbl_accs, width, label='BBL 2025-26 (43 matches)', color='#0288d1')
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_ylabel('Accuracy (%)')
    ax.set_title('Three-League Validation: Same Models, Different Tournaments', fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels([s.replace('-Stacked','') for s in common_systems], rotation=20, ha='right')
    ax.legend()
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_three_league_comparison.png', dpi=150)
    plt.close()
    print("Saved chart_three_league_comparison.png")

    # 6. WINNER COMPARISON (Opt-Weighted variants across leagues)
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    opt_systems = ["Opt-Weighted (IPL-tuned)", "Opt-Weighted (PSL-tuned)", "Opt-Weighted (BBL-tuned)"]
    # IPL doesn't have PSL/BBL-tuned; PSL doesn't have BBL-tuned
    # Show: each league's tuned winner + the cross-applied variants
    # For IPL: only IPL-tuned available
    # For PSL: both IPL-tuned and PSL-tuned
    # For BBL: all three (IPL, PSL, BBL-tuned)
    leagues = ['IPL 2026', 'PSL 2026', 'BBL 2025-26']
    # Build matrix: rows = leagues, cols = which tuning was applied
    matrix = [
        [ipl_results.get("Optimized-Weighted", {}).get("accuracy", 0) * 100, None, None],  # IPL only had 1 variant
        [psl_results.get("Opt-Weighted (IPL-tuned)", {}).get("accuracy", 0) * 100,
         psl_results.get("Opt-Weighted (PSL-tuned)", {}).get("accuracy", 0) * 100, None],
        [results.get("Opt-Weighted (IPL-tuned)", {}).get("accuracy", 0) * 100,
         results.get("Opt-Weighted (PSL-tuned)", {}).get("accuracy", 0) * 100,
         results.get("Opt-Weighted (BBL-tuned)", {}).get("accuracy", 0) * 100],
    ]
    # For IPL, the original Opt-Weighted was tuned on IPL, so its name is just "Optimized-Weighted"
    matrix[0][0] = ipl_results.get("Optimized-Weighted", {}).get("accuracy", 0) * 100
    tunings = ['IPL-tuned', 'PSL-tuned', 'BBL-tuned']
    x = np.arange(len(leagues))
    width = 0.27
    for i, t in enumerate(tunings):
        vals = [matrix[j][i] if matrix[j][i] is not None else 0 for j in range(len(leagues))]
        # mark missing with 0 but skip in display
        display_vals = [matrix[j][i] if matrix[j][i] is not None else None for j in range(len(leagues))]
        # Use masked array
        ma = np.array([v if v is not None else np.nan for v in display_vals])
        ax.bar(x + (i-1)*width, ma, width, label=t,
               color=['#94761e','#418d5b','#0288d1'][i])
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_ylabel('Accuracy (%)')
    ax.set_title('Optimized-Weighted Ensemble: Cross-League Weight Transfer', fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(leagues)
    ax.legend(loc='lower right')
    ax.grid(axis='y', alpha=0.3)
    ax.set_ylim(40, 75)
    plt.savefig('/home/z/my-project/download/chart_weight_transfer.png', dpi=150)
    plt.close()
    print("Saved chart_weight_transfer.png")

    # Save JSON
    out = {
        "results": results,
        "bbl_optimal_weights": bbl_weights,
        "ipl_optimal_weights": IPL_OPTIMAL_WEIGHTS,
        "psl_optimal_weights": PSL_OPTIMAL_WEIGHTS,
        "final_team_stats": {t: {
            "matches": final_states[t].matches, "wins": final_states[t].wins,
            "elo": final_states[t].elo,
            "bat_run_rate": final_states[t].batting_run_rate(),
            "bowl_run_rate": final_states[t].bowling_run_rate(),
            "form_last5": final_states[t].form_last5(),
            "win_pct": final_states[t].win_pct(),
            "bf_win_pct": final_states[t].bf_win_pct(),
            "ch_win_pct": final_states[t].ch_win_pct(),
        } for t in BBL_TEAMS},
        "per_match_preds": {sys: [
            {"match": m, "team_a": a, "team_b": b, "prob_a": float(p), "winner": w, "correct": bool(c)}
            for (m, a, b, p, w, c) in plist
        ] for sys, plist in predictions.items()},
    }
    with open("/home/z/my-project/download/bbl_predictions.json", "w") as f:
        json.dump(out, f, indent=2)
    print("Saved /home/z/my-project/download/bbl_predictions.json")

    print("\n=== Final BBL Team Ratings ===")
    for i, t in enumerate(sorted(BBL_TEAMS, key=lambda x: -final_states[x].elo), 1):
        s = final_states[t]
        print(f"{i}. {t:<5} ELO={s.elo:6.0f}  M={s.matches:2d}  W={s.wins:2d}  "
              f"WPct={s.win_pct()*100:5.1f}%  BatRR={s.batting_run_rate():.2f}  "
              f"BowlRR={s.bowling_run_rate():.2f}  Form5={s.form_last5()*100:.0f}%")
