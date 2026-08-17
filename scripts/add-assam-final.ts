const BASE = 'https://cricketpredict.vercel.app';
const REMAINING: [number, string, string, number, number, string, string, number, number, string, string, string, string?][] = [
  [33, 'Aug 17', 'CS', 173, 10, '19.5', 'NR', 135, 9, '20', 'CS', 'CS'],
  [34, 'Aug 17', 'BB', 124, 3, '18.3', 'BL', 120, 8, '20', 'BB', 'BL'],
];
async function main() {
  for (const m of REMAINING) {
    const [matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, batFirst, note] = m;
    const r = await fetch(`${BASE}/api/admin/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId: 'ASSAM', date, teamAId: teamA, teamAScore: aRuns, teamAWickets: aWk, teamAOvers: parseFloat(aOv),
        teamBId: teamB, teamBScore: bRuns, teamBWickets: bWk, teamBOvers: parseFloat(bOv),
        winnerId: winner === teamA ? 'A' : 'B', battingFirstId: batFirst === teamA ? 'A' : 'B',
        note: note || undefined,
      }),
    });
    const j = await r.json();
    console.log(`Match #${matchNo}: ${r.ok ? '✅' : '❌'} ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${r.ok ? '' : ' ERROR: ' + JSON.stringify(j)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
