'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Trophy, BarChart3, ListOrdered, Cpu, Zap, RefreshCw, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster } from '@/components/ui/toaster';
import { toast } from 'sonner';
import DashboardTab from '@/components/cricket/DashboardTab';
import PredictTab from '@/components/cricket/PredictTab';
import RankingsTab from '@/components/cricket/RankingsTab';
import MatchLogTab from '@/components/cricket/MatchLogTab';
import SystemComparisonTab from '@/components/cricket/SystemComparisonTab';
import InsightsTab from '@/components/cricket/InsightsTab';
import AdminTab from '@/components/cricket/AdminTab';

export interface League {
  id: string;
  name: string;
  fullName: string;
  country: string;
  season: string;
  teamCount: number;
  matchCount: number;
  bestSystem: string;
  bestAccuracy: number;
  optimalWeights: {
    elo: number; rr: number; form: number; wpct: number; h2h: number; momentum: number;
  };
  isValidation?: boolean;
}

export default function Home() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [activeLeague, setActiveLeague] = useState<string>('HUNDRED');
  const [loading, setLoading] = useState(true);
  // refreshKey increments on any admin data change (add/delete match, create league).
  // Passing it as `key` to tab components forces them to remount and refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leagues');
      const j = await r.json();
      const allLeagues = j.leagues || [];
      setLeagues(allLeagues);
      // Auto-select first non-validation league if current selection is invalid
      const visible = allLeagues.filter((l: League) => !l.isValidation);
      if (visible.length > 0 && !visible.find((l: League) => l.id === activeLeague)) {
        setActiveLeague(visible[0].id);
      }
    } catch {
      toast.error('Failed to load leagues');
    } finally {
      setLoading(false);
    }
  }, [activeLeague]);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

  // Called by AdminTab after any data mutation. Refreshes leagues list (which
  // updates hero stats + dropdown), bumps refreshKey (which forces all tabs
  // to remount and refetch their data), and optionally switches to a new league.
  const handleDataChanged = useCallback((opts?: { switchToLeague?: string }) => {
    fetchLeagues();
    setRefreshKey((k) => k + 1);
    if (opts?.switchToLeague) {
      setActiveLeague(opts.switchToLeague);
    }
  }, [fetchLeagues]);

  const current = leagues.find((l) => l.id === activeLeague);

  // Aggregate stats across all leagues (for header badge)
  const totalMatches = leagues.reduce((s, l) => s + l.matchCount, 0);
  const totalLeagues = leagues.length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight sm:text-lg">CricketPredict</h1>
              <p className="text-xs text-slate-500">T20 Match Prediction Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex border-emerald-200 bg-emerald-50 text-emerald-700">
              <Zap className="mr-1 h-3 w-3" />
              {totalMatches} matches · {totalLeagues} leagues
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => handleDataChanged()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* League selector */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {current?.fullName || 'Select a league'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {current ? `${current.country} · Season ${current.season} · ${current.teamCount} teams · ${current.matchCount} matches` : 'Loading…'}
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={activeLeague} onValueChange={setActiveLeague}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                {leagues.filter((l) => !l.isValidation).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="font-semibold">{l.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{l.season}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Hero stat strip (auto-refreshes when fetchLeagues runs) */}
        {current && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Best System"
              value={current.bestSystem.replace('Optimized-Weighted', 'Opt-Weighted')}
              tone="emerald"
              icon={<Trophy className="h-4 w-4" />}
            />
            <StatCard
              label="Best Accuracy"
              value={`${(current.bestAccuracy * 100).toFixed(1)}%`}
              tone="amber"
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <StatCard
              label="Matches"
              value={String(current.matchCount)}
              tone="sky"
              icon={<ListOrdered className="h-4 w-4" />}
            />
            <StatCard
              label="Teams"
              value={String(current.teamCount)}
              tone="violet"
              icon={<Cpu className="h-4 w-4" />}
            />
          </div>
        )}

        {/* Tabs. key={refreshKey} forces remount on data change, ensuring each tab refetches. */}
        <Tabs defaultValue="dashboard" className="w-full" key={refreshKey}>
          <TabsList className="mb-4 grid w-full grid-cols-4 sm:grid-cols-7">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
              <Activity className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="predict" className="text-xs sm:text-sm">
              <Zap className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Predict</span>
            </TabsTrigger>
            <TabsTrigger value="rankings" className="text-xs sm:text-sm">
              <Trophy className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Rankings</span>
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-xs sm:text-sm">
              <ListOrdered className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Log</span>
            </TabsTrigger>
            <TabsTrigger value="systems" className="text-xs sm:text-sm">
              <Cpu className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Systems</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs sm:text-sm">
              <BarChart3 className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="text-xs sm:text-sm">
              <Shield className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab league={activeLeague} leagueInfo={current} />
          </TabsContent>
          <TabsContent value="predict" className="mt-0">
            <PredictTab league={activeLeague} />
          </TabsContent>
          <TabsContent value="rankings" className="mt-0">
            <RankingsTab league={activeLeague} />
          </TabsContent>
          <TabsContent value="matches" className="mt-0">
            <MatchLogTab league={activeLeague} />
          </TabsContent>
          <TabsContent value="systems" className="mt-0">
            <SystemComparisonTab />
          </TabsContent>
          <TabsContent value="insights" className="mt-0">
            <InsightsTab leagues={leagues} />
          </TabsContent>
          <TabsContent value="admin" className="mt-0">
            <AdminTab leagues={leagues} onDataChanged={handleDataChanged} activeLeague={activeLeague} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>
            CricketPredict · Validated on {totalMatches} matches across {totalLeagues} T20 leagues.
            <br className="hidden sm:inline" />
            {' '}Methodology: Optimized-Weighted Ensemble of ELO, momentum, win%, run-rate, form, and H2H.
          </p>
          <p className="mt-1">Built by Z.ai Cricket Analytics · Predictions are probabilistic estimates, not certainties.</p>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: string; tone: 'emerald' | 'amber' | 'sky' | 'violet'; icon: React.ReactNode }) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  };
  const iconTones: Record<string, string> = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600',
  };
  return (
    <Card className={`p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-70">
        <span className={iconTones[tone]}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
    </Card>
  );
}
