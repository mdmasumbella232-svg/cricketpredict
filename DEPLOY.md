# 🚀 Deploy CricketPredict to Vercel + Turso (Free Tier)

This guide walks you through deploying the app for free using **Vercel** (frontend + API) and **Turso** (database). Total time: ~30 minutes. Total monthly cost: $0.

---

## Why Vercel + Turso?

- **Vercel** is built for Next.js — zero-config deploys, automatic HTTPS, global CDN
- **Turso** is SQLite-compatible — your Prisma schema doesn't change, just the connection string
- **Free tiers are generous**: 9GB Turso storage + 100GB Vercel bandwidth = plenty for this app
- **No vendor lock-in**: standard Next.js + Prisma, can move anywhere later

---

## Step 1: Push your code to GitHub (5 min)

If you haven't already:

```bash
cd /home/z/my-project
git init
git add .
git commit -m "Initial commit: CricketPredict app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cricketpredict.git
git push -u origin main
```

Make sure these are **NOT** in your repo (they're in `.gitignore` already):
- `.env` (contains secrets)
- `db/custom.db` (local SQLite file)
- `node_modules/`

---

## Step 2: Create a Turso database (5 min)

1. Go to **https://turso.tech** → click "Start Free" → sign in with GitHub
2. From the dashboard, click **"New Database"**
3. Name it: `cricketpredict`
4. Choose location: pick the one closest to your users (e.g. `ams` for Europe, `sfo` for US East)
5. Click **Create**

After creation:

1. Click on your new database
2. Click **"Settings"** → find the **"URL"** field — copy it. It looks like:
   ```
   libsql://cricketpredict-YourName.turso.io
   ```
3. Click **"Create Auth Token"** → copy the long token string. **Save it somewhere safe** — you won't be able to see it again.

---

## Step 3: Push the database schema to Turso (5 min)

From your local machine, with your Turso credentials:

```bash
# Set the env vars (replace with your actual Turso values)
export DATABASE_URL="libsql://cricketpredict-YourName.turso.io"
export DIRECT_URL="libsql://cricketpredict-YourName.turso.io"
export TURSO_AUTH_TOKEN="your-long-auth-token-here"

# Push the Prisma schema
bun run db:push

# Seed the database with all 191 matches across 4 leagues
bun run db:seed
```

Verify it worked:
```bash
# You should see "Inserted 4 leagues, 32 teams, 191 matches, 1146 predictions"
```

---

## Step 4: Deploy to Vercel (10 min)

1. Go to **https://vercel.com** → sign in with GitHub
2. Click **"Add New"** → **"Project"**
3. Find your `cricketpredict` repo → click **"Import"**
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `bun run build` (auto-detected from package.json)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `bun install` (auto-detected)

5. **Before clicking Deploy**, expand **"Environment Variables"** and add these 3:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `libsql://cricketpredict-YourName.turso.io` |
   | `DIRECT_URL` | `libsql://cricketpredict-YourName.turso.io` |
   | `TURSO_AUTH_TOKEN` | `your-long-auth-token-here` |

   ⚠️ **CRITICAL**: Set all three variables for **all environments** (Production, Preview, Development).

6. Click **"Deploy"** 🎉

Vercel will:
- Install dependencies with Bun
- Run `postinstall` (which runs `prisma generate`)
- Build the Next.js app
- Deploy to a global CDN

You'll get a URL like: `https://cricketpredict-abc123.vercel.app`

---

## Step 5: Verify the deployment (5 min)

Open your Vercel URL and check:

1. ✅ Page loads with "191 matches · 4 leagues" in the header
2. ✅ IPL 2026 selected by default, shows "73 matches, 10 teams, 63.0% accuracy"
3. ✅ Click **Predict** tab → pick two teams → click Predict → see prediction
4. ✅ Click **Match Log** tab → see all 73 IPL matches with OK/MISS badges
5. ✅ Click **Systems** tab → see cross-league accuracy comparison
6. ✅ Click **Insights** tab → see all 4 league cards
7. ✅ Click **Admin** tab → **Create League** → make a new league → it auto-switches to it
8. ✅ Click **Admin** → **Add Match** → add a real match → all tabs refresh instantly

If any of these fail, check the **Vercel Function Logs** (click your project → "Logs" tab).

---

## How It Works

### Local Development
- `DATABASE_URL=file:./db/custom.db` → uses local SQLite file
- No Turso auth token needed
- Fast iteration, no network calls

### Production (Vercel)
- `DATABASE_URL=libsql://...turso.io` → uses Turso's libSQL adapter
- `TURSO_AUTH_TOKEN` authenticates the connection
- `src/lib/db.ts` auto-detects which to use based on the URL scheme

### Why No Code Changes Are Needed in Production
- Prisma's `@prisma/adapter-libsql` driver adapter handles the libSQL protocol
- The Prisma schema is identical (just `provider = "sqlite"`)
- The Turso URL starts with `libsql://`, which `db.ts` detects and switches adapters

---

## Cost Analysis (Free Tier)

| Service | Free Tier | Our Usage | Headroom |
|---------|-----------|-----------|----------|
| Vercel bandwidth | 100 GB/month | ~1-5 GB/month | 20-100× |
| Vercel function executions | 100 GB-hours | <1 GB-hour | 100× |
| Vercel build minutes | 6000 min/month | ~2 min/deploy | 3000 deploys |
| Turso storage | 9 GB | ~500 KB | 18,000× |
| Turso row reads | 1 billion/month | ~10K/day = 300K/month | 3,300× |
| Turso row writes | 25 million/month | ~200 writes per admin action | 125,000 actions |

**Total monthly cost: $0** for any realistic usage of this app.

---

## Troubleshooting

### "Cannot find module '@prisma/adapter-libsql'"
Run `bun install` locally — Vercel should handle this automatically.

### "PrismaClientInitializationError: Database connection error"
- Double-check your Turso URL is correct (starts with `libsql://`)
- Make sure `TURSO_AUTH_TOKEN` env var is set in Vercel
- Verify the database is created in Turso dashboard

### "Function timeout exceeded"
The admin endpoints have a 30s timeout (configured in `vercel.json`). If you add a 6th league with hundreds of matches and the recompute times out, consider:
- Splitting the recompute into background jobs
- Or upgrading to Vercel Pro ($20/month) for 60s timeouts

### Cold starts are slow
Vercel serverless functions have ~1-2 second cold starts. The first request after 15+ min of inactivity may be slow. Subsequent requests are fast (<100ms).

### How to update the database schema
1. Edit `prisma/schema.prisma`
2. Run `bun run db:push` locally with Turso env vars set
3. Vercel auto-redeploys on git push (the schema change takes effect on the next request)

---

## Updating the App After Deploy

Any time you push to your `main` branch on GitHub, Vercel will automatically:
1. Build the new version
2. Deploy to a preview URL
3. Promote to production once the build succeeds

To seed new match data after deploy:
```bash
# Set Turso env vars locally, then:
bun run db:seed
```

This won't take down the production site — Turso handles concurrent reads/writes.

---

## What's Next?

Once deployed, you can:
- **Add a custom domain** (free on Vercel): e.g. `cricketpredict.yourname.com`
- **Set up analytics** (Vercel Analytics, free tier)
- **Add authentication** (NextAuth.js is already installed) for admin-only access
- **Set up automated backups** of Turso (Turso has built-in point-in-time recovery)

---

## Need Help?

- Turso docs: https://docs.turso.tech
- Vercel docs: https://vercel.com/docs
- Prisma + Turso guide: https://www.prisma.io/docs/orm/overview/databases/turso

Enjoy your free, production-ready cricket prediction platform! 🏏
