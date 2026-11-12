// Dobás-események (`shot_events`) a meccs utáni riport dobástérképéhez: egy meccs
// mindkét csapatának dobásai (pontokkal a pályán), és egy csapat szezonbeli dobásai
// (csak zóna + eredmény, a szezonreferenciához). A zónát az import adja
// (lib/espn/map-shots.ts, T10), itt nincs besorolás. A hookok (hooks/useShotData.ts)
// a böngészős klienssel hívják; a kliens paraméter, így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { ShotZone, TableRow } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetch-all-rows';

const GAME_SHOT_COLUMNS = 'team_id, player_id, period, clock, x, y, zone, shot_value, made';
type GameShotRow = Pick<
  TableRow<'shot_events'>,
  'team_id' | 'player_id' | 'period' | 'clock' | 'x' | 'y' | 'zone' | 'shot_value' | 'made'
>;

const SEASON_SHOT_COLUMNS = 'game_id, player_id, zone, shot_value, made';
type SeasonShotRow = Pick<TableRow<'shot_events'>, 'game_id' | 'player_id' | 'zone' | 'shot_value' | 'made'>;

/** Egy mezőnydobás a meccsen. A koordináta lábban, a kosár a (25, 0) pontban. */
export interface GameShot {
  teamId: string;
  playerId: string | null;
  period: number;
  clock: string | null;
  x: number;
  y: number;
  zone: ShotZone;
  shotValue: 2 | 3;
  made: boolean;
}

/** Egy csapat egy szezonbeli dobása, koordináta nélkül (zóna-összesítőhöz). */
export interface SeasonShot {
  gameId: string;
  playerId: string | null;
  zone: ShotZone;
  shotValue: 2 | 3;
  made: boolean;
}

/** Egy meccs mindkét csapatának mezőnydobásai (kb. 170 sor, egy lap). */
export async function fetchGameShots(client: NbaClient, seasonId: string, gameId: string): Promise<GameShot[]> {
  const rows = await fetchAllRows<GameShotRow>((from, to) =>
    client
      .from('shot_events')
      .select(GAME_SHOT_COLUMNS)
      .eq('season_id', seasonId)
      .eq('game_id', gameId)
      .order('id')
      .range(from, to),
  );
  return rows.map(row => ({
    teamId: row.team_id,
    playerId: row.player_id,
    period: row.period,
    clock: row.clock,
    x: row.x,
    y: row.y,
    zone: row.zone,
    shotValue: row.shot_value,
    made: row.made,
  }));
}

/**
 * Egy csapat összes dobása a szezonban, minden szakaszból (kb. 7–8 ezer sor, ezért
 * lapozva, T1). A szakaszra és a vizsgált meccs kizárására a hívó szűr a meccs-azonosítók alapján.
 */
export async function fetchTeamSeasonShots(client: NbaClient, seasonId: string, teamId: string): Promise<SeasonShot[]> {
  const rows = await fetchAllRows<SeasonShotRow>((from, to) =>
    client
      .from('shot_events')
      .select(SEASON_SHOT_COLUMNS)
      .eq('season_id', seasonId)
      .eq('team_id', teamId)
      .order('id')
      .range(from, to),
  );
  return rows.map(row => ({
    gameId: row.game_id,
    playerId: row.player_id,
    zone: row.zone,
    shotValue: row.shot_value,
    made: row.made,
  }));
}
