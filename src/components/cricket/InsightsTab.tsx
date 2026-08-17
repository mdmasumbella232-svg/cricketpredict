'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe2, Layers, AlertTriangle, TrendingUp, CheckCircle2, Cpu } from 'lucide-react';
import type { League } from '@/app/page';

export default function InsightsTab({ leagues }: { leagues: League[] }) {
  const totalMatches = leagues.reduce((s, l) => s + l.matchCount, 0);
  const avgAccuracy =
    leagues.length > 0 ? leagues.reduce((s, l) => s + l.bestAccuracy, 0) / leagues.length : 0;
  const totalTeams = leagues.reduce((s, l) => s + l.teamCount, 0);

  return (
    <div className="space-y-4">
      {/* Hero summary */}
      <Card className="overflow-hidden border-emerald-200">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 text-white">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
            <Globe2 className="h-4 w-4" /> Four-League Validation
          </div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            191 matches. 4 continents. 1 methodology.
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            The Optimized-Weighted Ensemble architecture has been backtested across the IPL (India), PSL (Pakistan),
            BBL (Australia), and CPL (West Indies). It won three of four leagues outright and tied for second
            in the fourth. This is the strongest empirical evidence to date that the methodology is the right
            default choice for seasonal-scale T20 match prediction.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="Matches analysed" value={String(totalMatches)} />
            <HeroStat label="Leagues validated" value={String(leagues.length)} />
            <HeroStat label="Teams tracked" value={String(totalTeams)} />
            <HeroStat label="Avg winning accuracy" value={`${(avgAccuracy * 100).toFixed(1)}%`} />
          </div>
        </div>
      </Card>

      {/* Per-league cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {leagues.map((l) => (
          <LeagueCard key={l.id} league={l} />
        ))}
      </div>

      {/* Key findings */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-bold tracking-tight">Four-League Findings</h3>
        </div>
        <div className="space-y-3">
          <Finding
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            title="Architecture transfers, weights don't"
            body="The same six-signal weighted blend won 3 of 4 leagues. But applying one league's weights to another league's data loses 9-16 percentage points of accuracy. Each tournament requires independent weight calibration."
          />
          <Finding
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            title="Blends beat single-signal systems"
            body="Across all four leagues, the top system is always a weighted blend of multiple signals. Pure ELO, pure Pythagorean, and pure Bayesian-Shrunk all underperform their blended counterparts."
          />
          <Finding
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            title="ML models structurally fail on small samples"
            body="Random Forest, Gradient Boosting, and Stacked Ensembles finished below baseline in all 4 leagues. With 30-80 matches per season and 6-10 teams, training samples are too small. Gradient Boosting's log loss was catastrophic (2.7-3.8) in every case."
          />
          <Finding
            icon={<Cpu className="h-4 w-4 text-sky-600" />}
            title="There is a minimum viable sample size"
            body="Below ~40 matches and ~8 teams, no system beats 55% accuracy. The CPL (32 matches, 6 teams) is below this threshold and all systems collapse toward baseline. For leagues this small, pooling multiple seasons of data is essential."
          />
        </div>
      </Card>

      {/* Weight comparison table */}
      <Card className="p-5">
        <h3 className="mb-1 text-lg font-bold tracking-tight">Optimal Weights by League</h3>
        <p className="mb-4 text-sm text-slate-500">
          The system adapts its weight configuration to each league's statistical signature.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 text-left">Signal</th>
                {leagues.map((l) => (
                  <th key={l.id} className="px-2 py-2 text-center">{l.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['elo', 'rr', 'form', 'wpct', 'h2h', 'momentum'].map((k) => {
                const labels: Record<string, string> = {
                  elo: 'ELO probability', rr: 'Run-rate differential', form: 'Recent form',
                  wpct: 'Win percentage', h2h: 'Head-to-head', momentum: 'Momentum',
                };
                const values = leagues.map((l) => l.optimalWeights?.[k as keyof typeof l.optimalWeights] || 0);
                const max = Math.max(...values);
                return (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-700">{labels[k]}</td>
                    {values.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <div className={`inline-block rounded-md px-2 py-1 text-sm font-bold ${v === max && v > 0 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-700'}`}>
                          {(v * 100).toFixed(0)}%
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          <span className="font-semibold text-emerald-700">Highlighted cells</span> show the highest weight for each row.
          Notice how ELO dominates on PSL/BBL (lower-scoring leagues), while Momentum dominates on CPL (small-sample league).
        </div>
      </Card>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-300">{label}</div>
    </div>
  );
}

function LeagueCard({ league }: { league: League }) {
  const acc = league.bestAccuracy * 100;
  const tier = acc >= 60 ? 'Tier 1' : acc >= 50 ? 'Tier 2' : 'Tier 3';
  const tierColor =
    tier === 'Tier 1' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
    tier === 'Tier 2' ? 'border-amber-200 bg-amber-50 text-amber-700' :
    'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-slate-100 to-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight">{league.fullName}</h3>
            <p className="text-xs text-slate-500">
              {league.country} · Season {league.season}
            </p>
          </div>
          <Badge variant="outline" className={tierColor}>{tier}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Matches" value={String(league.matchCount)} />
          <Stat label="Teams" value={String(league.teamCount)} />
          <Stat label="Accuracy" value={`${acc.toFixed(1)}%`} />
        </div>
        <div className="mt-3 text-sm">
          <span className="text-slate-500">Best system: </span>
          <span className="font-semibold">{league.bestSystem.replace('Optimized-Weighted', 'Opt-Weighted')}</span>
        </div>
        {league.optimalWeights && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(league.optimalWeights).map(([k, v]) => (
              v > 0 && (
                <span key={k} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  <span className="font-semibold uppercase">{k}</span>: {(v * 100).toFixed(0)}%
                </span>
              )
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Finding({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <p className="mt-1 text-sm text-slate-600">{body}</p>
      </div>
    </div>
  );
}
