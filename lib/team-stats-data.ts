// A 30 csapat szezon-összesítője a `team_game_stats` sorokból, szakaszonként
// (alapszakasz / play-in / rájátszás) külön. A csapatonkénti nézet és a
// ligarangsor ugyanebből a közös adatból számolódik: a meccsenkénti csapatsorokat
// itt összegezzük, mindkét oldalra (saját és ellenfél), mert a fejlett mutatók
// (közös birtoklásszám, DRtg, OREB%) az ellenfél soráról is függenek (T14, T17).
// A hook (hooks/useTeamStatsData.ts) a böngészős klienssel hívja; a kliens
// paraméter, így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { TableRow } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { SEASON_TYPE_ORDER } from '@/lib/season-types';

const REGULATION_PERIODS = 4;
const REGULATION_MINUTES = 48;
const OVERTIME_MINUTES = 5;

const STAT_COLUMNS =
  'game_id, team_id, opponent_team_id, points, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, points_in_paint, fast_break_points, points_off_turnovers, games(season_type, status, periods)';
type TeamGameRow = Pick<
  TableRow<'team_game_stats'>,
  | 'game_id'
  | 'team_id'
  | 'opponent_team_id'
  | 'points'
  | 'fgm'
  | 'fga'
  | 'fg3m'
  | 'fg3a'
  | 'ftm'
  | 'fta'
  | 'oreb'
  | 'dreb'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'pf'
  | 'points_in_paint'
  | 'fast_break_points'
  | 'points_off_turnovers'
> & {
  // A `game_id` idegen kulcsán át beágyazott meccs-sor (egy sor).
  games: Pick<TableRow<'games'>, 'season_type' | 'status' | 'periods'> | null;
};

/** Egy oldal (a csapat vagy az ellenfelei) összegzett box score-ja. */
export interface SideTotals {
  points: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  /** A csapatszintű eladott labdákat is tartalmazza. */
  tov: number;
  pf: number;
}

/** Az ESPN nem minden meccsre adja: az összeg mellett a számláló is kell az átlaghoz. */
export interface OptionalTotal {
  sum: number;
  games: number;
}

/** Egy csapat összesítője a szezon egy szakaszában. */
export interface TeamStageStats {
  teamId: string;
  seasonType: number;
  games: number;
  /** Összes játékperc: 48 meccsenként + 5 hosszabbításonként (a tempó 48 percre vetítéséhez). */
  gameMinutes: number;
  own: SideTotals;
  opponent: SideTotals;
  pointsInPaint: OptionalTotal;
  fastBreakPoints: OptionalTotal;
  pointsOffTurnovers: OptionalTotal;
}

export interface LeagueTeamStats {
  stats: TeamStageStats[];
  /** Az ellenfél csapatsora nélküli meccsek: a fejlett mutatók miatt egyik oldalon sem számítanak. */
  incompleteGames: number;
}

const emptySide = (): SideTotals => ({
  points: 0,
  fgm: 0,
  fga: 0,
  fg3m: 0,
  fg3a: 0,
  ftm: 0,
  fta: 0,
  oreb: 0,
  dreb: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  pf: 0,
});

function addSide(total: SideTotals, row: TeamGameRow): void {
  total.points += row.points;
  total.fgm += row.fgm;
  total.fga += row.fga;
  total.fg3m += row.fg3m;
  total.fg3a += row.fg3a;
  total.ftm += row.ftm;
  total.fta += row.fta;
  total.oreb += row.oreb;
  total.dreb += row.dreb;
  total.reb += row.reb;
  total.ast += row.ast;
  total.stl += row.stl;
  total.blk += row.blk;
  total.tov += row.tov;
  total.pf += row.pf;
}

function addOptional(total: OptionalTotal, value: number | null): void {
  if (value === null) return;
  total.sum += value;
  total.games += 1;
}

/**
 * A meccsenkénti csapatsorok összegzése csapatonként és szakaszonként. Csak a
 * lezárt meccsek számítanak; az a meccs, amelyiknek az ellenfél-sora hiányzik,
 * kimarad, és az `incompleteGames` számolja.
 */
export function toLeagueTeamStats(rows: TeamGameRow[]): LeagueTeamStats {
  const byGameTeam = new Map<string, TeamGameRow>();
  for (const row of rows) byGameTeam.set(`${row.game_id}|${row.team_id}`, row);

  const stages = new Map<string, TeamStageStats>();
  const incompleteGames = new Set<string>();
  for (const row of rows) {
    const game = row.games;
    if (!game || game.status !== 'final' || !SEASON_TYPE_ORDER.includes(game.season_type)) continue;
    const opponentRow = byGameTeam.get(`${row.game_id}|${row.opponent_team_id}`);
    if (!opponentRow) {
      incompleteGames.add(row.game_id);
      continue;
    }

    const key = `${row.team_id}|${game.season_type}`;
    let stage = stages.get(key);
    if (!stage) {
      stage = {
        teamId: row.team_id,
        seasonType: game.season_type,
        games: 0,
        gameMinutes: 0,
        own: emptySide(),
        opponent: emptySide(),
        pointsInPaint: { sum: 0, games: 0 },
        fastBreakPoints: { sum: 0, games: 0 },
        pointsOffTurnovers: { sum: 0, games: 0 },
      };
      stages.set(key, stage);
    }
    const overtimes = Math.max(0, (game.periods ?? REGULATION_PERIODS) - REGULATION_PERIODS);
    stage.games += 1;
    stage.gameMinutes += REGULATION_MINUTES + overtimes * OVERTIME_MINUTES;
    addSide(stage.own, row);
    addSide(stage.opponent, opponentRow);
    addOptional(stage.pointsInPaint, row.points_in_paint);
    addOptional(stage.fastBreakPoints, row.fast_break_points);
    addOptional(stage.pointsOffTurnovers, row.points_off_turnovers);
  }
  return { stats: [...stages.values()], incompleteGames: incompleteGames.size };
}

/**
 * A szezon összes csapatsora (mind a 30 csapat, mindkét oldal). Egy szezon kb.
 * 2650 sor, ezért a lapozó helper kötelező (T1); a rendezés kulcsa az `id`, hogy a
 * lapok ne csússzanak össze.
 */
export async function fetchLeagueTeamStats(db: NbaClient, seasonId: string): Promise<LeagueTeamStats> {
  const rows = await fetchAllRows<TeamGameRow>((from, to) =>
    // A `game_id` idegen kulcs több-az-egyhez kapcsolat, ezért a PostgREST egyetlen
    // objektumot ad, nem tömböt (mint a box score lekérdezésnél).
    db
      .from('team_game_stats')
      .select(STAT_COLUMNS)
      .eq('season_id', seasonId)
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<TeamGameRow[], { merge: false }>(),
  );
  return toLeagueTeamStats(rows);
}
