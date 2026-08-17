/**
 * Add Assam T20 2026 league + all 34 matches to the live Vercel deployment.
 * Uses the production API endpoints at https://cricketpredict.vercel.app
 *
 * Run: bun run scripts/add-assam-league.ts
 */
import { League, Team, Match } from '../src/lib/types';

const BASE = 'https://cricketpredict.vercel.app';

// All 34 Assam T20 2026 matches
// Format: [matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, battingFirst, note?]
// Teams: CS, BB, TT, DW, BL, GR, JS, NR (8 teams)
const ASSAM_MATCHES: [number, string, string, number, number, string, string, number, number, string, string, string, string?][] = [
  [1, 'Aug 1', 'CS', 157, 6, '19.1', 'BB', 156, 5, '20', 'CS', 'BB'],
  [2, 'Aug 1', 'TT', 108, 10, '17.5', 'DW', 187, 7, '20', 'DW', 'DW'],
  [3, 'Aug 2', 'BL', 162, 8, '20', 'NR', 142, 5, '17', 'BL', 'BL', 'DLS Method'],
  [4, 'Aug 2', 'GR', 122, 9, '19', 'JS', 118, 10, '18.5', 'GR', 'GR'],
  [5, 'Aug 3', 'CS', 132, 3, '15.4', 'TT', 128, 9, '20', 'CS', 'TT'],
  [6, 'Aug 3', 'BB', 90, 10, '19.1', 'DW', 91, 7, '18.5', 'DW', 'BB'],
  [7, 'Aug 4', 'BL', 118, 7, '19', 'GR', 126, 9, '20', 'BL', 'BL', 'DLS Method'],
  // [8, 'Aug 4', 'NR', 66, 3, '8.0', 'JS', 0, 0, '0', '', '', 'abandoned'],
  [9, 'Aug 5', 'CS', 120, 10, '19.1', 'DW', 121, 5, '17.5', 'DW', 'CS'],
  [10, 'Aug 5', 'BB', 124, 10, '20', 'TT', 114, 10, '19.5', 'BB', 'BB'],
  [11, 'Aug 6', 'BL', 170, 4, '20', 'JS', 174, 2, '18.2', 'JS', 'BL'],
  [12, 'Aug 6', 'NR', 151, 7, '20', 'GR', 152, 5, '18.3', 'GR', 'NR'],
  [13, 'Aug 7', 'BB', 170, 4, '20', 'NR', 100, 10, '18.2', 'BB', 'BB'],
  [14, 'Aug 7', 'CS', 124, 10, '20', 'BL', 125, 2, '18.4', 'BL', 'CS'],
  [15, 'Aug 8', 'TT', 146, 8, '20', 'GR', 147, 2, '12.5', 'GR', 'TT'],
  [16, 'Aug 8', 'DW', 133, 4, '17.4', 'JS', 132, 8, '20', 'DW', 'JS'],
  [17, 'Aug 9', 'BB', 129, 8, '20', 'BL', 131, 7, '20', 'BL', 'BB'],
  [18, 'Aug 9', 'CS', 139, 9, '20', 'NR', 140, 0, '13.2', 'NR', 'CS'],
  [19, 'Aug 10', 'TT', 160, 6, '20', 'JS', 162, 1, '18.1', 'JS', 'TT'],
  [20, 'Aug 10', 'DW', 121, 10, '19', 'GR', 122, 5, '16.1', 'GR', 'DW'],
  [21, 'Aug 11', 'CS', 208, 2, '20', 'GR', 212, 7, '19.3', 'GR', 'CS'],
  [22, 'Aug 11', 'BB', 125, 2, '16.3', 'JS', 124, 6, '20', 'BB', 'JS'],
  [23, 'Aug 12', 'DW', 114, 2, '17.3', 'NR', 110, 10, '20', 'DW', 'NR'],
  [24, 'Aug 12', 'TT', 159, 3, '17.5', 'BL', 158, 7, '20', 'TT', 'BL'],
  [25, 'Aug 13', 'CS', 130, 3, '14.3', 'JS', 128, 8, '20', 'CS', 'JS'],
  [26, 'Aug 13', 'BB', 137, 6, '19.4', 'GR', 136, 6, '20', 'BB', 'GR'],
  [27, 'Aug 14', 'TT', 120, 10, '20', 'NR', 123, 10, '19.3', 'NR', 'TT'],
  [28, 'Aug 14', 'DW', 105, 10, '16.4', 'BL', 181, 5, '20', 'BL', 'DW'],
  // [29, 'Aug 15', 'CS', 35, 0, '2.5', 'BL', 177, 6, '20', '', '', 'abandoned'],
  [30, 'Aug 15', 'TT', 203, 8, '19.4', 'GR', 200, 4, '20', 'TT', 'GR'],
  [31, 'Aug 16', 'DW', 134, 5, '18.2', 'JS', 132, 8, '20', 'DW', 'JS'],
  [32, 'Aug 16', 'BB', 109, 1, '16', 'NR', 133, 6, '20', 'BB', 'NR', 'DLS Method'],
  [33, 'Aug 17', 'CS', 173, 10, '19.5', 'NR', 135, 9, '20', 'CS', 'CS'],
  [34, 'Aug 17', 'BB', 124, 3, '18.3', 'BL', 120, 8, '20', 'BB', 'BL'],
];

