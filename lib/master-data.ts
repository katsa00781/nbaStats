// Törzsadat-lekérdezések: szezonok, csapatok, beállítások (követett csapat).
// A hookok (hooks/useMasterData.ts) a böngészős klienssel hívják. A kliens
// paraméter, így a modul a böngészős kliens betöltése nélkül is használható.
// Mindhárom tábla kicsi (2 szezon, 30 csapat, 1 beállítás-sor), ezért nincs
// szezon-szűrés és lapozás.

import type { NbaClient } from '@/lib/db-schema';
import type { TableRow } from '@/lib/supabase';

const SEASON_COLUMNS = 'id, espn_year, name, start_date, end_date';
export type Season = Pick<TableRow<'seasons'>, 'id' | 'espn_year' | 'name' | 'start_date' | 'end_date'>;

const TEAM_COLUMNS = 'id, espn_team_id, name, short_name, abbreviation, conference, division, logo_url';
export type Team = Pick<
  TableRow<'teams'>,
  'id' | 'espn_team_id' | 'name' | 'short_name' | 'abbreviation' | 'conference' | 'division' | 'logo_url'
>;

export type AppSettings = Pick<TableRow<'app_settings'>, 'followed_team_id'>;

/** Szezonok, a legújabb elöl. */
export async function fetchSeasons(db: NbaClient): Promise<Season[]> {
  const { data, error } = await db
    .from('seasons')
    .select(SEASON_COLUMNS)
    .order('espn_year', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Season[];
}

/** Csapatok név szerint. */
export async function fetchTeams(db: NbaClient): Promise<Team[]> {
  const { data, error } = await db
    .from('teams')
    .select(TEAM_COLUMNS)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Team[];
}

/** Az egysoros `app_settings`; hiányzó sornál nincs követett csapat. */
export async function fetchAppSettings(db: NbaClient): Promise<AppSettings> {
  const { data, error } = await db
    .from('app_settings')
    .select('followed_team_id')
    .eq('id', true)
    .maybeSingle<AppSettings>();
  if (error) throw new Error(error.message);
  return data ?? { followed_team_id: null };
}
