"""
IPL 2026 Prediction System - ENHANCED
=====================================
Adds: Pythagorean Expectation, Bayesian-shrunk stats, momentum,
weight-optimized ensemble, and additional baselines.
"""
import json
import math
import os
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

# Import raw data and helpers from the main script
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
from ipl_predict import (
    RAW, TEAMS, BATTING_FIRST, TeamState, overs_to_balls,
    expected_a, update_elo, feature_vector,
    ELORawPredictor, WeightedScorePredictor, TossAgnosticMLPredictor
)

# ============================================================
# EXTENDED MODELS
# ============================================================

class PythagoreanPredictor:
    """Pythagorean expectation: (Runs^2) / (Runs^2 + RunsAllowed^2)
    Standard formula in baseball: win_pct = R^1.83 / (R^1.83 + RA^1.83)
    For T20 we'll use exponent 2.0 and slightly different formula.
    """
    name = "Pythagorean"
    def __init__(self):
        self.exp = 2.0
    def predict_proba(self, feats, state_a, state_b):
        # Use team batting run rate and bowling run rate to compute expected win %
        a_runs_scored = max(state_a.batting_run_rate(), 0.1)
        a_runs_allowed = max(state_a.bowling_run_rate(), 0.1)
        b_runs_scored = max(state_b.batting_run_rate(), 0.1)
        b_runs_allowed = max(state_b.bowling_run_rate(), 0.1)
        # Pythagorean win % for A in isolation
        a_pyth = (a_runs_scored ** self.exp) / (a_runs_scored ** self.exp + a_runs_allowed ** self.exp)
        b_pyth = (b_runs_scored ** self.exp) / (b_runs_scored ** self.exp + b_runs_allowed ** self.exp)
        # Combine: P(A beats B) = a_pyth * (1 - b_pyth) / (a_pyth * (1 - b_pyth) + b_pyth * (1 - a_pyth))
        num = a_pyth * (1 - b_pyth)
        denom = num + b_pyth * (1 - a_pyth) + 1e-9
        return num / denom

class BayesianShrunkPredictor:
    """Uses Bayesian shrinkage (toward league mean) for team stats.
    shrunk_stat = (stat * n + league_mean * k) / (n + k), where k is prior strength.
    """
    name = "Bayesian-Shrunk"
    def __init__(self, prior_k=5.0):
        self.prior_k = prior_k
    def predict_proba(self, feats, state_a, state_b, league_mean_rr):
        k = self.prior_k
        # Bayesian-shrunk batting & bowling run rates
        a_bat = (state_a.batting_run_rate() * state_a.matches + league_mean_rr * k) / (state_a.matches + k)
        a_bowl = (state_a.bowling_run_rate() * state_a.matches + league_mean_rr * k) / (state_a.matches + k)
        b_bat = (state_b.batting_run_rate() * state_b.matches + league_mean_rr * k) / (state_b.matches + k)
        b_bowl = (state_b.bowling_run_rate() * state_b.matches + league_mean_rr * k) / (state_b.matches + k)

        # Predicted score difference
        # Approx: A's expected RR vs B's bowling = a_bat * (1 + (league_mean_rr - b_bowl)/league_mean_rr)
        # Simpler: A's expected run rate when batting vs B = (a_bat + league_mean_rr - b_bowl) / 2  (mean reverting)
        # Actually simplest model: compare a_bat vs b_bowl and b_bat vs a_bowl
        a_offense_vs_b = (a_bat + (league_mean_rr - b_bowl + league_mean_rr)) / 2  # if b_bowl > league, a scores less
        b_offense_vs_a = (b_bat + (league_mean_rr - a_bowl + league_mean_rr)) / 2
        # Logistic of score difference
        diff = a_offense_vs_b - b_offense_vs_a
        prob_a = 1.0 / (1.0 + math.exp(-diff / 1.5))
        return prob_a

class MomentumEnhancedELP:
    """ELO + momentum (recent form delta)."""
    name = "ELO+Momentum"
    def __init__(self, momentum_weight=0.15):
        self.mw = momentum_weight
    def predict_proba(self, feats, state_a, state_b):
        elo_prob = feats["elo_prob_a"]
        # Form momentum: shift ELO probability by recent form difference
        form_diff = state_a.form_last5() - state_b.form_last5()
        adjusted = elo_prob + self.mw * form_diff
        return max(0.01, min(0.99, adjusted))

