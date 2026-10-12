// A szezon összes játékosának összesítői (mind a 30 csapat) a
// `player_season_stats_by_season` view-ból: a játékos-elemzés poszt szerinti
// liga-benchmarkjának alapja. A Játékosok lista (lib/player-data.ts) csak a kiválasztott
// csapat meccsenkénti átlagait kéri; ez a modul a nyers összegeket adja, a
// close / mid / hármas dobásbontással, lepattanó-bontással és személyi hibával.
// A hook (hooks/useLeaguePlayerData.ts) a böngészős klienssel hívja; a kliens
// paraméter, így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { ViewRow } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { SEASON_TYPE_ORDER } from '@/lib/season-types';

const TOTAL_COLUMNS =
  'season_type, player_id, team_id, position, games_played, total_minutes, total_points, total_fgm, total_fga, total_close_made, total_close_attempted, total_mid_made, total_mid_attempted, total_three_made, total_three_attempted, total_free_throw_made, total_free_throw_attempted, total_offensive_rebounds, total_defensive_rebounds, total_rebounds, total_assists, total_steals, total_blocks, total_turnovers, total_fouls_committed';

export type LeaguePlayerTotals = Pick<
  ViewRow<'player_season_stats_by_season'>,
  | 'season_type'
  | 'player_id'
  | 'team_id'
  | 'position'
  | 'games_played'
  | 'total_minutes'
  | 'total_points'
  | 'total_fgm'
  | 'total_fga'
  | 'total_close_made'
  | 'total_close_attempted'
  | 'total_mid_made'
  | 'total_mid_attempted'
  | 'total_three_made'
  | 'total_three_attempted'
  | 'total_free_throw_made'
  | 'total_free_throw_attempted'
  | 'total_offensive_rebounds'
  | 'total_defensive_rebounds'
  | 'total_rebounds'
  | 'total_assists'
  | 'total_steals'
  | 'total_blocks'
  | 'total_turnovers'
  | 'total_fouls_committed'
>;

/**
 * A szezon minden játékosának összegei szakaszonként és csapatonként (a cserélt
 * játékosnak csapatonként külön sora van). Egy szezon kb. 1000 sor, ezért a
 * lapozó helper kötelező (T1).
 */
export async function fetchLeaguePlayerTotals(db: NbaClient, seasonId: string): Promise<LeaguePlayerTotals[]> {
  return fetchAllRows<LeaguePlayerTotals>((from, to) =>
    db
      .from('player_season_stats_by_season')
      .select(TOTAL_COLUMNS)
      .eq('season_id', seasonId)
      .in('season_type', SEASON_TYPE_ORDER)
      .order('season_type', { ascending: true })
      .order('player_id', { ascending: true })
      .order('team_id', { ascending: true })
      .range(from, to),
  );
}
