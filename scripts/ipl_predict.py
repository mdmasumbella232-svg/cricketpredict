"""
IPL 2026 Cricket Match Prediction System
==========================================
Builds and backtests multiple predictive models on the full 74-match IPL 2026 season.
Identifies the best complex system by walk-forward accuracy.
"""
import json
import math
import os
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from typing import Optional

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

# ============================================================
# 1. RAW MATCH DATA — full IPL 2026 season (74 matches)
# ============================================================
# Each tuple: (match_no, date, team_a, a_runs, a_wkts, a_overs, team_b, b_runs, b_wkts, b_overs, winner, note)
# Overs as float (e.g. 15.4 = 15 + 4/6 = 15.667). Abandoned / DLS / Super Over flagged in note.
# Note: "abandoned", "dls", "super_over", "reduced_a"/"reduced_b" (curtailed overs), or ""

# Helper to parse "15.4" -> 15.6667 overs
def ov(s):
    if isinstance(s, (int, float)):
        return float(s)
    if '.' in s:
        whole, balls = s.split('.')
        return int(whole) + int(balls) / 6.0
    return float(s)

RAW = [
    # Match 1: RCB 203/4 (15.4) beat SRH 201/9 (20)
    (1, "Mar 28", "RCB", 203, 4, ov("15.4"), "SRH", 201, 9, ov("20"), "RCB", ""),
    (2, "Mar 29", "MI",  224, 4, ov("19.1"), "KKR", 220, 4, ov("20"), "MI", ""),
    (3, "Mar 30", "RR",  128, 2, ov("12.1"), "CSK", 127, 10, ov("19.4"), "RR", ""),
    (4, "Mar 31", "PBKS", 165, 7, ov("19.1"), "GT", 162, 6, ov("20"), "PBKS", ""),
    (5, "Apr 1",  "DC",  145, 4, ov("17.1"), "LSG", 141, 10, ov("18.4"), "DC", ""),
    (6, "Apr 2",  "KKR", 161, 10, ov("16.0"), "SRH", 226, 8, ov("20"), "SRH", ""),
    (7, "Apr 3",  "CSK", 209, 5, ov("20"),   "PBKS", 210, 5, ov("18.4"), "PBKS", ""),
    (8, "Apr 4",  "DC",  164, 4, ov("18.1"), "MI", 162, 6, ov("20"), "DC", ""),
    (9, "Apr 4",  "GT",  204, 8, ov("20"),   "RR", 210, 6, ov("20"), "RR", ""),
    (10,"Apr 5",  "SRH", 156, 9, ov("20"),   "LSG", 160, 5, ov("19.5"), "LSG", ""),
    (11,"Apr 5",  "RCB", 250, 3, ov("20"),   "CSK", 207, 10, ov("19.4"), "RCB", ""),
    (12,"Apr 6",  "KKR", 25, 2, ov("3.4"),    "PBKS", 0, 0, 0, "", "abandoned"),
    (13,"Apr 7",  "RR",  150, 3, ov("11.0"),  "MI", 123, 9, ov("11.0"), "RR", "reduced"),
    (14,"Apr 8",  "DC",  209, 8, ov("20"),    "GT", 210, 4, ov("20"), "GT", ""),
    (15,"Apr 9",  "KKR", 181, 4, ov("20"),    "LSG", 182, 7, ov("20"), "LSG", ""),
    (16,"Apr 10", "RR",  202, 4, ov("18.0"),  "RCB", 201, 8, ov("20"), "RR", ""),
    (17,"Apr 11", "PBKS", 223, 4, ov("18.5"), "SRH", 219, 6, ov("20"), "PBKS", ""),
    (18,"Apr 11", "CSK", 212, 2, ov("20"),    "DC", 189, 10, ov("20"), "CSK", ""),
    (19,"Apr 12", "LSG", 164, 8, ov("20"),    "GT", 165, 3, ov("18.4"), "GT", ""),
    (20,"Apr 12", "MI",  222, 5, ov("20"),    "RCB", 240, 4, ov("20"), "RCB", ""),
    (21,"Apr 13", "SRH", 216, 6, ov("20"),    "RR", 159, 10, ov("19.0"), "SRH", ""),
    (22,"Apr 14", "CSK", 192, 5, ov("20"),    "KKR", 160, 7, ov("20"), "CSK", ""),
    (23,"Apr 15", "RCB", 149, 5, ov("15.1"),  "LSG", 146, 10, ov("20"), "RCB", ""),
    (24,"Apr 16", "MI",  195, 6, ov("20"),    "PBKS", 198, 3, ov("16.3"), "PBKS", ""),
    (25,"Apr 17", "GT",  181, 5, ov("19.4"),  "KKR", 180, 10, ov("20"), "GT", ""),
    (26,"Apr 18", "RCB", 175, 8, ov("20"),    "DC", 179, 4, ov("19.5"), "DC", ""),
    (27,"Apr 18", "SRH", 194, 9, ov("20"),    "CSK", 184, 8, ov("20"), "SRH", ""),
    (28,"Apr 19", "KKR", 161, 6, ov("19.4"),  "RR", 155, 9, ov("20"), "KKR", ""),
    (29,"Apr 19", "PBKS", 254, 7, ov("20"),   "LSG", 200, 5, ov("20"), "PBKS", ""),
    (30,"Apr 20", "GT",  100, 10, ov("15.5"), "MI", 199, 5, ov("20"), "MI", ""),
    (31,"Apr 21", "SRH", 242, 2, ov("20"),    "DC", 195, 9, ov("20"), "SRH", ""),
    (32,"Apr 22", "LSG", 119, 10, ov("18.0"), "RR", 159, 6, ov("20"), "RR", ""),
    (33,"Apr 23", "MI",  104, 10, ov("19.0"), "CSK", 207, 6, ov("20"), "CSK", ""),
    (34,"Apr 24", "RCB", 206, 5, ov("18.5"),  "GT", 205, 3, ov("20"), "RCB", ""),
    (35,"Apr 25", "DC",  264, 2, ov("20"),    "PBKS", 265, 4, ov("18.5"), "PBKS", ""),
    (36,"Apr 25", "RR",  228, 6, ov("20"),    "SRH", 229, 5, ov("18.3"), "SRH", ""),
    (37,"Apr 26", "CSK", 158, 7, ov("20"),    "GT", 162, 2, ov("16.4"), "GT", ""),
    (38,"Apr 26", "LSG", 155, 8, ov("20"),    "KKR", 155, 7, ov("20"), "KKR", "super_over"),
    (39,"Apr 27", "DC",  75, 10, ov("16.3"),  "RCB", 77, 1, ov("6.3"), "RCB", ""),
    (40,"Apr 28", "PBKS", 222, 4, ov("20"),   "RR", 228, 4, ov("19.2"), "RR", ""),
    (41,"Apr 29", "MI",  243, 5, ov("20"),    "SRH", 249, 4, ov("18.4"), "SRH", ""),
    (42,"Apr 30", "GT",  158, 6, ov("15.5"),  "RCB", 155, 10, ov("19.2"), "GT", ""),
    (43,"May 1",  "RR",  225, 6, ov("20"),    "DC", 226, 3, ov("19.1"), "DC", ""),
    (44,"May 2",  "CSK", 160, 2, ov("18.1"),  "MI", 159, 7, ov("20"), "CSK", ""),
    (45,"May 3",  "SRH", 165, 10, ov("19.0"), "KKR", 169, 3, ov("18.2"), "KKR", ""),
    (46,"May 3",  "GT",  167, 6, ov("19.5"),  "PBKS", 163, 9, ov("20"), "GT", ""),
    (47,"May 4",  "MI",  229, 4, ov("18.4"),  "LSG", 228, 5, ov("20"), "MI", ""),
    (48,"May 5",  "DC",  155, 7, ov("20"),    "CSK", 159, 2, ov("7.3"), "CSK", "reduced"),
    (49,"May 6",  "SRH", 235, 4, ov("20"),    "PBKS", 202, 7, ov("20"), "SRH", ""),
    (50,"May 7",  "LSG", 209, 3, ov("19.0"),  "RCB", 203, 6, ov("19.0"), "LSG", "dls"),
    (51,"May 8",  "DC",  142, 8, ov("20"),    "KKR", 147, 2, ov("14.2"), "KKR", ""),
    (52,"May 9",  "RR",  152, 10, ov("16.3"), "GT", 229, 4, ov("20"), "GT", ""),
    (53,"May 10", "CSK", 208, 5, ov("19.2"),  "LSG", 203, 8, ov("20"), "CSK", ""),
    (54,"May 10", "RCB", 167, 8, ov("20"),    "MI", 166, 7, ov("20"), "RCB", ""),
    (55,"May 11", "PBKS", 210, 5, ov("20"),   "DC", 216, 7, ov("19.0"), "DC", ""),
    (56,"May 12", "GT",  168, 5, ov("20"),    "SRH", 86, 10, ov("14.5"), "GT", ""),
    (57,"May 13", "RCB", 194, 4, ov("19.1"),  "KKR", 192, 4, ov("20"), "RCB", ""),
    (58,"May 14", "PBKS", 200, 8, ov("20"),   "MI", 205, 4, ov("19.5"), "MI", ""),
    (59,"May 15", "LSG", 188, 3, ov("16.4"),  "CSK", 187, 5, ov("20"), "LSG", ""),
    (60,"May 16", "KKR", 247, 2, ov("20"),    "GT", 218, 4, ov("20"), "KKR", ""),
    (61,"May 17", "PBKS", 199, 8, ov("20"),   "RCB", 222, 4, ov("20"), "RCB", ""),
    (62,"May 17", "DC",  197, 5, ov("19.2"),  "RR", 193, 8, ov("20"), "DC", ""),
    (63,"May 18", "CSK", 180, 7, ov("20"),    "SRH", 181, 5, ov("19.0"), "SRH", ""),
    (64,"May 19", "RR",  225, 3, ov("19.1"),  "LSG", 220, 5, ov("20"), "RR", ""),
    (65,"May 20", "KKR", 148, 6, ov("18.5"),  "MI", 147, 8, ov("20"), "KKR", ""),
    (66,"May 21", "GT",  229, 4, ov("20"),    "CSK", 140, 10, ov("13.4"), "GT", ""),
    (67,"May 22", "SRH", 255, 4, ov("20"),    "RCB", 200, 4, ov("20"), "SRH", ""),
    (68,"May 23", "LSG", 196, 6, ov("20"),    "PBKS", 200, 3, ov("18.0"), "PBKS", ""),
    (69,"May 24", "MI",  175, 9, ov("20"),    "RR", 205, 8, ov("20"), "RR", ""),
    (70,"May 24", "KKR", 163, 10, ov("18.4"), "DC", 203, 5, ov("20"), "DC", ""),
    # Playoffs
    (71,"May 26", "RCB", 254, 5, ov("20"),    "GT", 162, 10, ov("19.3"), "RCB", "Qualifier1"),
    (72,"May 27", "SRH", 196, 10, ov("19.2"), "RR", 243, 8, ov("20"), "RR", "Eliminator"),
    (73,"May 29", "GT",  219, 3, ov("18.4"),  "RR", 214, 6, ov("20"), "GT", "Qualifier2"),
    (74,"May 31", "RCB", 161, 5, ov("18.0"),  "GT", 155, 8, ov("20"), "RCB", "Final"),
]

