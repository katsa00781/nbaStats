// Egy meccs box score-ja: a két csapat játékossorai (`player_game_stats`) és
// csapatsorai (`team_game_stats`). A csapatösszeg forrása a csapatsor, nem a
// játékossorok összege: az ESPN-adatban a kettő eltérhet (pl. ID nélküli
// játékosrekord), és ilyenkor a csapatsor a helyes. A hook
// (hooks/useBoxScoreData.ts) a böngészős klienssel hívja; a kliens paraméter,
// így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { TableRow } from '@/lib/supabase';
import { simpleValuation } from '@/lib/stat-formulas';

const PLAYER_COLUMNS =
  'player_id, team_id, starter, did_not_play, dnp_reason, minutes, points, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, plus_minus, players(name, position, jersey, headshot_url)';
type PlayerStatRow = Pick<
  TableRow<'player_game_stats'>,
  | 'player_id'
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
  | 'oreb'
  | 'dreb'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'pf'
  | 'plus_minus'
> & {
  // A `player_id` idegen kulcsán át beágyazott törzsadat (egy sor).
  players: Pick<TableRow<'players'>, 'name' | 'position' | 'jersey' | 'headshot_url'> | null;
};

const TEAM_COLUMNS =
  'team_id, points, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, points_in_paint, fast_break_points, points_off_turnovers, largest_lead';
type TeamStatRow = Pick<
  TableRow<'team_game_stats'>,
  | 'team_id'
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
  | 'largest_lead'
>;

// A játékossorokból összegezhető mutatók: ezeknél a játékosok összege a tiszta
// adatban megegyezik a csapatsorral. Az eladott labda kimarad, mert a csapatsor
// a csapatszintű eladott labdákat is tartalmazza.
const SUMMED_STATS = [
  'points',
  'fgMade',
  'fgAttempted',
  'threeMade',
  'threeAttempted',
  'ftMade',
  'ftAttempted',
  'offensiveRebounds',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'fouls',
] as const;
export type SummedStat = (typeof SUMMED_STATS)[number];

/** Egy mutató, amelynél a játékossorok összege eltér a csapatsortól. */
export interface BoxScoreSumMismatch {
  stat: SummedStat;
  playerSum: number;
  teamTotal: number;
}

