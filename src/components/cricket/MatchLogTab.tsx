'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface MatchLog {
  id: string;
  matchNo: number;
  date: string;
  note: string | null;
  teamA: { id: string; name: string; color: string; score: number; wkts: number; overs: number };
  teamB: { id: string; name: string; color: string; score: number; wkts: number; overs: number };
  winner: string;
  prediction: { probA: number; correct: boolean } | null;
}

export default function MatchLogTab({ league }: { league: string }) {
  const [matches, setMatches] = useState<MatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/matches?league=${league}&limit=100`);
        const j = await r.json();
        if (cancelled) return;
        setMatches(j.matches || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [league]);

  if (loading) return <div className="text-sm text-slate-500">Loading matches…</div>;

  const filtered = matches.filter((m) => {
    if (filter === 'all') return true;
    if (!m.prediction) return false;
    if (filter === 'correct') return m.prediction.correct;
    if (filter === 'wrong') return !m.prediction.correct;
    return true;
  });
  const correct = matches.filter((m) => m.prediction?.correct).length;
  const total = matches.filter((m) => m.prediction).length;
  const acc = total > 0 ? (correct / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Match Prediction Log</h3>
            <p className="text-xs text-slate-500">
              Every prediction made by the Opt-Weighted Ensemble (walk-forward). First 5 matches of each league have no prediction (teams have no history yet).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {correct}/{total} correct · {acc.toFixed(1)}%
            </Badge>
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              {(['all', 'correct', 'wrong'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-3 py-1 font-medium capitalize transition-colors ${
                    filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No matches match this filter.
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-1">
            <div className="space-y-2">
              {filtered.map((m) => {
              const aWon = m.winner === m.teamA.name;
              const probAPct = m.prediction ? m.prediction.probA * 100 : 0;
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    m.prediction?.correct
                      ? 'border-emerald-100 bg-emerald-50/30'
                      : 'border-rose-100 bg-rose-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-10 shrink-0 text-xs font-bold text-slate-400">#{m.matchNo}</span>
                      <span className="hidden w-12 shrink-0 text-xs text-slate-500 sm:block">{m.date}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <TeamPill name={m.teamA.name} color={m.teamA.color} score={`${m.teamA.score}/${m.teamA.wkts}`} overs={m.teamA.overs} won={aWon} />
                        <span className="text-xs font-bold text-slate-400">vs</span>
                        <TeamPill name={m.teamB.name} color={m.teamB.color} score={`${m.teamB.score}/${m.teamB.wkts}`} overs={m.teamB.overs} won={!aWon} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m.prediction && (
                        <div className="hidden text-right sm:block">
                          <div className="text-xs text-slate-500">Picks</div>
                          <div className={`font-bold ${m.prediction.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {m.prediction.predictedWinner}
                          </div>
                        </div>
                      )}
                      {m.prediction?.correct ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700">
                          <XCircle className="mr-1 h-3 w-3" /> MISS
                        </Badge>
                      )}
                    </div>
                  </div>
                  {m.note && (
                    <div className="mt-1 pl-12 text-xs text-slate-400">
                      <span className="italic">{m.note}</span>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TeamPill({ name, color, score, overs, won }: { name: string; color: string; score: string; overs: number; won: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 ${won ? 'bg-slate-100' : 'opacity-70'}`}>
      <div className="h-5 w-1 shrink-0 rounded-full" style={{ background: color }} />
      <span className="shrink-0 text-xs font-bold">{name}</span>
      <span className="hidden text-xs text-slate-600 sm:inline">
        {score} <span className="text-slate-400">({overs.toFixed(1)} ov)</span>
      </span>
      {won && <span className="ml-auto text-xs font-bold text-emerald-600">WON</span>}
    </div>
  );
}