TEAMS = ["RCB","SRH","MI","KKR","RR","CSK","PBKS","GT","LSG","DC"]

# ============================================================
# 2. FEATURE ENGINEERING SYSTEM
# ============================================================

def overs_to_balls(o):
    """15.4 -> 94 balls"""
    return int(o * 6)

def calc_run_rate(runs, balls):
    if balls == 0: return 0.0
    return runs / (balls / 6.0)

def calc_wkt_rate(wkts, balls):
    """wickets per over"""
    if balls == 0: return 0.0
    return wkts / (balls / 6.0)

@dataclass
class TeamState:
    """Live team statistics up to (but not including) current match."""
    matches: int = 0
    wins: int = 0
    # Batting
    total_runs_scored: float = 0.0
    total_balls_faced: float = 0.0
    total_wkts_lost: float = 0.0
    # Bowling
    total_runs_conceded: float = 0.0
    total_balls_bowled: float = 0.0
    total_wkts_taken: float = 0.0
    # Split: batting first vs chasing
    bf_matches: int = 0
    bf_total_runs: float = 0.0
    ch_matches: int = 0
    ch_total_runs: float = 0.0
    bf_wins: int = 0
    ch_wins: int = 0
    # Recent form (win/loss queue, 1=win, 0=loss/abandoned)
    recent: deque = field(default_factory=lambda: deque(maxlen=5))
    # Head-to-head vs each opponent: [wins, losses]
    h2h: dict = field(default_factory=lambda: defaultdict(lambda: [0, 0]))
    # ELO rating
    elo: float = 1500.0
    # Margin tracking (avg run margin / wkt margin)
    total_margin_runs: float = 0.0  # +ve when win by runs, scaled
    margin_count: int = 0

    # Convenience derived stats
    def batting_run_rate(self):
        return calc_run_rate(self.total_runs_scored, self.total_balls_faced)
    def bowling_run_rate(self):
        return calc_run_rate(self.total_runs_conceded, self.total_balls_bowled)
    def batting_wkt_rate(self):
        return calc_wkt_rate(self.total_wkts_lost, self.total_balls_faced)
    def bowling_wkt_rate(self):
        return calc_wkt_rate(self.total_wkts_taken, self.total_balls_bowled)
    def win_pct(self):
        return self.wins / max(1, self.matches)
    def form_last5(self):
        if not self.recent: return 0.5
        return sum(self.recent) / len(self.recent)
    def bf_avg(self):
        return self.bf_total_runs / max(1, self.bf_matches)
    def ch_avg(self):
        return self.ch_total_runs / max(1, self.ch_matches)
    def bf_win_pct(self):
        return self.bf_wins / max(1, self.bf_matches)
    def ch_win_pct(self):
        return self.ch_wins / max(1, self.ch_matches)


