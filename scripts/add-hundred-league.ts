/**
 * Add The Hundred 2026 Men league to the live Vercel deployment.
 * 8 teams, 34 matches (32 playable, 2 abandoned).
 */
const BASE = 'https://cricketpredict.vercel.app';

// The Hundred uses 100-ball innings (16.4 overs equivalent). Format is same as T20.
const TEAMS = [
  { code: 'MIL', fullName: 'Manchester Originals', color: '#d32f2f', city: 'Manchester' },
  { code: 'SRL', fullName: 'Southern Brave', color: '#1976d2', city: 'Southampton' },
  { code: 'SB', fullName: 'Trent Rockets', color: '#f57c00', city: 'Nottingham' },
  { code: 'WF', fullName: 'Welsh Fire', color: '#c62828', city: 'Cardiff' },
  { code: 'LS', fullName: 'London Spirit', color: '#388e3c', city: 'London' },
  { code: 'MSG', fullName: 'Northern Superchargers', color: '#7b1fa2', city: 'Leeds' },
  { code: 'BP', fullName: 'Birmingham Phoenix', color: '#fbc02d', city: 'Birmingham' },
  { code: 'TR', fullName: 'Oval Invincibles', color: '#00838f', city: 'London' },
];

// All 34 matches. Note: "Leeds" in source = MSG (Northern Superchargers, based in Leeds)
// Format: [matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, battingFirst, note?]
const MATCHES: [number, string, string, number, number, string, string, number, number, string, string, string, string?][] = [
  [1, 'Jul 21', 'MIL', 144, 3, '16.4', 'SRL', 143, 10, '19.4', 'MIL', 'SRL'],
  [2, 'Jul 22', 'SB', 135, 7, '20', 'WF', 138, 4, '19.3', 'WF', 'SB'],
  [3, 'Jul 23', 'LS', 131, 6, '20', 'MSG', 138, 9, '20', 'MSG', 'LS'],
  [4, 'Jul 24', 'BP', 214, 4, '20', 'TR', 204, 7, '20', 'BP', 'BP'],
  [5, 'Jul 25', 'SRL', 187, 5, '20', 'SB', 182, 5, '20', 'SRL', 'SB'],
  [6, 'Jul 25', 'WF', 167, 5, '20', 'MIL', 152, 6, '20', 'WF', 'WF'],
  [7, 'Jul 26', 'MSG', 187, 5, '20', 'BP', 100, 10, '19.2', 'MSG', 'MSG'],
  [8, 'Jul 26', 'TR', 160, 6, '19.3', 'LS', 159, 9, '20', 'TR', 'TR'],
  [9, 'Jul 27', 'SB', 129, 9, '20', 'MIL', 130, 7, '20', 'MIL', 'SB'],
  [10, 'Jul 28', 'SRL', 186, 2, '17.3', 'MSG', 181, 3, '20', 'SRL', 'MSG'],
  [11, 'Jul 29', 'WF', 122, 7, '20', 'TR', 126, 1, '14.2', 'TR', 'WF'],
  [12, 'Jul 29', 'MIL', 164, 5, '20', 'LS', 165, 3, '17.4', 'LS', 'MIL'],
  [13, 'Jul 30', 'SB', 128, 8, '20', 'BP', 116, 9, '20', 'SB', 'SB'],
  [14, 'Jul 31', 'MSG', 137, 3, '20', 'TR', 140, 4, '17.2', 'TR', 'MSG'],
  [15, 'Aug 1', 'BP', 137, 9, '20', 'WF', 138, 3, '19.1', 'WF', 'BP'],
  [16, 'Aug 1', 'LS', 105, 10, '18.2', 'SB', 111, 5, '19.2', 'SB', 'LS'],
  [17, 'Aug 2', 'TR', 146, 4, '20', 'SRL', 141, 4, '20', 'TR', 'TR'],
  [18, 'Aug 2', 'MIL', 183, 6, '20', 'MSG', 138, 10, '19', 'MIL', 'MIL'],
  [19, 'Aug 3', 'WF', 116, 4, '19', 'SB', 115, 8, '20', 'WF', 'WF'],
  [20, 'Aug 4', 'SRL', 241, 2, '20', 'LS', 204, 6, '20', 'SRL', 'LS'],
  [21, 'Aug 5', 'MSG', 161, 1, '13.4', 'WF', 155, 4, '20', 'MSG', 'WF'],
  [22, 'Aug 5', 'TR', 116, 3, '16.3', 'BP', 111, 6, '20', 'TR', 'TR'],
  [23, 'Aug 6', 'LS', 160, 5, '20', 'MIL', 164, 6, '18.4', 'MIL', 'LS'],
  [24, 'Aug 7', 'BP', 124, 8, '20', 'SRL', 169, 7, '20', 'SRL', 'BP'],
  [25, 'Aug 8', 'MIL', 147, 7, '20', 'TR', 148, 4, '18', 'TR', 'MIL'],
  [26, 'Aug 8', 'SB', 139, 6, '20', 'MSG', 149, 8, '20', 'MSG', 'SB'],
  [27, 'Aug 9', 'SRL', 201, 4, '20', 'WF', 130, 6, '20', 'SRL', 'WF'],
  [28, 'Aug 9', 'LS', 166, 3, '16.2', 'BP', 162, 4, '20', 'LS', 'LS'],
  [29, 'Aug 10', 'TR', 158, 5, '20', 'SB', 159, 4, '19.2', 'SB', 'TR'],
  [30, 'Aug 11', 'MSG', 128, 0, '13.2', 'SRL', 127, 10, '20', 'MSG', 'SRL'],
  [31, 'Aug 12', 'WF', 125, 7, '20', 'LS', 131, 8, '20', 'LS', 'WF'],
  [32, 'Aug 12', 'BP', 155, 7, '20', 'MIL', 157, 6, '20', 'MIL', 'BP'],
  [33, 'Aug 14', 'MSG', 186, 4, '20', 'SRL', 166, 7, '20', 'MSG', 'MSG', 'Eliminator'],
  [34, 'Aug 16', 'TR', 158, 8, '20', 'MSG', 162, 5, '19.3', 'MSG', 'TR', 'Final'],
];