// Team full names and colors (Assam T20 teams)
const ASSAM_TEAMS = [
  { code: 'CS', fullName: 'City Spartans', color: '#1976d2', city: 'Guwahati' },
  { code: 'BB', fullName: 'Barak Bravehearts', color: '#d32f2f', city: 'Silchar' },
  { code: 'TT', fullName: 'Tinsukia Tigers', color: '#f57c00', city: 'Tinsukia' },
  { code: 'DW', fullName: 'Dibrugarh Warriors', color: '#388e3c', city: 'Dibrugarh' },
  { code: 'BL', fullName: 'Brahmaputra Lions', color: '#7b1fa2', city: 'Tezpur' },
  { code: 'GR', fullName: 'Goalpara Rhinos', color: '#00838f', city: 'Goalpara' },
  { code: 'JS', fullName: 'Jorhat Superkings', color: '#fbc02d', city: 'Jorhat' },
  { code: 'NR', fullName: 'Nagaon Rangers', color: '#512da8', city: 'Nagaon' },
];

async function main() {
  console.log('Adding Assam T20 2026 league to Vercel...');

  // Step 1: Create the league
  console.log('\n1. Creating league ASSAM...');
  const leagueResp = await fetch(`${BASE}/api/admin/league`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'ASSAM',
      name: 'Assam T20',
      fullName: 'Assam Premier League 2026',
      country: 'India (Assam)',
      season: '2026',
      weights: { elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 },
    }),
  });
  const leagueJson = await leagueResp.json();
  if (!leagueResp.ok) {
    console.error('Failed to create league:', leagueJson);
    return;
  }
  console.log(`   ✅ League created: ${leagueJson.league.id}`);

  // Step 2: Add all teams
  console.log('\n2. Adding 8 teams...');
  for (const t of ASSAM_TEAMS) {
    const teamResp = await fetch(`${BASE}/api/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId: 'ASSAM',
        shortCode: t.code,
        fullName: t.fullName,
        color: t.color,
        city: t.city,
      }),
    });
    const teamJson = await teamResp.json();
    if (!teamResp.ok) {
      console.error(`   ❌ Failed to add team ${t.code}:`, teamJson);
    } else {
      console.log(`   ✅ ${t.code} - ${t.fullName}`);
    }
  }

  // Step 3: Add all matches
  console.log('\n3. Adding 32 matches (2 abandoned, skipped)...');
  let success = 0, fail = 0;
  for (const m of ASSAM_MATCHES) {
    const [matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, batFirst, note] = m;
    const matchResp = await fetch(`${BASE}/api/admin/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId: 'ASSAM',
        date,
        teamAId: teamA,
        teamAScore: aRuns,
        teamAWickets: aWk,
        teamAOvers: parseFloat(aOv),
        teamBId: teamB,
        teamBScore: bRuns,
        teamBWickets: bWk,
        teamBOvers: parseFloat(bOv),
        winnerId: winner === teamA ? 'A' : 'B',
        battingFirstId: batFirst === teamA ? 'A' : 'B',
        note: note || undefined,
      }),
    });
    const matchJson = await matchResp.json();
    if (!matchResp.ok) {
      console.error(`   ❌ Match #${matchNo} failed:`, matchJson.error || matchJson);
      fail++;
    } else {
      console.log(`   ✅ Match #${matchNo}: ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${note ? ` (${note})` : ''}`);
      success++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`League: ASSAM (Assam Premier League 2026)`);
  console.log(`Teams: 8 added`);
  console.log(`Matches: ${success} added, ${fail} failed`);
  console.log(`\nView at: https://cricketpredict.vercel.app (switch to ASSAM league)`);
}

main().catch(e => { console.error(e); process.exit(1); });