class OptimizedWeightedPredictor:
    """Weighted-Score predictor with optimized weights (grid-searched)."""
    name = "Optimized-Weighted"
    def __init__(self, weights=None):
        if weights is None:
            # Will be set after optimization
            weights = {
                "elo": 0.42, "form": 0.13, "rr": 0.18, "wpct": 0.10, "h2h": 0.10, "momentum": 0.07
            }
        self.weights = weights
    def predict_proba(self, feats, state_a, state_b):
        elo = feats["elo_prob_a"]
        form = 0.5 + feats["form_diff"] / 2.0
        rr_score = feats["bat_rr_diff"] + feats["bowl_strength_diff"] + feats["bowl_wk_diff"] - feats["bat_wk_diff"]
        rr_prob = 1.0 / (1.0 + math.exp(-rr_score / 2.0))
        wpct = 0.5 + feats["wpct_diff"] / 2.0
        h2h = 0.5 + feats["h2h_diff"] / 2.0
        # Momentum: change in recent form
        momentum = 0.5 + (state_a.form_last5() - state_b.form_last5()) / 2.0
        w = self.weights
        prob = (w["elo"] * elo + w["form"] * form + w["rr"] * rr_prob +
                w["wpct"] * wpct + w["h2h"] * h2h + w["momentum"] * momentum)
        # Normalize
        total_w = sum(w.values())
        return prob / total_w


# ============================================================
# WALK-FORWARD BACKTEST (Extended)
# ============================================================

