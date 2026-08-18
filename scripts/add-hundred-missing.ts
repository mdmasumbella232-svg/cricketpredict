/**
 * Re-add the 9 missing The Hundred matches (4-8, 31-34).
 */
const BASE = 'https://cricketpredict.vercel.app';

const MISSING: [number, string, string, number, number, string, string, number, number, string, string, string, string?][] = [
  [4, 'Jul 24', 'BP', 214, 4, '20', 'TR', 204, 7, '20', 'BP', 'BP'],
  [5, 'Jul 25', 'SRL', 187, 5, '20', 'SB', 182, 5, '20', 'SRL', 'SB'],
  [6, 'Jul 25', 'WF', 167, 5, '20', 'MIL', 152, 6, '20', 'WF', 'WF'],
  [7, 'Jul 26', 'MSG', 187, 5, '20', 'BP', 100, 10, '19.2', 'MSG', 'MSG'],
  [8, 'Jul 26', 'TR', 160, 6, '19.3', 'LS', 159, 9, '20', 'TR', 'TR'],
  [31, 'Aug 12', 'WF', 125, 7, '20', 'LS', 131, 8, '20', 'LS', 'WF'],
  [32, 'Aug 12', 'BP', 155, 7, '20', 'MIL', 157, 6, '20', 'MIL', 'BP'],
  [33, 'Aug 14', 'MSG', 186, 4, '20', 'SRL', 166, 7, '20', 'MSG', 'MSG', 'Eliminator'],
  [34, 'Aug 16', 'TR', 158, 8, '20', 'MSG', 162, 5, '19.3', 'MSG', 'TR', 'Final'],
];

async function main() {
  console.log(`Re-adding ${MISSING.length} missing matches...`);
  let success = 0;
  for (const m of MISSING) {
    const [matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, batFirst, note] = m;
    try {
      const r = await fetch(`${BASE}/api/admin/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: 'HUNDRED', date,
          teamAId: teamA, teamAScore: aRuns, teamAWickets: aWk, teamAOvers: parseFloat(aOv),
          teamBId: teamB, teamBScore: bRuns, teamBWickets: bWk, teamBOvers: parseFloat(bOv),
          winnerId: winner === teamA ? 'A' : 'B',
          battingFirstId: batFirst === teamA ? 'A' : 'B',
          note: note || undefined,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        console.log(`  ✅ #${matchNo}: ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}`);
        success++;
      } else {
        console.log(`  ❌ #${matchNo}: ${j.error || JSON.stringify(j)}`);
      }
    } catch (e: any) {
      console.log(`  ❌ #${matchNo}: ${e.message}`);
    }
  }
  console.log(`\nDone: ${success}/${MISSING.length} added`);
}
main().catch(e => { console.error(e); process.exit(1); });