/** Egy pályára lépett játékos sora egy meccsen. */
export interface BoxScorePlayer {
  playerId: string;
  name: string;
  /** A játékos-törzsadat aktuális értéke (ESPN-rövidítés: G / F / C). */
  position: string | null;
  jersey: string | null;
  headshotUrl: string | null;
  starter: boolean;
  minutes: number;
  points: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  offensiveRebounds: number;
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

/** A keretben volt, de nem lépett pályára (DNP). */
export interface BoxScoreAbsence {
  playerId: string;
  name: string;
  /** Az ESPN szabad szöveges indoka (angolul), ha megadta. */
  reason: string | null;
}

/** A csapatsor (`team_game_stats`): a hiteles csapatösszeg. */
export interface BoxScoreTeamTotals {
  points: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  offensiveRebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  /** A csapatszintű eladott labdákat is tartalmazza. */
  turnovers: number;
  fouls: number;
  pointsInPaint: number | null;
  fastBreakPoints: number | null;
  pointsOffTurnovers: number | null;
  largestLead: number | null;
}

export interface BoxScoreTeam {
  teamId: string;
  /** Pályára lépett játékosok: a kezdők elöl, azon belül perc szerint csökkenő. */
  players: BoxScorePlayer[];
  /** DNP sorok, név szerint; semmilyen összegbe nem számítanak bele (T8). */
  didNotPlay: BoxScoreAbsence[];
  /** `null`, ha a meccshez nincs csapatsor. */
  totals: BoxScoreTeamTotals | null;
  /**
   * Ahol a játékossorok összege eltér a csapatsortól: a forrás hiányos (T19),
   * pl. ID nélküli ESPN-rekord miatt kimaradt játékossor. Csapatsor nélkül üres.
   */
  sumMismatches: BoxScoreSumMismatch[];
}

function toBoxScorePlayer(row: PlayerStatRow, name: string): BoxScorePlayer {
  return {
    playerId: row.player_id,
    name,
    position: row.players?.position ?? null,
    jersey: row.players?.jersey ?? null,
    headshotUrl: row.players?.headshot_url ?? null,
    starter: row.starter,
    minutes: row.minutes,
    points: row.points,
    fgMade: row.fgm,
    fgAttempted: row.fga,
    threeMade: row.fg3m,
    threeAttempted: row.fg3a,
    ftMade: row.ftm,
    ftAttempted: row.fta,
    offensiveRebounds: row.oreb,
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

function toTeamTotals(row: TeamStatRow): BoxScoreTeamTotals {
  return {
    points: row.points,
    fgMade: row.fgm,
    fgAttempted: row.fga,
    threeMade: row.fg3m,
    threeAttempted: row.fg3a,
    ftMade: row.ftm,
    ftAttempted: row.fta,
    offensiveRebounds: row.oreb,
    rebounds: row.reb,
    assists: row.ast,
    steals: row.stl,
    blocks: row.blk,
    turnovers: row.tov,
    fouls: row.pf,
    pointsInPaint: row.points_in_paint,
    fastBreakPoints: row.fast_break_points,
    pointsOffTurnovers: row.points_off_turnovers,
    largestLead: row.largest_lead,
  };
}

// Box score sorrend: kezdők, majd a cserék; azon belül a többet játszó elöl.
function byLineupOrder(a: BoxScorePlayer, b: BoxScorePlayer): number {
  if (a.starter !== b.starter) return a.starter ? -1 : 1;
  return b.minutes - a.minutes || b.points - a.points || a.name.localeCompare(b.name, 'hu');
}

function findSumMismatches(players: BoxScorePlayer[], totals: BoxScoreTeamTotals | null): BoxScoreSumMismatch[] {
  if (!totals) return [];
  const mismatches: BoxScoreSumMismatch[] = [];
  for (const stat of SUMMED_STATS) {
    const playerSum = players.reduce((sum, player) => sum + player[stat], 0);
    if (playerSum !== totals[stat]) mismatches.push({ stat, playerSum, teamTotal: totals[stat] });
  }
  return mismatches;
}

/** A nyers játékos- és csapatsorok csapatonként csoportosítva. */
export function toBoxScoreTeams(playerRows: PlayerStatRow[], teamRows: TeamStatRow[]): BoxScoreTeam[] {
  const teams = new Map<string, BoxScoreTeam>();
  const teamOf = (teamId: string): BoxScoreTeam => {
    let team = teams.get(teamId);
    if (!team) {
      team = { teamId, players: [], didNotPlay: [], totals: null, sumMismatches: [] };
      teams.set(teamId, team);
    }
    return team;
  };

  for (const row of teamRows) teamOf(row.team_id).totals = toTeamTotals(row);
  for (const row of playerRows) {
    // A `player_id` NOT NULL idegen kulcs: a törzsadat hiánya adathiba, nem pótoljuk névvel.
    if (!row.players) throw new Error(`Hiányzó játékos-törzsadat (player_id: ${row.player_id})`);
    const team = teamOf(row.team_id);
    if (row.did_not_play) {
      team.didNotPlay.push({ playerId: row.player_id, name: row.players.name, reason: row.dnp_reason });
      continue;
    }
    team.players.push(toBoxScorePlayer(row, row.players.name));
  }

  for (const team of teams.values()) {
    team.players.sort(byLineupOrder);
    team.didNotPlay.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    team.sumMismatches = findSumMismatches(team.players, team.totals);
  }
  return [...teams.values()];
}

/**
 * Egy meccs box score-ja, csapatonként. Egy meccsnek legfeljebb néhány tucat
 * játékossora és két csapatsora van, ezért nem kell lapozás (T1). A `season_id`
 * szűrő a meccs-azonosító mellett is kötelező (minden lekérdezés szezonra szűrt).
 */
export async function fetchGameBoxScore(db: NbaClient, seasonId: string, gameId: string): Promise<BoxScoreTeam[]> {
  const [players, teams] = await Promise.all([
    // A típus nélküli kliens a beágyazott `players`-t tömbnek hinné; a `player_id`
    // idegen kulcs több-az-egyhez kapcsolat, ezért a PostgREST egyetlen objektumot ad.
    db
      .from('player_game_stats')
      .select(PLAYER_COLUMNS)
      .eq('season_id', seasonId)
      .eq('game_id', gameId)
      .overrideTypes<PlayerStatRow[], { merge: false }>(),
    db.from('team_game_stats').select(TEAM_COLUMNS).eq('season_id', seasonId).eq('game_id', gameId),
  ]);
  if (players.error) throw new Error(players.error.message);
  if (teams.error) throw new Error(teams.error.message);
  return toBoxScoreTeams(players.data ?? [], (teams.data ?? []) as TeamStatRow[]);
}
