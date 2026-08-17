'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';
import type { League } from '@/app/page';

export interface TeamBrief {
  id: string;
  name: string;
  fullName: string;
  color: string;
  elo: number;
  matches: number;
  wins: number;
  winPct: number;
  batRunRate: number;
  bowlRunRate: number;
  form5: number;
}

export default function DashboardTab({ league, leagueInfo }: { league: string; leagueInfo?: League }) {
  const [teams, setTeams] = useState<TeamBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/teams?league=${league}`);
        const j = await r.json();
        if (cancelled) return;
        setTeams(j.teams || []);
      } catch {
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [league]);

  if (loading) return <div className="text-sm text-slate-500">Loading dashboard…</div>;
  if (teams.length === 0) return <div className="text-sm text-slate-500">No teams found.</div>;

  const topTeam = teams[0];
  const bottomTeam = teams[teams.length - 1];
  const avgElo = teams.reduce((s, t) => s + t.elo, 0) / teams.length;
  const maxElo = Math.max(...teams.map((t) => t.elo));
  const minElo = Math.min(...teams.map((t) => t.elo));

  // Form: percentage of teams above 0.5 win rate
  const winningTeams = teams.filter((t) => t.winPct > 0.5).length;

  return (
    <div className="space-y-6">
      {/* League spotlight */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <TrendingUp className="h-4 w-4" /> League Leader
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow-md"
              style={{ background: topTeam.color }}
            >
              {topTeam.name.slice(0, 3)}
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">{topTeam.fullName}</div>
              <div className="text-sm text-slate-600">
                ELO {topTeam.elo.toFixed(0)} · {topTeam.wins}W / {topTeam.matches - topTeam.wins}L
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Win %</span>
              <span>{(topTeam.winPct * 100).toFixed(1)}%</span>
            </div>
            <Progress value={topTeam.winPct * 100} className="h-2" />
          </div>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <Activity className="h-4 w-4" /> League Pulse
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Avg ELO" value={avgElo.toFixed(0)} />
            <Stat label="ELO Spread" value={(maxElo - minElo).toFixed(0)} />
            <Stat label="Winning teams" value={`${winningTeams}/${teams.length}`} />
            <Stat label="Avg run rate" value={(teams.reduce((s, t) => s + t.batRunRate, 0) / teams.length).toFixed(2)} />
          </div>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <AlertCircle className="h-4 w-4" /> Bottom Team
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow-md"
              style={{ background: bottomTeam.color }}
            >
              {bottomTeam.name.slice(0, 3)}
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">{bottomTeam.fullName}</div>
              <div className="text-sm text-slate-600">
                ELO {bottomTeam.elo.toFixed(0)} · {bottomTeam.wins}W / {bottomTeam.matches - bottomTeam.wins}L
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Win %</span>
              <span>{(bottomTeam.winPct * 100).toFixed(1)}%</span>
            </div>
            <Progress value={bottomTeam.winPct * 100} className="h-2" />
          </div>
        </Card>
      </div>

      {/* Team grid with ELO bars */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Team Strength Ratings</h3>
            <p className="text-sm text-slate-500">
              Current ELO ratings after walk-forward through all completed matches
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            {teams.length} teams
          </Badge>
        </div>
        <div className="space-y-3">
          {teams.map((t, i) => {
            const spread = maxElo - minElo;
            const pct = spread > 0 ? ((t.elo - minElo) / spread) * 100 : 50;
            return (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-6 text-right text-sm font-bold text-slate-400">#{i + 1}</div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                  style={{ background: t.color }}
                >
                  {t.name.slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{t.fullName}</span>
                    <span className="text-sm font-bold text-slate-700">{t.elo.toFixed(0)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: t.color }}
                    />
                  </div>
                </div>
                <div className="hidden sm:block w-28 text-right text-xs text-slate-500">
                  {t.wins}W-{t.matches - t.wins}L · {(t.winPct * 100).toFixed(0)}%
                </div>
                <div className="hidden md:block w-20 text-right text-xs text-slate-500">
                  Form: {(t.form5 * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Optimal weights visualizer */}
      {leagueInfo?.optimalWeights && (
        <Card className="p-5">
          <h3 className="mb-1 text-lg font-bold tracking-tight">
            Optimal Prediction Weights for {leagueInfo.fullName}
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            Grid-searched weights that maximise backtest accuracy for this league
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(leagueInfo.optimalWeights).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {k === 'elo' ? 'ELO' : k === 'rr' ? 'Run Rate' : k === 'wpct' ? 'Win %' : k === 'h2h' ? 'Head-to-Head' : k === 'form' ? 'Recent Form' : 'Momentum'}
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">{(v * 100).toFixed(0)}%</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{ width: `${v * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
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