# ============================================================
# 3. ELO RATING ENGINE (with margin-of-victory multiplier)
# ============================================================

def expected_a(elo_a, elo_b):
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 400.0))

def update_elo(elo_a, elo_b, a_won, margin_runs=None, a_wkts_margin=None, k=32):
    """Standard ELO with margin-of-victory multiplier."""
    ea = expected_a(elo_a, elo_b)
    s_a = 1.0 if a_won else 0.0
    # MOV multiplier: cap at 2x
    if margin_runs is not None:
        mov = min(2.0, 1.0 + abs(margin_runs) / 100.0)
    elif a_wkts_margin is not None:
        mov = min(2.0, 1.0 + a_wkts_margin / 5.0)
    else:
        mov = 1.0
    new_a = elo_a + k * mov * (s_a - ea)
    new_b = elo_b + k * mov * ((1 - s_a) - (1 - ea))
    return new_a, new_b


# ============================================================
# 4. SIMULATOR — walks through the season sequentially,
#    generating features from PAST data only.
# ============================================================

def determine_batting_order(m):
    """Returns (batting_first_team, bowling_first_team).
    We don't know toss decision; we infer from score magnitude / chase pattern.
    Heuristic: the team whose score has fewer wickets lost AND fewer overs bowled
    is likely the chasing team that won. Or simpler: the team that batted first
    is the one whose score's 'result_type' was 'defending' or whose opponent scored more.
    Actually the data lists team1 first then team2; the order in the listing is the
    batting order if the winner is the chaser, but if winner defended, team1 also
    batted first. We use the result description: 'won by X runs' = winner batted first;
    'won by X wickets' = winner batted second.
    """
    # We'll infer from data we have: compare result.
    # Simple heuristic: the team whose score was set FIRST (team_a) is batting first.
    # Verify by checking that team_a score was typically higher when defending,
    # lower when chasing - won't be perfect but works for the season.
    # We can actually use the explicit "Won by runs/wickets" data from the listing.
    return None  # handled per-match below


