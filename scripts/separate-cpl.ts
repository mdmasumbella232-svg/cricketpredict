/**
 * Separate CPL into two leagues:
 * 1. Rename current CPL → "Caribbean Premier League 2025" (season 2025)
 * 2. Delete the 9 CPL 2026 matches from CPL
 * 3. Delete JKM team from CPL (only played in 2026)
 * 4. Create new league CPL6 → "Caribbean Premier League 2026" (season 2026)
 * 5. Add 7 teams to CPL6
 * 6. Add 9 CPL 2026 matches to CPL6 in chronological order
 */
const BASE = 'https://cricketpredict.vercel.app';

// Team data for CPL 2026 (with colors matching the existing CPL teams)
const TEAMS = [
  { code: 'SKNP', fullName: 'St Kitts & Nevis Patriots', color: '#d32f2f', city: 'St Kitts' },
  { code: 'ABF', fullName: 'Antigua & Barbuda Falcons', color: '#1976d2', city: 'Antigua' },
  { code: 'GAW', fullName: 'Guyana Amazon Warriors', color: '#388e3c', city: 'Guyana' },
  { code: 'BT', fullName: 'Barbados Royals', color: '#7b1fa2', city: 'Barbados' },
  { code: 'TKR', fullName: 'Trinbago Knight Riders', color: '#f57c00', city: 'Trinidad' },
  { code: 'SLK', fullName: 'Saint Lucia Kings', color: '#00838f', city: 'St Lucia' },
  { code: 'JKM', fullName: 'Jamaica Kingsmen', color: '#fbc02d', city: 'Jamaica' },
];

// 9 CPL 2026 matches in chronological order
const CPL_2026_MATCHES: [string, string, number, number, number, string, number, number, number, string, string?][] = [
  ['Aug 8', 'JKM', 167, 7, 20, 'ABF', 168, 8, 20, 'ABF'],
  ['Aug 9', 'SKNP', 109, 9, 20, 'TKR', 94, 2, 15, 'TKR', 'DLS Method'],
  ['Aug 10', 'ABF', 183, 7, 20, 'SLK', 187, 8, 20, 'SLK'],
  ['Aug 12', 'JKM', 201, 9, 20, 'BT', 206, 3, 20, 'BT'],
  ['Aug 13', 'SLK', 155, 8, 20, 'SKNP', 156, 5, 17.4, 'SKNP'],
  ['Aug 14', 'JKM', 117, 10, 19.4, 'GAW', 118, 4, 14.1, 'GAW'],
  ['Aug 15', 'SLK', 54, 7, 7.4, 'ABF', 98, 9, 19, 'SLK', 'DLS Method'],
  ['Aug 16', 'JKM', 183, 5, 18.4, 'TKR', 182, 6, 20, 'JKM'],
  ['Aug 17', 'BT', 177, 5, 18, 'SLK', 168, 7, 18, 'BT'],
];

async function main() {
  console.log('=== Separating CPL into CPL 2025 + CPL 2026 ===\n');

  // Step 1: Rename current CPL league to 2025
  console.log('1. Renaming CPL league to "Caribbean Premier League 2025"...');
  const renameResp = await fetch(`${BASE}/api/admin/league/CPL`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Caribbean Premier League 2025',
      season: '2025',
      name: 'CPL',
    }),
  });
  const renameJson = await renameResp.json();
  console.log(`   ${renameResp.ok ? '✅' : '❌'} ${renameJson.league?.fullName || renameJson.error}`);

  // Step 2: Get all CPL matches and find the 9 CPL 2026 ones (match #35-#43)
  console.log('\n2. Finding CPL 2026 matches to delete...');
  const matchesResp = await fetch(`${BASE}/api/matches?league=CPL&limit=200`);
  const matchesJson = await matchesResp.json();
  const allMatches = matchesJson.matches || [];
  
  // CPL 2026 matches are the ones with JKM or dates in August 8-17 range
  // More reliably: they're match #35 and above
  const cpl2026Matches = allMatches.filter((m: any) => m.matchNo >= 35);
  console.log(`   Found ${cpl2026Matches.length} CPL 2026 matches to delete`);
  
  // Delete them one by one
  for (const m of cpl2026Matches) {
    console.log(`   Deleting ${m.id} (#${m.matchNo}): ${m.teamA.name} vs ${m.teamB.name}`);
    await fetch(`${BASE}/api/admin/match?leagueId=CPL&matchId=${m.id}`, { method: 'DELETE' });
    await new Promise(r => setTimeout(r, 4000));
  }

  // Step 3: Delete JKM team from CPL (only played in 2026 matches)
  console.log('\n3. Deleting JKM team from CPL league...');
  const delTeamResp = await fetch(`${BASE}/api/admin/team/CPL_JKM`, { method: 'DELETE' });
  const delTeamJson = await delTeamResp.json();
  console.log(`   ${delTeamResp.ok ? '✅' : '❌'} ${delTeamJson.deleted ? `Deleted (matches: ${delTeamJson.deleted.matches})` : delTeamJson.error}`);

  // Step 4: Create new CPL6 league for 2026
  console.log('\n4. Creating new league CPL6 (Caribbean Premier League 2026)...');
  const leagueResp = await fetch(`${BASE}/api/admin/league`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'CPL6',
      name: 'CPL 2026',
      fullName: 'Caribbean Premier League 2026',
      country: 'West Indies',
      season: '2026',
      weights: { elo: 0.20, rr: 0.10, form: 0.20, wpct: 0.15, h2h: 0.05, momentum: 0.30 },
    }),
  });
  const leagueJson = await leagueResp.json();
  console.log(`   ${leagueResp.ok ? '✅' : '❌'} ${leagueJson.league?.id || leagueJson.error}`);

  // Step 5: Add 7 teams to CPL6
  console.log('\n5. Adding 7 teams to CPL6...');
  for (const t of TEAMS) {
    const r = await fetch(`${BASE}/api/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId: 'CPL6', shortCode: t.code, fullName: t.fullName, color: t.color, city: t.city }),
    });
    const j = await r.json();
    console.log(`   ${r.ok ? '✅' : '⊙'} ${t.code} - ${t.fullName}`);
  }

  // Step 6: Add 9 CPL 2026 matches to CPL6
  console.log(`\n6. Adding ${CPL_2026_MATCHES.length} matches to CPL6...`);
  let success = 0;
  for (const m of CPL_2026_MATCHES) {
    const [date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, note] = m;
    try {
      const r = await fetch(`${BASE}/api/admin/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: 'CPL6', date,
          teamAId: teamA, teamAScore: aRuns, teamAWickets: aWk, teamAOvers: aOv,
          teamBId: teamB, teamBScore: bRuns, teamBWickets: bWk, teamBOvers: bOv,
          winnerId: winner === teamA ? 'A' : 'B',
          battingFirstId: winner === teamA ? 'B' : 'A',
          note: note || undefined,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        console.log(`  ✅ ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${note ? ` (${note})` : ''}`);
        success++;
      } else {
        console.log(`  ❌ ${teamA} vs ${teamB}: ${j.error || JSON.stringify(j)}`);
      }
    } catch (e: any) {
      console.log(`  ❌ ${teamA} vs ${teamB}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 8000));
  }

  console.log(`\n=== Done ===`);
  console.log(`CPL (2025): renamed, 9 matches removed, JKM team removed`);
  console.log(`CPL6 (2026): created, 7 teams added, ${success}/${CPL_2026_MATCHES.length} matches added`);
}

main().catch(e => { console.error(e); process.exit(1); });
