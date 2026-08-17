'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Cpu, Trophy } from 'lucide-react';

interface SystemRow {
  system: string;
  perLeague: Record<string, { accuracy: number; correct: number; total: number }>;
  avg: number;
  totalCorrect: number;
  totalCount: number;
}

export default function SystemComparisonTab() {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/system-comparison');
        const j = await r.json();
        if (cancelled) return;
        setSystems(j.systems || []);
        setLeagues(j.leagues || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="text-sm text-slate-500">Loading system comparison…</div>;
  if (systems.length === 0) return <div className="text-sm text-slate-500">No data.</div>;

  const winner = systems[0];

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          <Trophy className="h-4 w-4" /> Best System Overall
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="text-2xl font-black tracking-tight">{winner.system}</span>
          <span className="text-lg font-bold text-emerald-700">{(winner.avg * 100).toFixed(1)}%</span>
          <span className="text-sm text-slate-500">
            ({winner.totalCorrect}/{winner.totalCount} correct across 4 leagues)
          </span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-bold tracking-tight">Cross-League System Comparison</h3>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Same architectures backtested across IPL/PSL/BBL/CPL. Cells show accuracy %.
          The Opt-Weighted variants use league-specific weights (which is why they vary widely).
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>System</TableHead>
              {leagues.map((l) => (
                <TableHead key={l} className="text-right">{l}</TableHead>
              ))}
              <TableHead className="text-right">Avg</TableHead>
              <TableHead className="text-right hidden md:table-cell">N</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems.map((s, idx) => (
              <TableRow key={s.system} className={idx === 0 ? 'bg-emerald-50/50' : ''}>
                <TableCell className="font-semibold">{s.system}</TableCell>
                {leagues.map((l) => {
                  const v = s.perLeague[l];
                  const acc = v.accuracy * 100;
                  const tone =
                    acc >= 60 ? 'text-emerald-700 font-bold' :
                    acc >= 50 ? 'text-amber-700 font-semibold' :
                    'text-rose-700';
                  return (
                    <TableCell key={l} className={`text-right ${tone}`}>
                      {v.total > 0 ? `${acc.toFixed(1)}%` : '—'}
                      <div className="text-[10px] font-normal text-slate-400">
                        {v.total > 0 ? `${v.correct}/${v.total}` : ''}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-bold">
                  <Badge variant="outline" className={
                    s.avg >= 0.55 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    s.avg >= 0.45 ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    'border-rose-200 bg-rose-50 text-rose-700'
                  }>
                    {(s.avg * 100).toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right hidden md:table-cell text-slate-500">
                  {s.totalCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
