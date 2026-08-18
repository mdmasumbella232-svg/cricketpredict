/**
 * Quick delete: fire off all DELETE requests rapidly, then re-add matches.
 */
const BASE = 'https://cricketpredict.vercel.app';

async function main() {
  // Step 1: Get all match IDs
  console.log('Getting all HUNDRED match IDs...');
  const r = await fetch(`${BASE}/api/matches?league=HUNDRED&limit=200`);
  const j = await r.json();
  const matches = j.matches || [];
  console.log(`Found ${matches.length} matches to delete`);

  // Step 2: Delete all matches (fire requests with 4s wait each)
  console.log('Deleting all matches...');
  for (const m of matches) {
    try {
      await fetch(`${BASE}/api/admin/match?leagueId=HUNDRED&matchId=${m.id}`, { method: 'DELETE' });
      console.log(`  Deleted ${m.id}`);
    } catch (e) {
      console.log(`  Error deleting ${m.id}: ${e}`);
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  // Verify
  const r2 = await fetch(`${BASE}/api/leagues`);
  const j2 = await r2.json();
  const hundred = j2.leagues.find((l: any) => l.id === 'HUNDRED');
  console.log(`\nHUNDRED now has ${hundred?.matchCount || 0} matches`);
}
main().catch(e => { console.error(e); process.exit(1); });
