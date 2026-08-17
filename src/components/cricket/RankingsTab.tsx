'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface TeamRow {
  id: string;
  name: string;
  fullName: string;
  city: string | null;
  color: string;
  elo: number;
  matches: number;
  wins: number;
  winPct: number;
  batRunRate: number;
  bowlRunRate: number;
  form5: number;
  battingFirstWinPct: number;
  chasingWinPct: number;
}

export default function RankingsTab({ league }: { league: string }) {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/teams?league=${league}`);
        const j = await r.json();
        if (cancelled) return;
        setTeams(j.teams || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [league]);

  if (loading) return <div className="text-sm text-slate-500">Loading rankings…</div>;
  if (teams.length === 0) return <div className="text-sm text-slate-500">No teams.</div>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold tracking-tight">Team Rankings</h3>
            <p className="text-xs text-slate-500">
              Sorted by ELO. Click a team for details (coming soon).
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            {teams.length} teams
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">ELO</TableHead>
              <TableHead className="text-right hidden sm:table-cell">M</TableHead>
              <TableHead className="text-right hidden sm:table-cell">W</TableHead>
              <TableHead className="text-right">Win %</TableHead>
              <TableHead className="text-right hidden md:table-cell">Bat RR</TableHead>
              <TableHead className="text-right hidden md:table-cell">Bowl RR</TableHead>
              <TableHead className="text-right hidden lg:table-cell">BF Win %</TableHead>
              <TableHead className="text-right hidden lg:table-cell">CH Win %</TableHead>
              <TableHead className="text-right">Form5</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((t, i) => (
              <TableRow key={t.id} className="hover:bg-slate-50">
                <TableCell className="font-bold text-slate-400">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ background: t.color }}
                    >
                      {t.name.slice(0, 3)}
                    </div>
                    <div className="font-semibold">{t.fullName}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">{t.elo.toFixed(0)}</TableCell>
                <TableCell className="text-right hidden sm:table-cell">{t.matches}</TableCell>
                <TableCell className="text-right hidden sm:table-cell">{t.wins}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={
                    t.winPct >= 0.6 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    t.winPct >= 0.4 ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    'border-rose-200 bg-rose-50 text-rose-700'
                  }>
                    {(t.winPct * 100).toFixed(0)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right hidden md:table-cell font-mono text-xs">{t.batRunRate.toFixed(2)}</TableCell>
                <TableCell className="text-right hidden md:table-cell font-mono text-xs">{t.bowlRunRate.toFixed(2)}</TableCell>
                <TableCell className="text-right hidden lg:table-cell font-mono text-xs">{(t.battingFirstWinPct * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-right hidden lg:table-cell font-mono text-xs">{(t.chasingWinPct * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-right">
                  <span className={
                    t.form5 >= 0.6 ? 'font-bold text-emerald-600' :
                    t.form5 >= 0.4 ? 'font-bold text-amber-600' :
                    'font-bold text-rose-600'
                  }>
                    {(t.form5 * 100).toFixed(0)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
