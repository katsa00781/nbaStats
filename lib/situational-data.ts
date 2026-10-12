// A kiválasztott csapat meccsenkénti csapatsorai a szezonban (a csapaté és az
// ellenfeleké is), a szituációs elemzés fejlett mutatóihoz. A hook
// (hooks/useSituationalData.ts) a böngészős klienssel hívja; a kliens paraméter,
// így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { TeamGameRow } from '@/lib/team-stats-data';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { STAT_COLUMNS } from '@/lib/team-stats-data';

/**
 * A csapat csapatsorai és az ellenfél-sorok ugyanazokra a meccsekre (minden szakasz).
 * Szezononként kb. 220 sor, de a lapozó helper a szabály (T1); a rendezés kulcsa az `id`.
 */
export async function fetchTeamGameStatRows(db: NbaClient, seasonId: string, teamId: string): Promise<TeamGameRow[]> {
  return fetchAllRows<TeamGameRow>((from, to) =>
    db
      .from('team_game_stats')
      .select(STAT_COLUMNS)
      .eq('season_id', seasonId)
      .or(`team_id.eq.${teamId},opponent_team_id.eq.${teamId}`)
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<TeamGameRow[], { merge: false }>(),
  );
}
