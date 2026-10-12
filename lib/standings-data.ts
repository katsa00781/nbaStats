// A tabella (alapszakasz) az `nba.standings` táblából: az ESPN pillanatképe,
// csapat × szezon, naponta felülírva (ingest-standings.ts). A hivatalos kiemelés,
// a GB, a hazai / idegen mérleg és a clinch az ESPN adata; a származtatott
// mutatókat (győzelmi arány, meccsenkénti pont) itt számoljuk. A hook
// (hooks/useStandingsData.ts) a böngészős klienssel hívja; a kliens paraméter.

import type { NbaClient } from '@/lib/db-schema';
import type { TableRow } from '@/lib/supabase';

const STANDINGS_COLUMNS =
  'team_id, wins, losses, conference_seed, clincher, games_behind, home_record, road_record, division_record, conference_record, last_ten, streak, points_for, points_against';
type StandingsDbRow = Pick<
  TableRow<'standings'>,
  | 'team_id'
  | 'wins'
  | 'losses'
  | 'conference_seed'
  | 'clincher'
  | 'games_behind'
  | 'home_record'
  | 'road_record'
  | 'division_record'
  | 'conference_record'
  | 'last_ten'
  | 'streak'
  | 'points_for'
  | 'points_against'
>;

/** Az ESPN clincher-jelölései (a `standings` válasz saját leírása alapján). */
export const CLINCHER_LABELS: Record<string, string> = {
  '*': 'Legjobb ligamérleg biztosítva',
  z: 'Konferencia-elsőség biztosítva',
  y: 'Divízió-elsőség biztosítva',
  x: 'Rájátszás-részvétel biztosítva',
  xp: 'Rájátszás biztosítva (play-in megnyerve)',
  pb: 'Play-in részvétel biztosítva',
  e: 'Kiesett a rájátszásból',
};

/** Egy csapat sora a tabellán. */
export interface StandingRow {
  teamId: string;
  wins: number;
  losses: number;
  /** Győzelmi arány 0–1 között; `null`, ha még nincs lejátszott meccs. */
  winPct: number | null;
  conferenceSeed: number | null;
  clincher: string | null;
  gamesBehind: number;
  homeRecord: string | null;
  roadRecord: string | null;
  divisionRecord: string | null;
  conferenceRecord: string | null;
  lastTen: string | null;
  /** ESPN-jelölés, pl. `W3` (3 meccses győzelmi sorozat) vagy `L2`. */
  streak: string | null;
  /** Meccsenkénti szerzett és kapott pont; `null`, ha az ESPN nem adta. */
  pointsForPerGame: number | null;
  pointsAgainstPerGame: number | null;
}

/** Az adatbázis-sor a nézet számára: a származtatott mutatókkal. */
export function toStandingRow(row: StandingsDbRow): StandingRow {
  const games = row.wins + row.losses;
  const perGame = (total: number | null): number | null => (total === null || games === 0 ? null : total / games);
  return {
    teamId: row.team_id,
    wins: row.wins,
    losses: row.losses,
    winPct: games === 0 ? null : row.wins / games,
    conferenceSeed: row.conference_seed,
    clincher: row.clincher,
    gamesBehind: Number(row.games_behind),
    homeRecord: row.home_record,
    roadRecord: row.road_record,
    divisionRecord: row.division_record,
    conferenceRecord: row.conference_record,
    lastTen: row.last_ten,
    streak: row.streak,
    pointsForPerGame: perGame(row.points_for),
    pointsAgainstPerGame: perGame(row.points_against),
  };
}

/**
 * A szezon tabellája, mind a 30 csapattal. Legfeljebb 30 sor, ezért nincs lapozás.
 * A 2027-es (még le nem játszott) szezonra az import nem ír, ott üres lista jön.
 */
export async function fetchStandings(db: NbaClient, seasonId: string): Promise<StandingRow[]> {
  const { data, error } = await db.from('standings').select(STANDINGS_COLUMNS).eq('season_id', seasonId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as StandingsDbRow[]).map(toStandingRow);
}
