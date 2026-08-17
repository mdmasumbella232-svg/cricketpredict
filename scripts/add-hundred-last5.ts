const BASE = 'https://cricketpredict.vercel.app';
const MISSING: [number, string, string, number, number, string, string, number, number, string, string, string, string?][] = [
  [26, 'Aug 8', 'SB', 139, 6, '20', 'MSG', 149, 8, '20', 'MSG', 'SB'],
  [27, 'Aug 9', 'SRL', 201, 4, '20', 'WF', 130, 6, '20', 'SRL', 'WF'],
  [28, 'Aug 9', 'LS', 166, 3, '16.2', 'BP', 162, 4, '20', 'LS', 'LS'],
  [29, 'Aug 10', 'TR', 158, 5, '20', 'SB', 159, 4, '19.2', 'SB', 'TR'],
  [30, 'Aug 11', 'MSG', 128, 0, '13.2', 'SRL', 127, 10, '20', 'MSG', 'SRL'],
];

async function main() {
  console.log('Adding 5 missing matches with 15s waits...');
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
      } else {
        console.log(`  ❌ #${matchNo}: ${j.error || JSON.stringify(j)}`);
      }
    } catch (e: any) {
      console.log(`  ❌ #${matchNo}: ${e.message}`);
    }
    console.log('  Waiting 15s...');
    await new Promise(r => setTimeout(r, 15000));
  }
  console.log('Done!');
}
main().catch(e => { console.error(e); process.exit(1); });