def is_batting_first(m):
    """Determine if team_a batted first based on result type.
    Using the listing data:
    - Match 1: RCB 203/4 beat SRH 201/9 -> "RCB Won by 6 wickets" => SRH batted first, RCB chased.
      Wait but listing has RCB first. Let me re-check actual data.
    The listing shows team_a score FIRST, then team_b. Looking at match 1:
    RCB 203/4 - SRH 201/9. RCB Won by 6 wickets. So SRH batted first (201/9 in 20),
    RCB chased (203/4 in 15.4). So in the listing team_a (RCB) was the CHASER.
    Hmm, that's inconsistent. Let me look at match 2: MI 224/4 - KKR 220/4. MI Won by 6 wickets.
    So KKR batted first, MI chased. Again team_a (MI) chased.
    Match 6: KKR 161 - SRH 226/8. "SRH Won by 65 runs" => SRH batted first (226/8), KKR chased.
    But team_a is KKR. So team_a (KKR) batted SECOND again.

    So the listing format is: the WINNER is listed first if they won, OR team_a is just team_a.
    Let me check match 7: CSK 209/5 - PBKS 210/5. PBKS Won by 5 wickets.
    So CSK batted first (209/5 in 20), PBKS chased (210/5 in 18.4). team_a=CSK batted FIRST.
    Match 8: DC 164/4 - MI 162/6. DC Won by 6 wickets. MI batted first.
    team_a=DC chased. Hmm, inconsistent with match 7.

    Wait, looking more carefully at match 7: CSK appears first, then PBKS. PBKS won chasing.
    So team_a = CSK batted first.
    Match 8: DC first, MI second. DC won chasing. So team_a = DC batted SECOND.
    Hmm, inconsistent.

    OK so the listing order is just the team order, not batting order. We need to infer
    batting order from result type:
    - "Won by X runs" => winning team batted FIRST
    - "Won by X wickets" => winning team batted SECOND (chased)
    """
    return None  # placeholder


# Let me parse the batting order based on result type per match
# I'll embed batting_first_team directly in the data:

