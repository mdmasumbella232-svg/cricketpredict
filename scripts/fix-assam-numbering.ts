/**
 * Fix Assam T20 2026: Delete all matches and re-add in chronological order
 * so match numbers are sequential 1-32 and dates are in order.
 * Uses batch approach: delete all first, then add in small batches.
 */
const BASE = 'https://cricketpredict.vercel.app';

// All 32 playable matches in chronological order (2 abandoned: #8 and #29 excluded)
const MATCHES: [string, string, number, number, number, string, number, number, number, string, string?][] = [
  ['Aug 1', 'CS', 157, 6, 19.1, 'BB', 156, 5, 20, 'CS'],
  ['Aug 1', 'TT', 108, 10, 17.5, 'DW', 187, 7, 20, 'DW'],
  ['Aug 2', 'BL', 162, 8, 20, 'NR', 142, 5, 17, 'BL', 'DLS Method'],
  ['Aug 2', 'GR', 122, 9, 19, 'JS', 118, 10, 18.5, 'GR'],
  ['Aug 3', 'CS', 132, 3, 15.4, 'TT', 128, 9, 20, 'CS'],
  ['Aug 3', 'BB', 90, 10, 19.1, 'DW', 91, 7, 18.5, 'DW'],
  ['Aug 4', 'BL', 118, 7, 19, 'GR', 126, 9, 20, 'BL', 'DLS Method'],
  ['Aug 5', 'CS', 120, 10, 19.1, 'DW', 121, 5, 17.5, 'DW'],
  ['Aug 5', 'BB', 124, 10, 20, 'TT', 114, 10, 19.5, 'BB'],
  ['Aug 6', 'BL', 170, 4, 20, 'JS', 174, 2, 18.2, 'JS'],
  ['Aug 6', 'NR', 151, 7, 20, 'GR', 152, 5, 18.3, 'GR'],
  ['Aug 7', 'BB', 170, 4, 20, 'NR', 100, 10, 18.2, 'BB'],
  ['Aug 7', 'CS', 124, 10, 20, 'BL', 125, 2, 18.4, 'BL'],
  ['Aug 8', 'TT', 146, 8, 20, 'GR', 147, 2, 12.5, 'GR'],
  ['Aug 8', 'DW', 133, 4, 17.4, 'JS', 132, 8, 20, 'DW'],
  ['Aug 9', 'BB', 129, 8, 20, 'BL', 131, 7, 20, 'BL'],
  ['Aug 9', 'CS', 139, 9, 20, 'NR', 140, 0, 13.2, 'NR'],
  ['Aug 10', 'TT', 160, 6, 20, 'JS', 162, 1, 18.1, 'JS'],
  ['Aug 10', 'DW', 121, 10, 19, 'GR', 122, 5, 16.1, 'GR'],
  ['Aug 11', 'CS', 208, 2, 20, 'GR', 212, 7, 19.3, 'GR'],
  ['Aug 11', 'BB', 125, 2, 16.3, 'JS', 124, 6, 20, 'BB'],
  ['Aug 12', 'DW', 114, 2, 17.3, 'NR', 110, 10, 20, 'DW'],
  ['Aug 12', 'TT', 159, 3, 17.5, 'BL', 158, 7, 20, 'TT'],
  ['Aug 13', 'CS', 130, 3, 14.3, 'JS', 128, 8, 20, 'CS'],
  ['Aug 13', 'BB', 137, 6, 19.4, 'GR', 136, 6, 20, 'BB'],
  ['Aug 14', 'TT', 120, 10, 20, 'NR', 123, 10, 19.3, 'NR'],
  ['Aug 14', 'DW', 105, 10, 16.4, 'BL', 181, 5, 20, 'BL'],
  ['Aug 15', 'TT', 203, 8, 19.4, 'GR', 200, 4, 20, 'TT'],
  ['Aug 16', 'DW', 134, 5, 18.2, 'JS', 132, 8, 20, 'DW'],
  ['Aug 16', 'BB', 109, 1, 16, 'NR', 133, 6, 20, 'BB', 'DLS Method'],
  ['Aug 17', 'CS', 173, 10, 19.5, 'NR', 135, 9, 20, 'CS'],
  ['Aug 17', 'BB', 124, 3, 18.3, 'BL', 120, 8, 20, 'BB'],
];

async function deleteAllMatches(): Promise<void> {
  console.log('1. Deleting all existing ASSAM matches...');
  const r = await fetch(`${BASE}/api/matches?league=ASSAM&limit=200`);
  const j = await r.json();
  const matches = j.matches || [];
  console.log(`   Found ${matches.length} matches to delete`);
  for (const m of matches) {
    try {
      await fetch(`${BASE}/api/admin/match?leagueId=ASSAM&matchId=${m.id}`, { method: 'DELETE' });
      console.log(`   ❌ Deleted ${m.id} (#${m.matchNo})`);
    } catch (e) {
      console.log(`   ⚠️  Error deleting ${m.id}`);
    }
    await new Promise(r => setTimeout(r, 4000));
  }
  console.log('   All deletions attempted.\n');
}

async function addMatches(startIdx: number): Promise<number> {
  const r = await fetch(`${BASE}/api/leagues`);
  const j = await r.json();
  const assam = j.leagues.find((l: any) => l.id === 'ASSAM');
  const existing = assam?.matchCount || 0;
  if (existing >= MATCHES.length) return 0;
  
  const toAdd = MATCHES.slice(existing);
  let added = 0;
  for (const m of toAdd) {
    const [date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, note] = m;
    try {
      const r = await fetch(`${BASE}/api/admin/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: 'ASSAM', date,
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
        added++;
      } else {
        console.log(`  ❌ ${teamA} vs ${teamB}: ${j.error || JSON.stringify(j)}`);
        break;
      }
    } catch (e: any) {
      console.log(`  ❌ ${teamA} vs ${teamB}: ${e.message}`);
      break;
    }
    await new Promise(r => setTimeout(r, 8000));
  }
  return added;
}

async function main() {
  console.log('=== Fixing Assam T20 2026 match numbering ===\n');
  await deleteAllMatches();
  
  console.log('2. Adding matches in chronological order (in batches)...');
  let totalAdded = 0;
  for (let batch = 1; batch <= 20; batch++) {
    const r = await fetch(`${BASE}/api/leagues`);
    const j = await r.json();
    const assam = j.leagues.find((l: any) => l.id === 'ASSAM');
    const count = assam?.matchCount || 0;
    console.log(`\n--- Batch ${batch} (current: ${count}/${MATCHES.length} matches) ---`);
    if (count >= MATCHES.length) {
      console.log('All matches added!');
      break;
    }
    const added = await addMatches(count);
    totalAdded += added;
    if (added === 0) break;
  }
  console.log(`\nTotal added: ${totalAdded}`);
}
main().catch(e => { console.error(e); process.exit(1); });
