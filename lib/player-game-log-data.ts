// Egy játékos meccsenkénti naplója egy szezonban: a `player_game_stats` sorai a
// beágyazott meccs-sorral (`games`). A meccs a játékos akkori csapatának
// nézőpontjából látszik – a csapat a meccs-sorból jön (T9), így a szezon közben
// igazolt játékos sorai csapatonként külön szűrhetők. A hook
// (hooks/usePlayerGameLogData.ts) a böngészős klienssel hívja; a kliens
// paraméter, így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { GameRow, TeamGame } from '@/lib/game-data';
import type { TableRow } from '@/lib/supabase';
import { GAME_COLUMNS, toTeamGame } from '@/lib/game-data';
import { simpleValuation } from '@/lib/stat-formulas';

const LOG_COLUMNS = `team_id, starter, did_not_play, dnp_reason, minutes, points, fgm, fga, fg3m, fg3a, ftm, fta, reb, ast, stl, blk, tov, pf, plus_minus, games(${GAME_COLUMNS})`;
type PlayerGameRow = Pick<
  TableRow<'player_game_stats'>,
  | 'team_id'
  | 'starter'
  | 'did_not_play'
  | 'dnp_reason'
  | 'minutes'
  | 'points'
  | 'fgm'
  | 'fga'
  | 'fg3m'
  | 'fg3a'
  | 'ftm'
  | 'fta'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'pf'
  | 'plus_minus'
> & {
  // A `game_id` idegen kulcsán át beágyazott meccs-sor (egy sor).
  games: GameRow | null;
};

/** Egy meccs, amelyen a játékos pályára lépett. */
export interface PlayerGameLogEntry {
  /** A meccs a játékos akkori csapatának nézőpontjából. */
  game: TeamGame;
  /** A csapat, amelynek színeiben a meccsen szerepelt. */
  teamId: string;
  starter: boolean;
  minutes: number;
  points: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  plusMinus: number | null;
  /** FIBA valuation a meccs soraiból számolva. */
  valuation: number;
}

/** Egy meccs, amelyen a keretben volt, de nem lépett pályára (DNP). */
export interface PlayerGameLogAbsence {
  game: TeamGame;
  teamId: string;
  /** Az ESPN szabad szöveges indoka (angolul), ha megadta. */
  reason: string | null;
}

export interface PlayerGameLog {
  /** Pályára lépések, időrendben. */
  played: PlayerGameLogEntry[];
  /** DNP sorok, időrendben; semmilyen összegbe nem számítanak bele (T8). */
  didNotPlay: PlayerGameLogAbsence[];
}

function toLogEntry(row: PlayerGameRow, game: TeamGame): PlayerGameLogEntry {
  return {
    game,
    teamId: row.team_id,
    starter: row.starter,
    minutes: row.minutes,
    points: row.points,
    fgMade: row.fgm,
    fgAttempted: row.fga,
    threeMade: row.fg3m,
    threeAttempted: row.fg3a,
    ftMade: row.ftm,
    ftAttempted: row.fta,
    rebounds: row.reb,
    assists: row.ast,
    steals: row.stl,
    blocks: row.blk,
    turnovers: row.tov,
    fouls: row.pf,
    plusMinus: row.plus_minus,
    valuation: simpleValuation({
      points: row.points,
      rebounds: row.reb,
      assists: row.ast,
      steals: row.stl,
      blocks: row.blk,
      fgMade: row.fgm,
      fgAttempted: row.fga,
      ftMade: row.ftm,
      ftAttempted: row.fta,
      turnovers: row.tov,
    }),
  };
}

const byGameTime = (a: { game: TeamGame }, b: { game: TeamGame }): number =>
  a.game.gameDate.localeCompare(b.game.gameDate) || (a.game.startTime ?? '').localeCompare(b.game.startTime ?? '');

/**
 * A nyers sorok naplóvá alakítva. Csak a lezárt meccsek számítanak, ahogy a
 * szezon-összesítő view-ban is: így a napló sorainak száma a játékos
 * meccsszámával egyezik.
 */
export function toPlayerGameLog(rows: PlayerGameRow[]): PlayerGameLog {
  const log: PlayerGameLog = { played: [], didNotPlay: [] };
  for (const row of rows) {
    // A `game_id` NOT NULL idegen kulcs: a meccs-sor hiánya adathiba.
    if (!row.games) throw new Error('Hiányzó meccs-sor a játékos naplójában');
    if (row.games.status !== 'final') continue;
    const game = toTeamGame(row.games, row.team_id);
    if (row.did_not_play) log.didNotPlay.push({ game, teamId: row.team_id, reason: row.dnp_reason });
    else log.played.push(toLogEntry(row, game));
  }
  log.played.sort(byGameTime);
  log.didNotPlay.sort(byGameTime);
  return log;
}

/**
 * A játékos összes sora a szezonban (minden szakasz és csapat). Egy játékosnak
 * szezononként legfeljebb kb. 110 sora van (82 alapszakasz + play-in +
 * rájátszás), ezért nem kell lapozás (T1).
 */
export async function fetchPlayerGameLog(db: NbaClient, seasonId: string, playerId: string): Promise<PlayerGameLog> {
  // A típus nélküli kliens a beágyazott `games`-t tömbnek hinné; a `game_id`
  // idegen kulcs több-az-egyhez kapcsolat, ezért a PostgREST egyetlen objektumot ad.
  const { data, error } = await db
    .from('player_game_stats')
    .select(LOG_COLUMNS)
    .eq('season_id', seasonId)
    .eq('player_id', playerId)
    .overrideTypes<PlayerGameRow[], { merge: false }>();
  if (error) throw new Error(error.message);
  return toPlayerGameLog(data ?? []);
}