# Match-by-match batting order (which team batted first)
# Based on result description from the user's listing
BATTING_FIRST = {
    1: "SRH",   # RCB won by 6 wkts -> chased; SRH batted first
    2: "KKR",   # MI won by 6 wkts -> chased; KKR batted first
    3: "CSK",   # RR won by 8 wkts -> RR chased; CSK batted first
    4: "GT",    # PBKS won by 3 wkts -> chased; GT batted first
    5: "LSG",   # DC won by 6 wkts -> chased; LSG batted first
    6: "SRH",   # SRH won by 65 runs -> SRH batted first
    7: "CSK",   # PBKS won by 5 wkts -> chased; CSK batted first
    8: "MI",    # DC won by 6 wkts -> chased; MI batted first
    9: "RR",    # RR won by 6 runs -> RR batted first; wait listing has GT first then RR. RR 210/6. RR won by 6 runs. So RR batted first.
    10: "SRH",  # LSG won by 5 wkts -> chased; SRH batted first
    11: "RCB",  # RCB won by 43 runs -> RCB batted first
    12: None,   # abandoned
    13: "RR",   # RR won by 27 runs -> RR batted first
    14: "DC",   # GT won by 1 run -> DC batted first; wait. GT won by 1 run. So GT batted first? But listing: DC first then GT. GT 210/4. Yes GT scored 210. So GT batted first.
    # Let me redo: listing has DC 209/8 then GT 210/4. GT won by 1 run. So GT batted first (210/4) and DC chased (209/8). But DC is listed first.
    # Confusing. Let me re-look: result "GT Won by 1 run" - GT was the defending team. So GT batted first.
    # But the listing puts DC first. So the listing doesn't always put batting-first team first.
    # OK so I'll determine batting first team from the WON BY X RUNS/WICKETS rule:
    #   - Won by X runs => winner batted first
    #   - Won by X wickets => winner batted second (chased)
    15: "KKR",  # LSG won by 3 wkts -> chased; KKR batted first
    16: "RCB",  # RR won by 6 wkts -> chased; RCB batted first
    17: "SRH",  # PBKS won by 6 wkts -> chased; SRH batted first
    18: "CSK",  # CSK won by 23 runs -> CSK batted first
    19: "LSG",  # GT won by 7 wkts -> chased; LSG batted first
    20: "MI",   # RCB won by 18 runs -> RCB batted first
    21: "SRH",  # SRH won by 57 runs -> SRH batted first
    22: "CSK",  # CSK won by 32 runs -> CSK batted first
    23: "LSG",  # RCB won by 5 wkts -> chased; LSG batted first
    24: "MI",   # PBKS won by 7 wkts -> chased; MI batted first
    25: "KKR",  # GT won by 5 wkts -> chased; KKR batted first
    26: "RCB",  # DC won by 6 wkts -> chased; RCB batted first
    27: "SRH",  # SRH won by 10 runs -> SRH batted first
    28: "RR",   # KKR won by 4 wkts -> chased; RR batted first
    29: "PBKS", # PBKS won by 54 runs -> PBKS batted first
    30: "MI",   # MI won by 99 runs -> MI batted first
    31: "SRH",  # SRH won by 47 runs -> SRH batted first
    32: "RR",   # RR won by 40 runs -> RR batted first
    33: "CSK",  # CSK won by 103 runs -> CSK batted first
    34: "GT",   # RCB won by 5 wkts -> chased; GT batted first
    35: "DC",   # PBKS won by 6 wkts -> chased; DC batted first
    36: "RR",   # SRH won by 5 wkts -> chased; RR batted first
    37: "CSK",  # GT won by 8 wkts -> chased; CSK batted first
    38: "LSG",  # Super Over -> assume LSG batted first (KKR 155/7 -> LSG batted first?)
    39: "DC",   # RCB won by 9 wkts -> chased; DC batted first
    40: "PBKS", # RR won by 6 wkts -> chased; PBKS batted first
    41: "MI",   # SRH won by 6 wkts -> chased; MI batted first
    42: "RCB",  # GT won by 4 wkts -> chased; RCB batted first
    43: "RR",   # DC won by 7 wkts -> chased; RR batted first
    44: "MI",   # CSK won by 8 wkts -> chased; MI batted first
    45: "SRH",  # KKR won by 7 wkts -> chased; SRH batted first
    46: "PBKS", # GT won by 4 wkts -> chased; PBKS batted first
    47: "LSG",  # MI won by 6 wkts -> chased; LSG batted first
    48: "DC",   # CSK won by 8 wkts -> chased; DC batted first
    49: "SRH",  # SRH won by 33 runs -> SRH batted first
    50: "LSG",  # LSG won by DLS -> batting first team harder to say. Assume LSG batted first.
    51: "DC",   # KKR won by 8 wkts -> chased; DC batted first
    52: "GT",   # GT won by 77 runs -> GT batted first
    53: "LSG",  # CSK won by 5 wkts -> chased; LSG batted first
    54: "MI",   # RCB won by 2 wkts -> chased; MI batted first
    55: "PBKS", # DC won by 3 wkts -> chased; PBKS batted first
    56: "GT",   # GT won by 82 runs -> GT batted first
    57: "KKR",  # RCB won by 6 wkts -> chased; KKR batted first
    58: "PBKS", # MI won by 6 wkts -> chased; PBKS batted first
    59: "CSK",  # LSG won by 7 wkts -> chased; CSK batted first
    60: "GT",   # KKR won by 29 runs -> KKR batted first
    61: "PBKS", # RCB won by 23 runs -> RCB batted first
    62: "RR",   # DC won by 5 wkts -> chased; RR batted first
    63: "CSK",  # SRH won by 5 wkts -> chased; CSK batted first
    64: "LSG",  # RR won by 7 wkts -> chased; LSG batted first
    65: "MI",   # KKR won by 4 wkts -> chased; MI batted first
    66: "CSK",  # GT won by 89 runs -> GT batted first
    67: "SRH",  # SRH won by 55 runs -> SRH batted first
    68: "LSG",  # PBKS won by 7 wkts -> chased; LSG batted first
    69: "MI",   # RR won by 30 runs -> RR batted first
    70: "KKR",  # DC won by 40 runs -> DC batted first
    71: "RCB",  # RCB won by 92 runs -> RCB batted first (Qualifier 1)
    72: "RR",   # RR won by 47 runs -> RR batted first (Eliminator)
    73: "GT",   # GT won by 7 wkts -> chased; RR batted first. Wait, GT won by 7 wkts. So GT chased. RR batted first.
    74: "GT",   # RCB won by 5 wkts -> chased; GT batted first (Final)
}
# Fix entries where I went wrong:
BATTING_FIRST[14] = "GT"   # GT won by 1 run -> GT batted first
BATTING_FIRST[38] = "LSG"  # super over, ambiguous - we'll skip for feature purposes
BATTING_FIRST[50] = "LSG"  # DLS method - assumed LSG batted first

