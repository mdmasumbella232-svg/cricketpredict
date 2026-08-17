/**
 * Fix The Hundred 2026: Delete all matches and re-add in chronological order
 * so match numbers are sequential 1-34 and dates are in order.
 */
const BASE = 'https://cricketpredict.vercel.app';

// All 34 matches in chronological order
const MATCHES: [string, string, number, number, number, string, number, number, number, string, string, string?][] = [
  ['Jul 21', 'MIL', 144, 3, 16.4, 'SRL', 143, 10, 19.4, 'MIL', undefined],
  ['Jul 22', 'SB', 135, 7, 20, 'WF', 138, 4, 19.3, 'WF', undefined],
  ['Jul 23', 'LS', 131, 6, 20, 'MSG', 138, 9, 20, 'MSG', undefined],
  ['Jul 24', 'BP', 214, 4, 20, 'TR', 204, 7, 20, 'BP', undefined],
  ['Jul 25', 'SRL', 187, 5, 20, 'SB', 182, 5, 20, 'SRL', undefined],
  ['Jul 25', 'WF', 167, 5, 20, 'MIL', 152, 6, 20, 'WF', undefined],
  ['Jul 26', 'MSG', 187, 5, 20, 'BP', 100, 10, 19.2, 'MSG', undefined],
  ['Jul 26', 'TR', 160, 6, 19.3, 'LS', 159, 9, 20, 'TR', undefined],
  ['Jul 27', 'SB', 129, 9, 20, 'MIL', 130, 7, 20, 'MIL', undefined],
  ['Jul 28', 'SRL', 186, 2, 17.3, 'MSG', 181, 3, 20, 'SRL', undefined],
  ['Jul 29', 'WF', 122, 7, 20, 'TR', 126, 1, 14.2, 'TR', undefined],
  ['Jul 29', 'MIL', 164, 5, 20, 'LS', 165, 3, 17.4, 'LS', undefined],
  ['Jul 30', 'SB', 128, 8, 20, 'BP', 116, 9, 20, 'SB', undefined],
  ['Jul 31', 'MSG', 137, 3, 20, 'TR', 140, 4, 17.2, 'TR', undefined],
  ['Aug 1', 'BP', 137, 9, 20, 'WF', 138, 3, 19.1, 'WF', undefined],
  ['Aug 1', 'LS', 105, 10, 18.2, 'SB', 111, 5, 19.2, 'SB', undefined],
  ['Aug 2', 'TR', 146, 4, 20, 'SRL', 141, 4, 20, 'TR', undefined],
  ['Aug 2', 'MIL', 183, 6, 20, 'MSG', 138, 10, 19, 'MIL', undefined],
  ['Aug 3', 'WF', 116, 4, 19, 'SB', 115, 8, 20, 'WF', undefined],
  ['Aug 4', 'SRL', 241, 2, 20, 'LS', 204, 6, 20, 'SRL', undefined],
  ['Aug 5', 'MSG', 161, 1, 13.4, 'WF', 155, 4, 20, 'MSG', undefined],
  ['Aug 5', 'TR', 116, 3, 16.3, 'BP', 111, 6, 20, 'TR', undefined],
  ['Aug 6', 'LS', 160, 5, 20, 'MIL', 164, 6, 18.4, 'MIL', undefined],
  ['Aug 7', 'BP', 124, 8, 20, 'SRL', 169, 7, 20, 'SRL', undefined],
  ['Aug 8', 'MIL', 147, 7, 20, 'TR', 148, 4, 18, 'TR', undefined],
  ['Aug 8', 'SB', 139, 6, 20, 'MSG', 149, 8, 20, 'MSG', undefined],
  ['Aug 9', 'SRL', 201, 4, 20, 'WF', 130, 6, 20, 'SRL', undefined],
  ['Aug 9', 'LS', 166, 3, 16.2, 'BP', 162, 4, 20, 'LS', undefined],
  ['Aug 10', 'TR', 158, 5, 20, 'SB', 159, 4, 19.2, 'SB', undefined],
  ['Aug 11', 'MSG', 128, 0, 13.2, 'SRL', 127, 10, 20, 'MSG', undefined],
  ['Aug 12', 'WF', 125, 7, 20, 'LS', 131, 8, 20, 'LS', undefined],
  ['Aug 12', 'BP', 155, 7, 20, 'MIL', 157, 6, 20, 'MIL', undefined],
  ['Aug 14', 'MSG', 186, 4, 20, 'SRL', 166, 7, 20, 'MSG', 'Eliminator'],
  ['Aug 16', 'TR', 158, 8, 20, 'MSG', 162, 5, 19.3, 'MSG', 'Final'],
];

async function deleteAllMatches(): Promise<void> {
  console.log('1. Deleting all existing HUNDRED matches...');
  const r = await fetch(`${BASE}/api/matches?league=HUNDRED&limit=200`);
  const j = await r.json();
  const matches = j.matches || [];
  console.log(`   Found ${matches.length} matches to delete`);
  for (const m of matches) {
    await fetch(`${BASE}/api/admin/match?leagueId=HUNDRED&matchId=${m.id}`, { method: 'DELETE' });
    console.log(`   ❌ Deleted ${m.id} (#${m.matchNo})`);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('   All matches deleted.\n');
}

async function addAllMatches(): Promise<void> {
  console.log(`2. Adding ${MATCHES.length} matches in chronological order...`);
  let success = 0;
  for (let i = 0; i < MATCHES.length; i++) {
    const [date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, note] = MATCHES[i];
    try {
      const r = await fetch(`${BASE}/api/admin/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: 'HUNDRED', date,
          teamAId: teamA, teamAScore: aRuns, teamAWickets: aWk, teamAOvers: aOv,
          teamBId: teamB, teamBScore: bRuns, teamBWickets: bWk, teamBOvers: bOv,
          winnerId: winner === teamA ? 'A' : 'B',
          battingFirstId: winner === teamA ? 'B' : 'A', // loser batted first (simplified)
          note: note || undefined,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        console.log(`   ✅ #${i + 1}: ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${note ? ` (${note})` : ''}`);
        success++;
      } else {
        console.log(`   ❌ #${i + 1}: ${j.error || JSON.stringify(j)}`);
      }
    } catch (e: any) {
      console.log(`   ❌ #${i + 1}: ${e.message}`);
    }
    // Wait 12s between matches to avoid Vercel timeout
    if (i < MATCHES.length - 1) {
      await new Promise(r => setTimeout(r, 12000));
    }
  }
  console.log(`\nDone: ${success}/${MATCHES.length} added`);
}

async function main() {
  console.log('=== Fixing The Hundred 2026 match numbering ===\n');
  await deleteAllMatches();
  await addAllMatches();
}
main().catch(e => { console.error(e); process.exit(1); });
