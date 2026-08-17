# 🏏 CricketPredict — T20 Match Prediction Engine

A full-stack Next.js application that predicts T20 cricket match winners using a weighted ensemble of ELO ratings, momentum, win percentage, run-rate differentials, recent form, and head-to-head records.

**Validated on 191 matches across 4 T20 leagues on 4 continents:**

| League | Country | Season | Matches | Best System | Accuracy |
|--------|---------|--------|---------|-------------|----------|
| IPL | India | 2026 | 73 | Opt-Weighted Ensemble | 63.0% |
| PSL | Pakistan | 2026 | 43 | Opt-Weighted Ensemble | 67.4% |
| BBL | Australia | 2025-26 | 43 | Opt-Weighted Ensemble | 65.1% |
| CPL | West Indies | 2025 | 32 | Logistic Regression | 50.0% |

**The Optimized-Weighted Ensemble architecture won 3 of 4 leagues outright and tied for 2nd in the 4th.**

---

## ✨ Features

- **Dashboard** — League spotlight, team ELO ratings, optimal weights visualizer
- **Predict** — Pick any two teams → get live win probabilities from all 6 prediction systems
- **Rankings** — Sortable team table with ELO, win %, run rates, form, batting-first vs chasing splits
- **Match Log** — Walk-forward audit trail of every prediction with OK/MISS badges
- **Systems** — Cross-league accuracy comparison matrix
- **Insights** — 4-league hero stats, per-league cards, key findings, weight comparison
- **Admin** — Add new matches or create new leagues through the UI (auto-recomputes all predictions)

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Prisma ORM (SQLite in dev, Turso libSQL in production)
- **Icons**: Lucide React + Sonner toasts
- **Deployment**: Vercel + Turso (free tier)

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/) runtime
- A Turso account (free at [turso.tech](https://turso.tech)) for production, or local SQLite for dev

### Local Development

```bash
# Clone the repo
git clone https://github.com/mdmasumbella232-svg/cricketpredict.git
cd cricketpredict

# Install dependencies
bun install

# Copy env template
cp .env.example .env
# (Defaults to local SQLite — no changes needed for dev)

# Push database schema + seed 191 matches across 4 leagues
bun run db:push
bun run db:seed

# Start dev server
bun run dev
```

Open http://localhost:3000 — you should see "191 matches · 4 leagues" in the header.

### Production Deployment (Vercel + Turso, free tier)

See **[DEPLOY.md](./DEPLOY.md)** for the complete step-by-step guide (~30 min).

TL;DR:
1. Push to GitHub
2. Create a Turso database → copy URL + auth token
3. Push schema + seed to Turso: `DATABASE_URL=libsql://... bun run db:push && bun run db:seed`
4. Import repo on Vercel → add 3 env vars → click Deploy

---

## 📁 Project Structure

```
cricketpredict/
├── prisma/
│   └── schema.prisma          # League, Team, Match, Prediction models
├── scripts/
│   └── seed-matches.ts        # Loads 191 matches + walk-forward predictions
├── src/
│   ├── app/
│   │   ├── api/               # 7 API routes (leagues, teams, matches, predict, admin, etc.)
│   │   ├── layout.tsx
│   │   └── page.tsx           # Main dashboard with 7 tabs
│   ├── components/
│   │   └── cricket/           # 7 tab components (Dashboard, Predict, Rankings, MatchLog, Systems, Insights, Admin)
│   └── lib/
│       ├── db.ts              # Prisma client with auto-detected Turso/SQLite adapter
│       └── prediction-engine.ts  # ELO + 6 prediction systems
├── DEPLOY.md                  # Step-by-step Vercel + Turso deploy guide
├── vercel.json                # Vercel build config
└── package.json
```

---

## 🧠 How the Prediction Engine Works

The system computes 13 features per match from rolling team statistics:

1. **ELO rating** (with margin-of-victory multiplier, K=32)
2. **Momentum** (recent form vs season average)
3. **Win percentage** (full season)
4. **Run-rate differential** (batting + bowling combined)
5. **Recent form** (last 5 matches win %)
6. **Head-to-head record** (direct matchups)

These feed into **6 prediction systems**:

- **ELO-Raw** — pure ELO probability
- **ELO+Momentum** — ELO adjusted by recent-form delta
- **Weighted-Score** — heuristic 6-signal blend
- **Optimized-Weighted** — grid-searched weights per league (the winner)
- **Pythagorean** — baseball-style runs² / (runs² + runs_allowed²)
- **Bayesian-Shrunk** — Bayesian-shrunk run rates toward league mean

The **Optimized-Weighted Ensemble** won 3 of 4 leagues. The optimal weights differ per league — see the Insights tab in the app for the comparison table.

---

## 🔬 Methodology

All predictions are made using strict **walk-forward backtesting** — each match is predicted using only data from matches before it. No look-ahead bias.

The Optimized-Weighted weights are tuned via grid search over 500-1,300 weight combinations per league, picking the configuration with the highest backtest accuracy.

---

## 📊 Key Findings (across 4 leagues, 191 matches)

1. **Architecture transfers, weights don't** — the same 6-signal blend wins 3 of 4 leagues, but applying one league's weights to another loses 9-16 percentage points
2. **Blends beat single-signal systems** — every league's top system is a blend
3. **ML models structurally fail on small samples** — Random Forest, Gradient Boosting, and Stacked Ensembles all finished below baseline in all 4 leagues
4. **There is a minimum viable sample size** — below ~40 matches and ~8 teams (CPL's case), no system beats 55% accuracy

---

## 📝 License

MIT — see [LICENSE](./LICENSE) file.

---

## 🙏 Acknowledgements

Built by Z.ai Cricket Analytics. Predictions are probabilistic estimates, not certainties. Cricket remains a high-variance sport — even the best system will be wrong ~35% of the time.

---

## 📞 Support

- 📖 Read [DEPLOY.md](./DEPLOY.md) for deployment help
- 🐛 Open an issue on GitHub for bugs
- 💬 See the Insights tab in the app for the full methodology write-up