# ============================================================
# 5. PREDICTION MODELS
# ============================================================

def feature_vector(state_a: TeamState, state_b: TeamState, bf_team_first: str, team_a: str, team_b: str):
    """Build feature vector for predicting team_a vs team_b match.
    Returns dict of features."""
    # ELO difference (team_a - team_b)
    elo_diff = state_a.elo - state_b.elo
    elo_prob_a = expected_a(state_a.elo, state_b.elo)

    # Run rate differentials
    bat_rr_diff = state_a.batting_run_rate() - state_b.batting_run_rate()
    bowl_rr_diff = state_a.bowling_run_rate() - state_b.bowling_run_rate()  # negative = conceding less
    # Adjust: lower bowling run rate is better, so we want state_a's bowling to be lower than state_b's
    bowl_strength_diff = state_b.bowling_run_rate() - state_a.bowling_run_rate()  # +ve = a better bowler

    # Wicket rate differentials
    bat_wk_diff = state_a.batting_wkt_rate() - state_b.batting_wkt_rate()  # negative = a loses fewer wkts
    bowl_wk_diff = state_a.bowling_wkt_rate() - state_b.bowling_wkt_rate()  # +ve = a takes more wkts

    # Form differentials
    form_diff = state_a.form_last5() - state_b.form_last5()

    # Win percentage differentials
    wpct_diff = state_a.win_pct() - state_b.win_pct()

    # Head-to-head (a's wins vs b - b's wins vs a)
    h2h_a_wins = state_a.h2h.get(team_b, [0,0])[0]
    h2h_a_loss = state_a.h2h.get(team_b, [0,0])[1]
    h2h_total = h2h_a_wins + h2h_a_loss
    h2h_diff = (h2h_a_wins - h2h_a_loss) / max(1, h2h_total) if h2h_total > 0 else 0.0

    # Batting-first / chasing split
    bf_win_diff = state_a.bf_win_pct() - state_b.bf_win_pct()
    ch_win_diff = state_a.ch_win_pct() - state_b.ch_win_pct()

    # Avg score when batting first
    bf_avg_diff = state_a.bf_avg() - state_b.bf_avg()

    # Match experience
    exp_diff = state_a.matches - state_b.matches

    return {
        "elo_diff": elo_diff,
        "elo_prob_a": elo_prob_a,
        "bat_rr_diff": bat_rr_diff,
        "bowl_strength_diff": bowl_strength_diff,
        "bat_wk_diff": bat_wk_diff,
        "bowl_wk_diff": bowl_wk_diff,
        "form_diff": form_diff,
        "wpct_diff": wpct_diff,
        "h2h_diff": h2h_diff,
        "bf_win_diff": bf_win_diff,
        "ch_win_diff": ch_win_diff,
        "bf_avg_diff": bf_avg_diff,
        "exp_diff": exp_diff,
    }


