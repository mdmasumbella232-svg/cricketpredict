'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Trash2, Trophy, RefreshCw, Database, Info, CheckCircle2, XCircle } from 'lucide-react';
import type { League } from '@/app/page';

interface TeamOption {
  id: string;
  name: string;
  elo: number;
}

export default function AdminTab({ leagues }: { leagues: League[] }) {
  const [tab, setTab] = useState('match');

  return (
    <div className="space-y-4">
      <Card className="p-4 border-amber-200 bg-amber-50/50">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Admin Console</p>
            <p className="mt-1 text-amber-800">
              Add new matches or leagues here. When you add a match, the system automatically:
              (1) inserts it into the database, (2) deletes all old predictions for that league,
              (3) re-runs the walk-forward simulation through every match in chronological order,
              (4) regenerates predictions from all 6 systems, and (5) updates all team ELO ratings.
              All other tabs (Dashboard, Rankings, etc.) will reflect the new data immediately.
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="match">
            <Plus className="mr-1.5 h-4 w-4" /> Add Match
          </TabsTrigger>
          <TabsTrigger value="league">
            <Trophy className="mr-1.5 h-4 w-4" /> Create League
          </TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="mt-4">
          <AddMatchForm leagues={leagues} />
        </TabsContent>
        <TabsContent value="league" className="mt-4">
          <CreateLeagueForm onCreated={() => setTimeout(() => window.location.reload(), 1500)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Add Match Form
// ============================================================
function AddMatchForm({ leagues }: { leagues: League[] }) {
  const [leagueId, setLeagueId] = useState(leagues[0]?.id || 'IPL');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [date, setDate] = useState('');
  const [aScore, setAScore] = useState('');
  const [aWkts, setAWkts] = useState('');
  const [aOvers, setAOvers] = useState('');
  const [bScore, setBScore] = useState('');
  const [bWkts, setBWkts] = useState('');
  const [bOvers, setBOvers] = useState('');
  const [winner, setWinner] = useState<'A' | 'B'>('A');
  const [battingFirst, setBattingFirst] = useState<'A' | 'B'>('A');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/teams?league=${leagueId}`);
        const j = await r.json();
        if (cancelled) return;
        const t = (j.teams || []).map((x: any) => ({ id: x.id, name: x.name, elo: x.elo }));
        setTeams(t);
        if (t.length >= 2) {
          setTeamA(t[0].id);
          setTeamB(t[1].id);
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, [leagueId]);

  const inferBattingFirst = () => {
    // Heuristic: if winner won by runs, winner batted first; if by wickets, winner chased.
    // Here the user manually picks batting first - but we can suggest based on scores.
    const aRuns = parseInt(aScore) || 0;
    const bRuns = parseInt(bScore) || 0;
    const aW = parseInt(aWkts) || 0;
    const bW = parseInt(bWkts) || 0;
    const aOv = parseFloat(aOvers) || 0;
    const bOv = parseFloat(bOvers) || 0;

    // If team A won and batted first, A's score was set and B chased
    // If team A won chasing, B batted first
    // Most common case: if winner batted first, they scored more runs in 20 overs; if chasing, fewer overs
    if (winner === 'A') {
      // If A's overs < 20, likely chased (B batted first)
      // If A's overs = 20 and won, batted first
      if (aOv < 20 && aOv > 0) {
        setBattingFirst('B');
      } else {
        setBattingFirst('A');
      }
    } else {
      if (bOv < 20 && bOv > 0) {
        setBattingFirst('A');
      } else {
        setBattingFirst('B');
      }
    }
  };

  const submit = async () => {
    // Validate
    if (!teamA || !teamB || !date || !aScore || !aWkts || !aOvers || !bScore || !bWkts || !bOvers) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (teamA === teamB) {
      toast.error('Team A and Team B must be different');
      return;
    }
    const payload = {
      leagueId,
      date,
      teamAId: teamA,
      teamAScore: parseInt(aScore),
      teamAWickets: parseInt(aWkts),
      teamAOvers: parseFloat(aOvers),
      teamBId: teamB,
      teamBScore: parseInt(bScore),
      teamBWickets: parseInt(bWkts),
      teamBOvers: parseFloat(bOvers),
      winnerId: winner,
      battingFirstId: battingFirst,
      note: note || undefined,
    };
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch('/api/admin/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || 'Failed to add match');
        return;
      }
      toast.success(`Match added! ${j.predictionsRegenerated} predictions regenerated.`);
      setResult(j);
      // Reset form
      setAScore(''); setAWkts(''); setAOvers('');
      setBScore(''); setBWkts(''); setBOvers('');
      setNote('');
    } catch (e) {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const teamAObj = teams.find((t) => t.id === teamA);
  const teamBObj = teams.find((t) => t.id === teamB);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Plus className="h-5 w-5 text-emerald-600" />
        <h3 className="text-lg font-bold tracking-tight">Add a Match</h3>
      </div>

      {/* League + Date */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">League</Label>
          <Select value={leagueId} onValueChange={setLeagueId}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {leagues.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.fullName} ({l.season})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Date (e.g. "May 30")</Label>
          <Input className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} placeholder="May 30" />
        </div>
      </div>

      {/* Teams */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Team A</Label>
          <Select value={teamA} onValueChange={setTeamA}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id} disabled={t.id === teamB}>
                  {t.name} · ELO {t.elo.toFixed(0)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Team B</Label>
          <Select value={teamB} onValueChange={setTeamB}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id} disabled={t.id === teamA}>
                  {t.name} · ELO {t.elo.toFixed(0)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Scores */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {/* Team A scorecard */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-sm font-bold">{teamAObj?.name || 'Team A'} Scorecard</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-slate-500">Runs</Label>
              <Input type="number" value={aScore} onChange={(e) => setAScore(e.target.value)} placeholder="180" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-slate-500">Wkts</Label>
              <Input type="number" value={aWkts} onChange={(e) => setAWkts(e.target.value)} placeholder="4" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-slate-500">Overs</Label>
              <Input type="number" step="0.1" value={aOvers} onChange={(e) => setAOvers(e.target.value)} placeholder="20" />
            </div>
          </div>
        </div>
        {/* Team B scorecard */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-sm font-bold">{teamBObj?.name || 'Team B'} Scorecard</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-slate-500">Runs</Label>
              <Input type="number" value={bScore} onChange={(e) => setBScore(e.target.value)} placeholder="175" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-slate-500">Wkts</Label>
              <Input type="number" value={bWkts} onChange={(e) => setBWkts(e.target.value)} placeholder="7" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-slate-500">Overs</Label>
              <Input type="number" step="0.1" value={bOvers} onChange={(e) => setBOvers(e.target.value)} placeholder="20" />
            </div>
          </div>
        </div>
      </div>

      {/* Winner + Batting first */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Winner</Label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setWinner('A')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                winner === 'A' ? 'border-emerald-500 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {teamAObj?.name || 'A'}
            </button>
            <button
              type="button"
              onClick={() => setWinner('B')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                winner === 'B' ? 'border-emerald-500 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {teamBObj?.name || 'B'}
            </button>
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">
            Batting First
            <button onClick={inferBattingFirst} className="ml-2 text-[10px] text-emerald-600 hover:underline">
              (auto-infer)
            </button>
          </Label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setBattingFirst('A')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                battingFirst === 'A' ? 'border-sky-500 bg-sky-100 text-sky-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {teamAObj?.name || 'A'}
            </button>
            <button
              type="button"
              onClick={() => setBattingFirst('B')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                battingFirst === 'B' ? 'border-sky-500 bg-sky-100 text-sky-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {teamBObj?.name || 'B'}
            </button>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="mb-4">
        <Label className="text-xs uppercase tracking-wide text-slate-500">Note (optional)</Label>
        <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Final, Qualifier, DLS Method" />
      </div>

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        <span className="ml-1.5">{submitting ? 'Adding & recomputing...' : 'Add Match & Recompute Predictions'}</span>
      </Button>

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Match Added Successfully
          </div>
          <div className="mt-2 text-sm text-emerald-700">
            <div>Match #{result.match.matchNo} added to {result.match.teamAId.replace(`${leagueId}_`, '')} vs {result.match.teamBId.replace(`${leagueId}_`, '')}</div>
            <div className="mt-1">Predictions regenerated: <span className="font-bold">{result.predictionsRegenerated}</span></div>
            <div className="mt-1">
              New league best system: <span className="font-bold">{result.leagueBestSystem.replace('Optimized-Weighted', 'Opt-Weighted')}</span> ({(result.leagueBestAccuracy * 100).toFixed(1)}%)
            </div>
          </div>
        </div>
      )}

      <Separator className="my-4" />

      <RecentMatches leagueId={leagueId} />
    </Card>
  );
}

// ============================================================
// Recent Matches (with delete buttons)
// ============================================================
function RecentMatches({ leagueId }: { leagueId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/matches?league=${leagueId}&limit=200`);
        const j = await r.json();
        if (cancelled) return;
        setMatches(j.matches || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [leagueId]);

  const removeMatch = async (matchId: string, matchNo: number) => {
    if (!confirm(`Delete match #${matchNo}? This will recompute all predictions for this league.`)) return;
    try {
      const r = await fetch(`/api/admin/match?leagueId=${leagueId}&matchId=${matchId}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || 'Failed to delete');
        return;
      }
      toast.success(`Match #${matchNo} deleted. ${j.predictionsRegenerated} predictions regenerated.`);
      // Refresh list
      const r2 = await fetch(`/api/matches?league=${leagueId}&limit=200`);
      const j2 = await r2.json();
      setMatches(j2.matches || []);
    } catch {
      toast.error('Network error');
    }
  };

  if (loading) return <div className="text-xs text-slate-500">Loading recent matches…</div>;

  // Show most recent 10 (highest match numbers first)
  const recent = [...matches].sort((a, b) => b.matchNo - a.matchNo).slice(0, 10);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-bold tracking-tight">Recent Matches (latest 10)</h4>
      </div>
      <div className="space-y-1.5">
        {recent.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-3 py-2 text-xs">
            <span className="font-mono text-slate-400">#{m.matchNo}</span>
            <span className="w-12 text-slate-500">{m.date}</span>
            <span className="flex-1 truncate">
              <span className="font-semibold">{m.teamA.name}</span>
              <span className="mx-1 text-slate-400">{m.teamA.score}/{m.teamA.wkts}</span>
              <span className="mx-1 text-slate-300">vs</span>
              <span className="font-semibold">{m.teamB.name}</span>
              <span className="mx-1 text-slate-400">{m.teamB.score}/{m.teamB.wkts}</span>
            </span>
            <span className="font-semibold text-emerald-600">{m.winner} won</span>
            <button
              onClick={() => removeMatch(m.id, m.matchNo)}
              className="ml-2 rounded p-1 text-rose-500 hover:bg-rose-50"
              title="Delete match"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Create League Form
// ============================================================
function CreateLeagueForm({ onCreated }: { onCreated: () => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [season, setSeason] = useState('');
  const [weights, setWeights] = useState({ elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!id || !name || !fullName || !country || !season) {
      toast.error('Fill in all fields');
      return;
    }
    if (id.includes('_') || id.includes(' ')) {
      toast.error('League ID must not contain _ or spaces');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id.toUpperCase(), name, fullName, country, season, weights }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || 'Failed to create league');
        return;
      }
      toast.success(`League ${id.toUpperCase()} created! Reloading...`);
      onCreated();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalW = Object.values(weights).reduce((s, v) => s + v, 0);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-600" />
        <h3 className="text-lg font-bold tracking-tight">Create a New League</h3>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">League ID (short, e.g. "BPL")</Label>
          <Input className="mt-1" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} placeholder="BPL" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Short Name</Label>
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bangladesh Premier League" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Full Name</Label>
          <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Bangladesh Premier League 2026" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Country</Label>
          <Input className="mt-1" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Bangladesh" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Season</Label>
          <Input className="mt-1" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026" />
        </div>
      </div>

      <Separator className="my-4" />

      {/* Weights */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-slate-500">Prediction Weights (must sum to 1.0)</Label>
          <Badge variant="outline" className={Math.abs(totalW - 1) < 0.05 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}>
            Sum: {totalW.toFixed(2)}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {([
            ['elo', 'ELO'],
            ['momentum', 'Momentum'],
            ['rr', 'Run Rate'],
            ['form', 'Recent Form'],
            ['wpct', 'Win %'],
            ['h2h', 'Head-to-Head'],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <Label className="text-[10px] uppercase text-slate-500">{label}</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: parseFloat(e.target.value) || 0 })}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <Info className="mr-1 inline h-3 w-3" />
          Default weights match IPL. Tune per league: higher ELO weight for shorter seasons, more momentum for high-variance leagues.
        </p>
      </div>

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
        <span className="ml-1.5">{submitting ? 'Creating...' : 'Create League'}</span>
      </Button>
    </Card>
  );
}
