/**
 * Add 9 CPL 2026 matches to CPL6 league. Run multiple times if timeout.
 */
const BASE = 'https://cricketpredict.vercel.app';

const MATCHES: [string, string, number, number, number, string, number, number, number, string, string?][] = [
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
  const r = await fetch(`${BASE}/api/leagues`);
  const j = await r.json();
  const cpl6 = j.leagues.find((l: any) => l.id === 'CPL6');
  const existing = cpl6?.matchCount || 0;
  console.log(`CPL6 has ${existing} matches. Adding ${MATCHES.length - existing} more.`);
  
  const toAdd = MATCHES.slice(existing);
  for (const m of toAdd) {
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
        console.log(`✅ ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}${note ? ` (${note})` : ''}`);
      } else {
        console.log(`❌ ${teamA} vs ${teamB}: ${j.error}`);
        break;
      }
    } catch (e: any) {
      console.log(`❌ ${teamA} vs ${teamB}: ${e.message}`);
      break;
    }
    await new Promise(r => setTimeout(r, 8000));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