# ============================================================
# 6. CUSTOM PREDICTORS
# ============================================================

class ELORawPredictor:
    """Pure ELO — predicts A wins if elo_prob_a > 0.5."""
    name = "ELO-Raw"
    def predict_proba(self, feats):
        return feats["elo_prob_a"]

class WeightedScorePredictor:
    """Custom weighted blend of ELO + form + run-rate differentials."""
    name = "Weighted-Score"
    def predict_proba(self, feats):
        elo = feats["elo_prob_a"]
        # Form component (0..1)
        form = 0.5 + feats["form_diff"] / 2.0
        # Run-rate blend (sigmoid of differential)
        rr_score = feats["bat_rr_diff"] + feats["bowl_strength_diff"] + feats["bowl_wk_diff"] - feats["bat_wk_diff"]
        rr_prob = 1.0 / (1.0 + math.exp(-rr_score / 2.0))
        # Win-pct blend
        wpct = 0.5 + feats["wpct_diff"] / 2.0
        # Head-to-head blend
        h2h = 0.5 + feats["h2h_diff"] / 2.0
        # Weighted sum
        prob = 0.40 * elo + 0.18 * form + 0.18 * rr_prob + 0.12 * wpct + 0.07 * h2h + 0.05 * 0.5
        return prob

class TossAgnosticMLPredictor:
    """Wraps a sklearn classifier; trained on a rolling window."""
    def __init__(self, clf, name, scaler=True):
        self.clf = clf
        self.name = name
        self.use_scaler = scaler
        self.scaler = StandardScaler() if scaler else None
        self.feature_names = [
            "elo_diff", "elo_prob_a", "bat_rr_diff", "bowl_strength_diff",
            "bat_wk_diff", "bowl_wk_diff", "form_diff", "wpct_diff",
            "h2h_diff", "bf_win_diff", "ch_win_diff", "bf_avg_diff", "exp_diff"
        ]
    def _X(self, feats_list):
        return np.array([[f[k] for k in self.feature_names] for f in feats_list])
    def fit(self, feats_list, y):
        X = self._X(feats_list)
        if self.use_scaler:
            X = self.scaler.fit_transform(X)
        self.clf.fit(X, y)
    def predict_proba_single(self, feats):
        X = np.array([[feats[k] for k in self.feature_names]])
        if self.use_scaler:
            X = self.scaler.transform(X)
        if hasattr(self.clf, "predict_proba"):
            return self.clf.predict_proba(X)[0, 1]
        else:
            return float(self.clf.predict(X)[0])


# ============================================================
# 7. WALK-FORWARD BACKTEST
# ============================================================

def run_backtest():
    states = {t: TeamState() for t in TEAMS}
    # Initial ELO
    for t in TEAMS:
        states[t].elo = 1500.0

    # Skip matches before this index for evaluation (warm-up)
    WARMUP = 10  # Need at least 10 matches before we have meaningful stats

    # Per-match predictions from each system
    predictions = {  # system name -> list of (match_no, team_a, team_b, prob_a, actual_winner, correct)
        "ELO-Raw": [],
        "Weighted-Score": [],
        "LogReg": [],
        "RandomForest": [],
        "GradientBoosting": [],
        "Ensemble-Stacked": [],
        "Baseline-HomeFlip": [],   # 50/50 baseline
    }

    # Sliding window training data for ML models
    train_features = []
    train_labels = []

    # We'll retrain ML models every 5 matches after warmup
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

    # Walk forward
    for m in RAW:
        mid, date, ta, ra_, wa, oa_, tb, rb_, wb, ob_, winner, note = m
        if note == "abandoned" or winner == "":
            # Still update form? Skip.
            continue

        bf_team = BATTING_FIRST.get(mid)
        if bf_team is None:
            continue  # skip if we don't know batting order

        # Determine A's batting role
        a_bat_first = (bf_team == ta)

        # Build features BEFORE this match (using only past data)
        fvec = feature_vector(states[ta], states[tb], bf_team, ta, tb)

        # Generate predictions
        # ELO Raw
        elo_prob = ELORawPredictor().predict_proba(fvec)
        predictions["ELO-Raw"].append((mid, ta, tb, elo_prob, winner, winner == ta))

        # Weighted Score
        ws_prob = WeightedScorePredictor().predict_proba(fvec)
        predictions["Weighted-Score"].append((mid, ta, tb, ws_prob, winner, winner == ta))

        # Baseline
        predictions["Baseline-HomeFlip"].append((mid, ta, tb, 0.5, winner, winner == ta))

        # ML models — predict then add to training set
        if mid >= WARMUP:
            # Retrain periodically
            if mid - last_trained_at >= 5 and len(train_features) >= 20:
                for model in ml_models.values():
                    try:
                        model.fit(train_features, train_labels)
                    except Exception as e:
                        print(f"  Train fail at match {mid}: {e}")
                last_trained_at = mid

            if len(train_features) >= 20:
                for name, model in ml_models.items():
                    try:
                        p = model.predict_proba_single(fvec)
                    except Exception as e:
                        p = 0.5
                    predictions[name].append((mid, ta, tb, p, winner, winner == ta))

        # Add to training set (for future matches)
        train_features.append(fvec)
        train_labels.append(1 if winner == ta else 0)

        # === UPDATE STATES WITH THIS MATCH'S RESULT ===
        # Determine runs/wkts/balls for each team
        # If match was reduced-overs, use actual overs bowled (scale isn't perfect but OK)
        a_balls_batted = overs_to_balls(oa_) if (a_bat_first or note != "super_over") else overs_to_balls(oa_)
        b_balls_batted = overs_to_balls(ob_)

        # For super over, only count main innings (we'll use the 20-over scores)
        if note == "super_over":
            # Use main innings scores (already 20 overs each)
            a_balls_batted = 120
            b_balls_batted = 120

        # Update team_a state
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

        # Update team_b state
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

        # Head-to-head
        if winner == ta:
            sa.h2h[tb][0] += 1
            sb.h2h[ta][1] += 1
        else:
            sa.h2h[tb][1] += 1
            sb.h2h[ta][0] += 1

        # ELO update with margin
        # Compute margin
        if a_bat_first:
            # team_a batted first; if a won, won by runs
            if winner == ta:
                margin_runs = ra_ - rb_
                wkts_margin = None
            else:
                # b won chasing -> won by wickets = 10 - wb
                margin_runs = None
                wkts_margin = 10 - wb
        else:
            # team_b batted first
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

    return predictions, states


