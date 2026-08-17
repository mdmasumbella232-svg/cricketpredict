/**
 * Add The Hundred matches in small batches (3 at a time).
 * Run this script multiple times until all 34 are added.
 */
const BASE = 'https://cricketpredict.vercel.app';

const ALL_MATCHES: [string, string, number, number, number, string, number, number, number, string, string?][] = [
  ['Jul 21', 'MIL', 144, 3, 16.4, 'SRL', 143, 10, 19.4, 'MIL'],
  ['Jul 22', 'SB', 135, 7, 20, 'WF', 138, 4, 19.3, 'WF'],
  ['Jul 23', 'LS', 131, 6, 20, 'MSG', 138, 9, 20, 'MSG'],
  ['Jul 24', 'BP', 214, 4, 20, 'TR', 204, 7, 20, 'BP'],
  ['Jul 25', 'SRL', 187, 5, 20, 'SB', 182, 5, 20, 'SRL'],
  ['Jul 25', 'WF', 167, 5, 20, 'MIL', 152, 6, 20, 'WF'],
  ['Jul 26', 'MSG', 187, 5, 20, 'BP', 100, 10, 19.2, 'MSG'],
  ['Jul 26', 'TR', 160, 6, 19.3, 'LS', 159, 9, 20, 'TR'],
  ['Jul 27', 'SB', 129, 9, 20, 'MIL', 130, 7, 20, 'MIL'],
  ['Jul 28', 'SRL', 186, 2, 17.3, 'MSG', 181, 3, 20, 'SRL'],
  ['Jul 29', 'WF', 122, 7, 20, 'TR', 126, 1, 14.2, 'TR'],
  ['Jul 29', 'MIL', 164, 5, 20, 'LS', 165, 3, 17.4, 'LS'],
  ['Jul 30', 'SB', 128, 8, 20, 'BP', 116, 9, 20, 'SB'],
  ['Jul 31', 'MSG', 137, 3, 20, 'TR', 140, 4, 17.2, 'TR'],
  ['Aug 1', 'BP', 137, 9, 20, 'WF', 138, 3, 19.1, 'WF'],
  ['Aug 1', 'LS', 105, 10, 18.2, 'SB', 111, 5, 19.2, 'SB'],
  ['Aug 2', 'TR', 146, 4, 20, 'SRL', 141, 4, 20, 'TR'],
  ['Aug 2', 'MIL', 183, 6, 20, 'MSG', 138, 10, 19, 'MIL'],
  ['Aug 3', 'WF', 116, 4, 19, 'SB', 115, 8, 20, 'WF'],
  ['Aug 4', 'SRL', 241, 2, 20, 'LS', 204, 6, 20, 'SRL'],
  ['Aug 5', 'MSG', 161, 1, 13.4, 'WF', 155, 4, 20, 'MSG'],
  ['Aug 5', 'TR', 116, 3, 16.3, 'BP', 111, 6, 20, 'TR'],
  ['Aug 6', 'LS', 160, 5, 20, 'MIL', 164, 6, 18.4, 'MIL'],
  ['Aug 7', 'BP', 124, 8, 20, 'SRL', 169, 7, 20, 'SRL'],
  ['Aug 8', 'MIL', 147, 7, 20, 'TR', 148, 4, 18, 'TR'],
  ['Aug 8', 'SB', 139, 6, 20, 'MSG', 149, 8, 20, 'MSG'],
  ['Aug 9', 'SRL', 201, 4, 20, 'WF', 130, 6, 20, 'SRL'],
  ['Aug 9', 'LS', 166, 3, 16.2, 'BP', 162, 4, 20, 'LS'],
  ['Aug 10', 'TR', 158, 5, 20, 'SB', 159, 4, 19.2, 'SB'],
  ['Aug 11', 'MSG', 128, 0, 13.2, 'SRL', 127, 10, 20, 'MSG'],
  ['Aug 12', 'WF', 125, 7, 20, 'LS', 131, 8, 20, 'LS'],
  ['Aug 12', 'BP', 155, 7, 20, 'MIL', 157, 6, 20, 'MIL'],
  ['Aug 14', 'MSG', 186, 4, 20, 'SRL', 166, 7, 20, 'MSG'],
  ['Aug 16', 'TR', 158, 8, 20, 'MSG', 162, 5, 19.3, 'MSG'],
];

async function main() {
  // Check how many matches already exist
  const r = await fetch(`${BASE}/api/leagues`);
  const j = await r.json();
  const hundred = j.leagues.find((l: any) => l.id === 'HUNDRED');
  const existing = hundred?.matchCount || 0;
  console.log(`Currently ${existing} matches. Need to add ${ALL_MATCHES.length - existing} more.`);

  const toAdd = ALL_MATCHES.slice(existing);
  let added = 0;
  for (const m of toAdd) {
    const [date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, note] = m;
    const isPlayoff = note && (note === 'Eliminator' || note === 'Final');
    try {
      const r = await fetch(`${BASE}/api/admin/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: 'HUNDRED', date,
          teamAId: teamA, teamAScore: aRuns, teamAWickets: aWk, teamAOvers: aOv,
          teamBId: teamB, teamBScore: bRuns, teamBWickets: bWk, teamBOvers: bOv,
          winnerId: winner === teamA ? 'A' : 'B',
          battingFirstId: winner === teamA ? 'B' : 'A',
          note: note || undefined,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        console.log(`✅ ${teamA} ${aRuns}/${aWk} vs ${teamB} ${bRuns}/${bWk} → ${winner}`);
        added++;
      } else {
        console.log(`❌ ${teamA} vs ${teamB}: ${j.error || JSON.stringify(j)}`);
      }
    } catch (e: any) {
      console.log(`❌ ${teamA} vs ${teamB}: ${e.message}`);
      break; // Stop on error (likely timeout)
    }
    await new Promise(r => setTimeout(r, 8000));
  }
  console.log(`\nAdded ${added} matches this run.`);
}
main().catch(e => { console.error(e); process.exit(1); });
