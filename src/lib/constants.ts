/**
 * Shared constants for CricketPredict.
 */

// These 4 leagues are the original validation data (191 matches across 4 leagues).
// They are:
//   - Locked: cannot be edited or deleted via the Admin API
//   - Hidden: do not appear in the main league dropdown
//   - Still visible: in the Systems comparison tab and Insights tab (for validation context)
//
// To "unlock" a league, remove its ID from this list.
export const VALIDATION_LEAGUE_IDS = ['IPL', 'PSL', 'BBL', 'CPL'] as const;

export function isValidationLeague(id: string): boolean {
  return (VALIDATION_LEAGUE_IDS as readonly string[]).includes(id);
}