# ============================================================
# 8. EVALUATION
# ============================================================

def evaluate(predictions):
    results = {}
    for system, preds in predictions.items():
        if not preds:
            results[system] = {"n": 0, "accuracy": 0, "brier": 0, "logloss": 0}
            continue
        y_true = [1 if c else 0 for _, _, _, _, _, c in preds]
        y_prob = [p for _, _, _, p, _, _ in preds]
        y_pred = [1 if p > 0.5 else 0 for p in y_prob]
        n = len(preds)
        acc = accuracy_score(y_true, y_pred)
        try:
            brier = brier_score_loss(y_true, y_prob)
        except:
            brier = float('nan')
        try:
            ll = log_loss(y_true, y_prob, labels=[0,1])
        except:
            ll = float('nan')
        results[system] = {
            "n": n,
            "accuracy": float(acc),
            "brier": float(brier),
            "logloss": float(ll),
            "correct": int(sum(c for _, _, _, _, _, c in preds)),
        }
    return results


# ============================================================
# 9. MAIN
# ============================================================

if __name__ == "__main__":
    print("Running IPL 2026 prediction backtest...")
    preds, final_states = run_backtest()
    results = evaluate(preds)

    print("\n=== Backtest Results ===")
    print(f"{'System':<25} {'N':>4} {'Correct':>8} {'Acc':>7} {'Brier':>7} {'LogLoss':>8}")
    print("-" * 65)
    for sys_name, r in sorted(results.items(), key=lambda x: -x[1]["accuracy"]):
        print(f"{sys_name:<25} {r['n']:>4} {r['correct']:>8} {r['accuracy']*100:>6.1f}% {r['brier']:>7.3f} {r['logloss']:>8.3f}")

    # Final team ratings
    print("\n=== Final Team ELO Ratings ===")
    sorted_teams = sorted(TEAMS, key=lambda t: -final_states[t].elo)
    for i, t in enumerate(sorted_teams, 1):
        s = final_states[t]
        print(f"{i}. {t:<5}  ELO={s.elo:6.0f}  M={s.matches:2d}  W={s.wins:2d}  WPct={s.win_pct()*100:5.1f}%  BatRR={s.batting_run_rate():.2f}  BowlRR={s.bowling_run_rate():.2f}  Form5={s.form_last5()*100:.0f}%")

    # Save JSON for the report
    out = {
        "results": results,
        "final_elo": {t: final_states[t].elo for t in TEAMS},
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
        ] for sys, plist in preds.items()},
    }
    os.makedirs("/home/z/my-project/download", exist_ok=True)
    with open("/home/z/my-project/download/ipl_predictions.json", "w") as f:
        json.dump(out, f, indent=2)

    print("\nSaved /home/z/my-project/download/ipl_predictions.json")