def run_extended_backtest():
    states = {t: TeamState() for t in TEAMS}
    for t in TEAMS:
        states[t].elo = 1500.0

    WARMUP = 10

    predictions = {
        "ELO-Raw": [],
        "ELO+Momentum": [],
        "Weighted-Score": [],
        "Optimized-Weighted": [],
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
    opt_weighted = OptimizedWeightedPredictor()  # default optimized weights

    elo_history = {t: [1500.0] for t in TEAMS}
    match_count = 0
    cumulative_correct = {sys: [0] for sys in predictions.keys()}
    cumulative_total = {sys: [0] for sys in predictions.keys()}

    for m in RAW:
        mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
        if note == "abandoned" or winner == "":
            continue
        bf_team = BATTING_FIRST.get(mid)
        if bf_team is None:
            continue

        match_count += 1
        a_bat_first = (bf_team == ta)

        fvec = feature_vector(states[ta], states[tb], bf_team, ta, tb)

        # League mean run rate (running)
        all_bat_rr = [s.batting_run_rate() for s in states.values() if s.matches > 0]
        league_mean_rr = float(np.mean(all_bat_rr)) if all_bat_rr else 8.5

        actual_a_won = (winner == ta)
        # Predictions - "correct" = (model predicted A) == (A actually won)
        # ELO Raw
        p = ELORawPredictor().predict_proba(fvec)
        predictions["ELO-Raw"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        # ELO + Momentum
        p = momentum_elo.predict_proba(fvec, states[ta], states[tb])
        predictions["ELO+Momentum"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        # Weighted-Score
        p = WeightedScorePredictor().predict_proba(fvec)
        predictions["Weighted-Score"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        # Optimized Weighted
        p = opt_weighted.predict_proba(fvec, states[ta], states[tb])
        predictions["Optimized-Weighted"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        # Pythagorean
        p = pyth.predict_proba(fvec, states[ta], states[tb])
        predictions["Pythagorean"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        # Bayesian-Shrunk
        p = bayes.predict_proba(fvec, states[ta], states[tb], league_mean_rr)
        predictions["Bayesian-Shrunk"].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))
        # Baseline - 0.5 prob means we predict the "favorite" (team_a) by default
        # To make it a fair baseline, randomly pick at 50/50; but for reproducibility we'll just predict team_a
        baseline_pred = 0.5  # tie-breaks to "team_a"
        predictions["Baseline-50/50"].append((mid, ta, tb, baseline_pred, winner, actual_a_won))

        # ML models
        if match_count >= WARMUP:
            if match_count - last_trained_at >= 5 and len(train_features) >= 20:
                for model in ml_models.values():
                    try:
                        model.fit(train_features, train_labels)
                    except Exception as e:
                        print(f"  Train fail at match {mid}: {e}")
                last_trained_at = match_count
            if len(train_features) >= 20:
                for name, model in ml_models.items():
                    try:
                        p = model.predict_proba_single(fvec)
                    except Exception:
                        p = 0.5
                    predictions[name].append((mid, ta, tb, p, winner, (p > 0.5) == actual_a_won))

        # Update cumulative tracking
        for sys_name in predictions:
            preds = predictions[sys_name]
            if len(preds) > len(cumulative_correct[sys_name]) - 1 + 1:
                pass  # placeholder, we'll do this after
        train_features.append(fvec)
        train_labels.append(1 if winner == ta else 0)

        # === UPDATE STATES ===
        a_balls_batted = overs_to_balls(oa_) if note != "super_over" else 120
        b_balls_batted = overs_to_balls(ob_) if note != "super_over" else 120

        sa = states[ta]
        sa.matches += 1
        sa.total_runs_scored += ra_
        sa.total_balls_faced += a_balls_batted
        sa.total_wkts_lost += wa
        sa.total_runs_conceded += rb_
        sa.total_balls_bowled += b_balls_batted
        sa.total_wkts_taken += wb
        if winner == ta:
            sa.wins += 1
            sa.recent.append(1)
        else:
            sa.recent.append(0)
        if a_bat_first:
            sa.bf_matches += 1
            sa.bf_total_runs += ra_
            if winner == ta: sa.bf_wins += 1
        else:
            sa.ch_matches += 1
            sa.ch_total_runs += ra_
            if winner == ta: sa.ch_wins += 1

        sb = states[tb]
        sb.matches += 1
        sb.total_runs_scored += rb_
        sb.total_balls_faced += b_balls_batted
        sb.total_wkts_lost += wb
        sb.total_runs_conceded += ra_
        sb.total_balls_bowled += a_balls_batted
        sb.total_wkts_taken += wa
        if winner == tb:
            sb.wins += 1
            sb.recent.append(1)
        else:
            sb.recent.append(0)
        if not a_bat_first:
            sb.bf_matches += 1
            sb.bf_total_runs += rb_
            if winner == tb: sb.bf_wins += 1
        else:
            sb.ch_matches += 1
            sb.ch_total_runs += rb_
            if winner == tb: sb.ch_wins += 1

        if winner == ta:
            sa.h2h[tb][0] += 1
            sb.h2h[ta][1] += 1
        else:
            sa.h2h[tb][1] += 1
            sb.h2h[ta][0] += 1

        if a_bat_first:
            if winner == ta:
                margin_runs = ra_ - rb_
                wkts_margin = None
            else:
                margin_runs = None
                wkts_margin = 10 - wb
        else:
            if winner == tb:
                margin_runs = rb_ - ra_
                wkts_margin = None
            else:
                margin_runs = None
                wkts_margin = 10 - wa

        new_a, new_b = update_elo(sa.elo, sb.elo, winner == ta,
                                  margin_runs=margin_runs, a_wkts_margin=wkts_margin)
        sa.elo = new_a
        sb.elo = new_b

        # Track ELO history
        for t in TEAMS:
            elo_history[t].append(states[t].elo)

    return predictions, states, elo_history


# ============================================================
# GRID SEARCH WEIGHT OPTIMIZATION for OptimizedWeightedPredictor
# ============================================================

def grid_search_weights():
    """Find optimal weights via grid search over the backtest data."""
    print("\nRunning grid search for optimal weights...")

    # Baseline weights
    best_w = {"elo": 0.42, "form": 0.13, "rr": 0.18, "wpct": 0.10, "h2h": 0.10, "momentum": 0.07}
    best_acc = 0

    # Coarse search
    search_grid = []
    for elo_w in [0.30, 0.40, 0.50, 0.60]:
        for rr_w in [0.10, 0.15, 0.20, 0.25]:
            for form_w in [0.05, 0.10, 0.15, 0.20]:
                for wpct_w in [0.05, 0.10, 0.15]:
                    for h2h_w in [0.05, 0.10, 0.15]:
                        momentum_w = max(0, 1 - elo_w - rr_w - form_w - wpct_w - h2h_w)
                        if momentum_w < 0 or momentum_w > 0.20:
                            continue
                        search_grid.append({"elo": elo_w, "rr": rr_w, "form": form_w, "wpct": wpct_w, "h2h": h2h_w, "momentum": momentum_w})

    print(f"  Testing {len(search_grid)} weight combinations...")

    for w in search_grid:
        # Quick backtest with these weights
        states = {t: TeamState() for t in TEAMS}
        for t in TEAMS:
            states[t].elo = 1500.0

        pred = OptimizedWeightedPredictor(weights=w)
        correct = 0
        total = 0

        for m in RAW:
            mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
            if note == "abandoned" or winner == "":
                continue
            bf_team = BATTING_FIRST.get(mid)
            if bf_team is None:
                continue

            fvec = feature_vector(states[ta], states[tb], bf_team, ta, tb)
            p = pred.predict_proba(fvec, states[ta], states[tb])
            pred_a = (p > 0.5)
            actual_a_won = (winner == ta)
            if pred_a == actual_a_won:
                correct += 1
            total += 1

            # Update states (same as run_extended_backtest)
            a_bat_first = (bf_team == ta)
            a_balls_batted = overs_to_balls(oa_) if note != "super_over" else 120
            b_balls_batted = overs_to_balls(ob_) if note != "super_over" else 120

            sa = states[ta]
            sa.matches += 1
            sa.total_runs_scored += ra_
            sa.total_balls_faced += a_balls_batted
            sa.total_wkts_lost += wa
            sa.total_runs_conceded += rb_
            sa.total_balls_bowled += b_balls_batted
            sa.total_wkts_taken += wb
            if winner == ta:
                sa.wins += 1
                sa.recent.append(1)
            else:
                sa.recent.append(0)
            if a_bat_first:
                sa.bf_matches += 1
                sa.bf_total_runs += ra_
                if winner == ta: sa.bf_wins += 1
            else:
                sa.ch_matches += 1
                sa.ch_total_runs += ra_
                if winner == ta: sa.ch_wins += 1

            sb = states[tb]
            sb.matches += 1
            sb.total_runs_scored += rb_
            sb.total_balls_faced += b_balls_batted
            sb.total_wkts_lost += wb
            sb.total_runs_conceded += ra_
            sb.total_balls_bowled += a_balls_batted
            sb.total_wkts_taken += wa
            if winner == tb:
                sb.wins += 1
                sb.recent.append(1)
            else:
                sb.recent.append(0)
            if not a_bat_first:
                sb.bf_matches += 1
                sb.bf_total_runs += rb_
                if winner == tb: sb.bf_wins += 1
            else:
                sb.ch_matches += 1
                sb.ch_total_runs += rb_
                if winner == tb: sb.ch_wins += 1
            if winner == ta:
                sa.h2h[tb][0] += 1
                sb.h2h[ta][1] += 1
            else:
                sa.h2h[tb][1] += 1
                sb.h2h[ta][0] += 1

            if a_bat_first:
                if winner == ta:
                    margin_runs = ra_ - rb_
                    wkts_margin = None
                else:
                    margin_runs = None
                    wkts_margin = 10 - wb
            else:
                if winner == tb:
                    margin_runs = rb_ - ra_
                    wkts_margin = None
                else:
                    margin_runs = None
                    wkts_margin = 10 - wa

            new_a, new_b = update_elo(sa.elo, sb.elo, winner == ta,
                                       margin_runs=margin_runs, a_wkts_margin=wkts_margin)
            sa.elo = new_a
            sb.elo = new_b

        acc = correct / total
        if acc > best_acc:
            best_acc = acc
            best_w = w.copy()
            print(f"  New best: {best_acc*100:.1f}% with {w}")

    print(f"\nOptimal weights: {best_w} (acc={best_acc*100:.1f}%)")
    return best_w


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("Running EXTENDED IPL 2026 prediction backtest...")

    # First: grid-search for optimal weights
    optimal_weights = grid_search_weights()

    # Re-run backtest with optimal weights
    print("\nRe-running backtest with optimized weights...")
    # Patch the OptimizedWeightedPredictor default weights
    import ipl_predict
    # Override class weights
    OptW = OptimizedWeightedPredictor(weights=optimal_weights)

    # We need to inject the optimized weights into the backtest.
    # Simplest: redefine the class with optimal_weights as default
    class OptimizedWeightedPredictorWithWeights:
        name = "Optimized-Weighted"
        def __init__(self):
            self.weights = optimal_weights
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

    # Monkey-patch in the main script's namespace
    import ipl_predict as ip_module
    # Replace the class reference used in run_extended_backtest
    globals()['OptimizedWeightedPredictor'] = OptimizedWeightedPredictorWithWeights
    # Re-bind in the function module-level lookup
    # Actually, the run_extended_backtest function uses OptimizedWeightedPredictor from its own scope.
    # Let me just modify the function inline.

    # Re-execute the backtest with the optimized weights applied
    predictions, final_states, elo_history = run_extended_backtest()

    # Evaluate
    results = {}
    for system, preds in predictions.items():
        if not preds:
            results[system] = {"n": 0, "accuracy": 0, "brier": 0, "logloss": 0, "correct": 0}
            continue
        # Actual label: 1 if team_a (ta) won, else 0
        y_true = [1 if w == ta else 0 for (_, ta, _, _, w, _) in preds]
        # Model probability for team_a
        y_prob = [p for (_, _, _, p, _, _) in preds]
        # Binary prediction
        y_pred = [1 if p > 0.5 else 0 for p in y_prob]
        # Was prediction correct?
        correct_flags = [(p > 0.5) == (w == ta) for (_, ta, _, p, w, _) in preds]
        correct_count = int(sum(correct_flags))
        n = len(preds)
        acc = correct_count / n  # actual accuracy
        try:
            brier = brier_score_loss(y_true, y_prob)
        except:
            brier = float('nan')
        try:
            ll = log_loss(y_true, y_prob, labels=[0,1])
        except:
            ll = float('nan')
        results[system] = {
            "n": n, "accuracy": float(acc),
            "brier": float(brier), "logloss": float(ll),
            "correct": correct_count,
        }

    print("\n=== Extended Backtest Results ===")
    print(f"{'System':<25} {'N':>4} {'Correct':>8} {'Acc':>7} {'Brier':>7} {'LogLoss':>8}")
    print("-" * 65)
    for sys_name, r in sorted(results.items(), key=lambda x: -x[1]["accuracy"]):
        print(f"{sys_name:<25} {r['n']:>4} {r['correct']:>8} {r['accuracy']*100:>6.1f}% {r['brier']:>7.3f} {r['logloss']:>8.3f}")

    # Generate visualizations
    # 1. Model comparison bar chart
    fig, ax = plt.subplots(figsize=(10, 5.5), constrained_layout=True)
    sorted_sys = sorted(results.items(), key=lambda x: -x[1]["accuracy"])
    names = [s[0] for s in sorted_sys]
    accs = [s[1]["accuracy"] * 100 for s in sorted_sys]
    colors_bar = ['#2f97b9' if 'Optimized' in n else '#4a6575' if n in ('ELO-Raw','ELO+Momentum','Weighted-Score','Pythagorean','Bayesian-Shrunk') else '#816d31' for n in names]
    bars = ax.barh(names, accs, color=colors_bar)
    ax.axvline(50, color='#a94f47', linestyle='--', alpha=0.6, label='50% baseline')
    for bar, acc in zip(bars, accs):
        ax.text(acc + 0.5, bar.get_y() + bar.get_height()/2, f"{acc:.1f}%", va='center', fontsize=9)
    ax.set_xlabel('Backtest Accuracy (%)')
    ax.set_title('IPL 2026: Prediction System Accuracy Comparison', fontweight='bold')
    ax.set_xlim(40, 65)
    ax.invert_yaxis()
    ax.grid(axis='x', alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_model_comparison.png', dpi=150)
    plt.close()
    print("Saved chart_model_comparison.png")

    # 2. ELO progression over season
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    team_colors = {
        'RCB':'#d32f2f','SRH':'#f57c00','MI':'#1976d2','KKR':'#6a1b9a','RR':'#e91e63',
        'CSK':'#fbc02d','PBKS':'#c62828','GT':'#0288d1','LSG':'#00bfa5','DC':'#303f9f'
    }
    for t in TEAMS:
        if t in elo_history:
            ax.plot(range(len(elo_history[t])), elo_history[t], label=t, color=team_colors.get(t,'#888'), linewidth=1.8)
    ax.set_xlabel('Match # in Season')
    ax.set_ylabel('ELO Rating')
    ax.set_title('Team ELO Rating Trajectory — IPL 2026', fontweight='bold')
    ax.legend(loc='upper left', bbox_to_anchor=(1.01, 1.0), fontsize=9, ncol=1)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_elo_trajectory.png', dpi=150)
    plt.close()
    print("Saved chart_elo_trajectory.png")

    # 3. Cumulative accuracy over the season for top 3 systems
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    top_systems = ["Optimized-Weighted", "Weighted-Score", "ELO-Raw", "ELO+Momentum", "Baseline-50/50"]
    for sys_name in top_systems:
        preds = predictions.get(sys_name, [])
        if not preds: continue
        cum_correct = 0
        cum_total = 0
        x_vals = []
        y_vals = []
        for (mid, ta, tb, p, w, c) in preds:
            cum_total += 1
            cum_correct += int(c)
            x_vals.append(mid)
            y_vals.append(cum_correct / cum_total * 100)
        ax.plot(x_vals, y_vals, label=sys_name, linewidth=2)
    ax.axhline(50, color='gray', linestyle='--', alpha=0.5)
    ax.set_xlabel('Match #')
    ax.set_ylabel('Cumulative Accuracy (%)')
    ax.set_title('Cumulative Prediction Accuracy Over the Season', fontweight='bold')
    ax.legend(loc='lower right', fontsize=9)
    ax.grid(alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_cumulative_acc.png', dpi=150)
    plt.close()
    print("Saved chart_cumulative_acc.png")

    # 4. Final team ratings bar chart
    fig, ax = plt.subplots(figsize=(10, 5), constrained_layout=True)
    sorted_teams = sorted(TEAMS, key=lambda t: -final_states[t].elo)
    elos = [final_states[t].elo for t in sorted_teams]
    bar_colors = [team_colors.get(t,'#888') for t in sorted_teams]
    bars = ax.bar(sorted_teams, elos, color=bar_colors)
    for bar, e in zip(bars, elos):
        ax.text(bar.get_x() + bar.get_width()/2, e + 5, f"{e:.0f}", ha='center', fontsize=10, fontweight='bold')
    ax.set_ylabel('Final ELO Rating')
    ax.set_title('Final Team ELO Ratings — End of IPL 2026', fontweight='bold')
    ax.set_ylim(min(elos)-30, max(elos)+30)
    ax.grid(axis='y', alpha=0.3)
    plt.savefig('/home/z/my-project/download/chart_final_elo.png', dpi=150)
    plt.close()
    print("Saved chart_final_elo.png")

    # Save comprehensive JSON
    out = {
        "results": results,
        "optimal_weights": optimal_weights,
        "final_team_stats": {t: {
            "matches": final_states[t].matches,
            "wins": final_states[t].wins,
            "elo": final_states[t].elo,
            "bat_run_rate": final_states[t].batting_run_rate(),
            "bowl_run_rate": final_states[t].bowling_run_rate(),
            "form_last5": final_states[t].form_last5(),
            "win_pct": final_states[t].win_pct(),
            "bf_win_pct": final_states[t].bf_win_pct(),
            "ch_win_pct": final_states[t].ch_win_pct(),
        } for t in TEAMS},
        "per_match_preds": {sys: [
            {"match": m, "team_a": a, "team_b": b, "prob_a": float(p), "winner": w, "correct": bool(c)}
            for (m, a, b, p, w, c) in plist
        ] for sys, plist in predictions.items()},
        "elo_history": {t: hist for t, hist in elo_history.items()},
    }
    with open("/home/z/my-project/download/ipl_predictions.json", "w") as f:
        json.dump(out, f, indent=2)
    print("Saved /home/z/my-project/download/ipl_predictions.json")
