/**
 * Add remaining Assam T20 2026 matches (24-34) to Vercel.
 */
const BASE = 'https://cricketpredict.vercel.app';

const REMAINING: [number, string, string, number, number, string, string, number, number, string, string, string, string?][] = [
  [24, 'Aug 12', 'TT', 159, 3, '17.5', 'BL', 158, 7, '20', 'TT', 'BL'],
  [25, 'Aug 13', 'CS', 130, 3, '14.3', 'JS', 128, 8, '20', 'CS', 'JS'],
  [26, 'Aug 13', 'BB', 137, 6, '19.4', 'GR', 136, 6, '20', 'BB', 'GR'],
  [27, 'Aug 14', 'TT', 120, 10, '20', 'NR', 123, 10, '19.3', 'NR', 'TT'],
  [28, 'Aug 14', 'DW', 105, 10, '16.4', 'BL', 181, 5, '20', 'BL', 'DW'],
  [30, 'Aug 15', 'TT', 203, 8, '19.4', 'GR', 200, 4, '20', 'TT', 'GR'],
  [31, 'Aug 16', 'DW', 134, 5, '18.2', 'JS', 132, 8, '20', 'DW', 'JS'],
  [32, 'Aug 16', 'BB', 109, 1, '16', 'NR', 133, 6, '20', 'BB', 'NR', 'DLS Method'],
  [33, 'Aug 17', 'CS', 173, 10, '19.5', 'NR', 135, 9, '20', 'CS', 'CS'],
  [34, 'Aug 17', 'BB', 124, 3, '18.3', 'BL', 120, 8, '20', 'BB', 'BL'],
];

async function main() {
  console.log(`Adding ${REMAINING.length} remaining Assam matches to Vercel...`);
  let success = 0, fail = 0;
  for (const m of REMAINING) {
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
      console.error(`  ❌ Match #${matchNo} failed:`, matchJson.error || matchJson);
      fail++;
    } else {
      console.log(`  ✅ Match #${matchNo}: ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${note ? ` (${note})` : ''}`);
      success++;
    }
  }
  console.log(`\nDone: ${success} added, ${fail} failed`);
}
main().catch(e => { console.error(e); process.exit(1); });
