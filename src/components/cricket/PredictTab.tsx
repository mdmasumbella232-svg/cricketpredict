'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Zap, RefreshCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  fullName: string;
  color: string;
  elo: number;
}
interface Prediction {
  system: string;
  probA: number;
  predictedWinner: 'A' | 'B';
  confidence: 'Low' | 'Medium' | 'High';
}
interface PredictResponse {
  teamA: Team;
  teamB: Team;
  predictions: Prediction[];
  consensus: {
    winner: string;
    winnerSide: 'A' | 'B';
    probA: number;
    probB: number;
    confidence: 'Low' | 'Medium' | 'High';
  };
}

export default function PredictTab({ league }: { league: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamA, setTeamA] = useState<string>('');
  const [teamB, setTeamB] = useState<string>('');
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/teams?league=${league}`);
        const j = await r.json();
        if (cancelled) return;
        const t = (j.teams || []).map((x: any) => ({
          id: x.id, name: x.name, fullName: x.fullName, color: x.color, elo: x.elo,
        }));
        setTeams(t);
        if (t.length >= 2) {
          setTeamA(t[0].id);
          setTeamB(t[1].id);
        }
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [league]);

  const predict = async () => {
    if (!teamA || !teamB) {
      toast.error('Pick both teams first');
      return;
    }
    if (teamA === teamB) {
      toast.error('Pick two different teams');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/predict?league=${league}&teamA=${teamA}&teamB=${teamB}`);
      if (!r.ok) {
        const e = await r.json();
        toast.error(e.error || 'Prediction failed');
        return;
      }
      const j = await r.json();
      setResult(j);
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (teamsLoading) return <div className="text-sm text-slate-500">Loading teams…</div>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-bold tracking-tight">Live Match Prediction</h3>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Pick two teams to see predicted win probabilities from all 6 prediction systems.
          Consensus winner comes from the league-tuned Optimized-Weighted Ensemble.
        </p>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto]">
          {/* Team A selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Team A
            </label>
            <Select value={teamA} onValueChange={setTeamA}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick team A" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id} disabled={t.id === teamB}>
                    {t.name} · ELO {t.elo.toFixed(0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden items-end justify-center pb-2 sm:flex">
            <span className="text-2xl font-black text-slate-300">VS</span>
          </div>

          {/* Team B selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Team B
            </label>
            <Select value={teamB} onValueChange={setTeamB}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick team B" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id} disabled={t.id === teamA}>
                    {t.name} · ELO {t.elo.toFixed(0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={predict} disabled={loading} className="w-full sm:w-auto">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              <span className="ml-1.5">Predict</span>
            </Button>
          </div>
        </div>
      </Card>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: PredictResponse }) {
  const { teamA, teamB, predictions, consensus } = result;
  const winA = consensus.winnerSide === 'A' ? teamA : teamB;
  const loseA = consensus.winnerSide === 'A' ? teamB : teamA;
  const winProb = consensus.winnerSide === 'A' ? consensus.probA : consensus.probB;
  const loseProb = consensus.winnerSide === 'A' ? consensus.probB : consensus.probA;
  const confColor =
    consensus.confidence === 'High'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : consensus.confidence === 'Medium'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <>
      {/* Hero result card */}
      <Card className="overflow-hidden border-emerald-200">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
            <ChevronRight className="h-3 w-3" /> Consensus Prediction
          </div>
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
            {/* Team A */}
            <div className={`rounded-xl p-3 ${consensus.winnerSide === 'A' ? 'bg-white/15 ring-2 ring-white' : 'bg-black/10 opacity-80'}`}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow-lg"
                  style={{ background: teamA.color }}
                >
                  {teamA.name.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-80">{teamA.fullName}</div>
                  <div className="text-2xl font-black">{(consensus.probA * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
            <div className="text-center text-sm font-bold uppercase tracking-widest opacity-70">vs</div>
            {/* Team B */}
            <div className={`rounded-xl p-3 ${consensus.winnerSide === 'B' ? 'bg-white/15 ring-2 ring-white' : 'bg-black/10 opacity-80'}`}>
              <div className="flex items-center gap-3 sm:flex-row-reverse sm:text-right">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white shadow-lg"
                  style={{ background: teamB.color }}
                >
                  {teamB.name.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-80">{teamB.fullName}</div>
                  <div className="text-2xl font-black">{(consensus.probB * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="text-lg font-bold">
              Predicted Winner: <span className="underline decoration-2 underline-offset-4">{consensus.winner}</span>
            </div>
            <Badge variant="outline" className={`border-white/30 bg-white/10 text-white`}>
              Confidence: {consensus.confidence}
            </Badge>
          </div>
        </div>
      </Card>

      {/* All systems breakdown */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold tracking-tight">All Systems Breakdown</h3>
            <p className="text-xs text-slate-500">Probability for {teamA.name} winning</p>
          </div>
          <Badge variant="outline" className={confColor}>
            {predictions.length} systems
          </Badge>
        </div>
        <div className="space-y-3">
          {predictions.map((p) => {
            const probPct = p.probA * 100;
            const winnerSide = p.predictedWinner;
            const winnerName = winnerSide === 'A' ? teamA.name : teamB.name;
            return (
              <div key={p.system} className="flex items-center gap-3">
                <div className="w-48 shrink-0 text-sm font-medium text-slate-700">{p.system}</div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Predicts: <span className="font-bold text-slate-900">{winnerName}</span>
                    </span>
                    <span className="font-bold text-slate-900">{probPct.toFixed(1)}% {teamA.name}</span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    {/* Center line */}
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-400/40" />
                    {/* Bar from center */}
                    <div
                      className={`absolute inset-y-0 ${probPct >= 50 ? 'left-1/2' : 'right-1/2'}`}
                      style={{
                        width: `${Math.abs(probPct - 50)}%`,
                        background: probPct >= 50 ? teamA.color : teamB.color,
                      }}
                    />
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <Badge variant="outline" className={
                    p.confidence === 'High' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    p.confidence === 'Medium' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    'border-slate-200 bg-slate-50 text-slate-700'
                  }>
                    {p.confidence}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: teamA.color }} />
            {teamA.name}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: teamB.color }} />
            {teamB.name}
          </span>
        </div>
      </Card>
    </>
  );
}