async function addMatch(m: typeof MATCHES[0]): Promise<boolean> {
  const [matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, batFirst, note] = m;
  try {
    const r = await fetch(`${BASE}/api/admin/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId: 'HUNDRED',
        date,
        teamAId: teamA, teamAScore: aRuns, teamAWickets: aWk, teamAOvers: parseFloat(aOv),
        teamBId: teamB, teamBScore: bRuns, teamBWickets: bWk, teamBOvers: parseFloat(bOv),
        winnerId: winner === teamA ? 'A' : 'B',
        battingFirstId: batFirst === teamA ? 'A' : 'B',
        note: note || undefined,
      }),
    });
    const j = await r.json();
    if (r.ok) {
      console.log(`  ✅ #${matchNo}: ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${note ? ` (${note})` : ''}`);
      return true;
    } else {
      console.log(`  ❌ #${matchNo}: ${j.error || JSON.stringify(j)}`);
      return false;
    }
  } catch (e: any) {
    console.log(`  ❌ #${matchNo}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('Adding The Hundred 2026 Men league to Vercel...\n');

  // Step 1: Create league
  console.log('1. Creating league HUNDRED...');
  const leagueResp = await fetch(`${BASE}/api/admin/league`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'HUNDRED',
      name: 'The Hundred',
      fullName: 'The Hundred 2026 Men',
      country: 'England',
      season: '2026',
      weights: { elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 },
    }),
  });
  const leagueJson = await leagueResp.json();
  if (!leagueResp.ok && !leagueJson.error?.includes('already exists')) {
    console.error('Failed to create league:', leagueJson);
    return;
  }
  console.log(`   ✅ League ${leagueJson.league?.id || 'HUNDRED'} created\n`);

  // Step 2: Add teams
  console.log('2. Adding 8 teams...');
  for (const t of TEAMS) {
    const r = await fetch(`${BASE}/api/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId: 'HUNDRED', shortCode: t.code, fullName: t.fullName, color: t.color, city: t.city }),
    });
    const j = await r.json();
    console.log(`   ${r.ok ? '✅' : '⊙'} ${t.code} - ${t.fullName}`);
  }

  // Step 3: Add matches one by one
  console.log(`\n3. Adding ${MATCHES.length} matches...`);
  let success = 0, fail = 0;
  for (const m of MATCHES) {
    const ok = await addMatch(m);
    if (ok) success++; else fail++;
  }

  console.log(`\n=== Done ===`);
  console.log(`League: HUNDRED (The Hundred 2026 Men)`);
  console.log(`Teams: 8 added`);
  console.log(`Matches: ${success} added, ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
