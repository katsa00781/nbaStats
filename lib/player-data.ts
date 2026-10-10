// Egy csapat játékosainak szezon-összesítője a `player_season_stats_by_season`
// view-ból (migráció 003). Az ASEStats `player-stat-mapping` moduljának
// NBA-megfelelője: a view összegeiből itt lesz meccsenkénti átlag és százalék.
// A hook (hooks/usePlayerData.ts) a böngészős klienssel hívja; a kliens
// paraméter, így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { ViewRow } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { SEASON_TYPE_ORDER } from '@/lib/season-types';
import { effectiveFgPct, shootingPct, simpleValuation, trueShootingPct } from '@/lib/stat-formulas';

const STAT_COLUMNS =
  'season_type, player_id, name, position, jersey, headshot_url, games_played, games_started, total_minutes, total_points, total_fgm, total_fga, total_three_made, total_three_attempted, total_free_throw_made, total_free_throw_attempted, total_rebounds, total_assists, total_steals, total_blocks, total_turnovers, total_plus_minus';
type PlayerSeasonRow = Pick<
  ViewRow<'player_season_stats_by_season'>,
  | 'season_type'
  | 'player_id'
  | 'name'
  | 'position'
  | 'jersey'
  | 'headshot_url'
  | 'games_played'
  | 'games_started'
  | 'total_minutes'
  | 'total_points'
  | 'total_fgm'
  | 'total_fga'
  | 'total_three_made'
  | 'total_three_attempted'
  | 'total_free_throw_made'
  | 'total_free_throw_attempted'
  | 'total_rebounds'
  | 'total_assists'
  | 'total_steals'
  | 'total_blocks'
  | 'total_turnovers'
  | 'total_plus_minus'
>;

/**
 * Egy játékos sora egy csapatnál, egy szezon egy szakaszában. A szezon közben
 * igazolt játékosnál csak az adott csapat színeiben játszott meccsek számítanak.
 */
export interface PlayerSeasonStats {
  playerId: string;
  seasonType: number;
  name: string;
  /** A játékos-törzsadat aktuális értéke (ESPN-rövidítés: G / F / C). */
  position: string | null;
  jersey: string | null;
  headshotUrl: string | null;
  /** Pályára lépések; a DNP nem számít (T8). */
  gamesPlayed: number;
  gamesStarted: number;
  minutesPerGame: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  turnoversPerGame: number;
  /** FIBA valuation meccsenként, az összegekből számolva. */
  valuationPerGame: number;
  /** `null`, ha az ESPN egyik meccsre sem adott +/- értéket. */
  plusMinusPerGame: number | null;
  // Százalékok az összesített dobásokból (T12); `null`, ha nem volt kísérlet.
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
  trueShootingPct: number | null;
  effectiveFgPct: number | null;
}

/** View-sor → megjelenítési alak. A kísérletszám forrása a box score (`total_fgm` / `total_fga`). */
export function toPlayerSeasonStats(row: PlayerSeasonRow): PlayerSeasonStats {
  const games = row.games_played;
  const perGame = (total: number): number => (games > 0 ? total / games : 0);
  const pctOrNull = (attempts: number, pct: number): number | null => (attempts > 0 ? pct : null);
  const valuation = simpleValuation({
    points: row.total_points,
    rebounds: row.total_rebounds,
    assists: row.total_assists,
    steals: row.total_steals,
    blocks: row.total_blocks,
    fgMade: row.total_fgm,
    fgAttempted: row.total_fga,
    ftMade: row.total_free_throw_made,
    ftAttempted: row.total_free_throw_attempted,
    turnovers: row.total_turnovers,
  });

  return {
    playerId: row.player_id,
    seasonType: row.season_type,
    name: row.name,
    position: row.position,
    jersey: row.jersey,
    headshotUrl: row.headshot_url,
    gamesPlayed: games,
    gamesStarted: row.games_started,
    minutesPerGame: perGame(row.total_minutes),
    pointsPerGame: perGame(row.total_points),
    reboundsPerGame: perGame(row.total_rebounds),
    assistsPerGame: perGame(row.total_assists),
    stealsPerGame: perGame(row.total_steals),
    blocksPerGame: perGame(row.total_blocks),
    turnoversPerGame: perGame(row.total_turnovers),
    valuationPerGame: perGame(valuation),
    plusMinusPerGame: row.total_plus_minus === null ? null : perGame(row.total_plus_minus),
    fgPct: pctOrNull(row.total_fga, shootingPct(row.total_fgm, row.total_fga)),
    threePct: pctOrNull(row.total_three_attempted, shootingPct(row.total_three_made, row.total_three_attempted)),
    ftPct: pctOrNull(
      row.total_free_throw_attempted,
      shootingPct(row.total_free_throw_made, row.total_free_throw_attempted),
    ),
    trueShootingPct: pctOrNull(
      row.total_fga + row.total_free_throw_attempted,
      trueShootingPct(row.total_points, row.total_fga, row.total_free_throw_attempted),
    ),
    effectiveFgPct: pctOrNull(row.total_fga, effectiveFgPct(row.total_fgm, row.total_three_made, row.total_fga)),
  };
}

/**
 * A csapat játékosainak összesítői a szezon minden tárolt szakaszára
 * (alapszakasz / play-in / rájátszás). A sorok szakaszonként külön érkeznek, a
 * nézet egyszerre egyet mutat – a szakaszok nem adódnak össze. Egy csapatnak
 * szezononként néhány tucat sora van; a lapozó helper a view-ra akkor is
 * kötelező (T1), mert egy teljes szezon már az 1000-es limit határán van.
 */
export async function fetchTeamPlayerStats(
  db: NbaClient,
  seasonId: string,
  teamId: string,
): Promise<PlayerSeasonStats[]> {
  const rows = await fetchAllRows<PlayerSeasonRow>((from, to) =>
    db
      .from('player_season_stats_by_season')
      .select(STAT_COLUMNS)
      .eq('season_id', seasonId)
      .eq('team_id', teamId)
      .in('season_type', SEASON_TYPE_ORDER)
      .order('season_type', { ascending: true })
      .order('player_id', { ascending: true })
      .range(from, to),
  );
  return rows.map(toPlayerSeasonStats);
}
