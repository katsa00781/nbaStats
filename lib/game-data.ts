// Egy csapat meccsei egy szezonban, a csapat nézőpontjából. A `games` tábla
// semleges hazai/vendég sémájú (nincs `our_team_id`): a nézőpontot itt, a
// leképezésben adjuk hozzá. A hook (hooks/useGameData.ts) a böngészős klienssel
// hívja; a kliens paraméter, így a modul CLI-ből is használható.

import type { NbaClient } from '@/lib/db-schema';
import type { GameStatus, TableRow } from '@/lib/supabase';
import { SEASON_TYPE_ORDER } from '@/lib/season-types';

const GAME_COLUMNS =
  'id, season_type, game_date, start_time, home_team_id, away_team_id, home_score, away_score, status, periods, venue';
type GameRow = Pick<
  TableRow<'games'>,
  | 'id'
  | 'season_type'
  | 'game_date'
  | 'start_time'
  | 'home_team_id'
  | 'away_team_id'
  | 'home_score'
  | 'away_score'
  | 'status'
  | 'periods'
  | 'venue'
>;

const REGULATION_PERIODS = 4;

export type GameResult = 'win' | 'loss';

export interface TeamGame {
  id: string;
  seasonType: number;
  /** Amerikai keleti parti helyi nap (YYYY-MM-DD). */
  gameDate: string;
  startTime: string | null;
  status: GameStatus;
  isHome: boolean;
  opponentTeamId: string;
  teamScore: number | null;
  opponentScore: number | null;
  /** Csak lezárt meccsnél; különben `null`. */
  result: GameResult | null;
  /** Hosszabbítások száma (0 = rendes játékidő). */
  overtimes: number;
  venue: string | null;
}

export interface TeamRecord {
  wins: number;
  losses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  pointsFor: number;
  pointsAgainst: number;
}

/** Semleges meccs-sor → a `teamId` csapat nézőpontja. */
export function toTeamGame(row: GameRow, teamId: string): TeamGame {
  const isHome = row.home_team_id === teamId;
  const teamScore = isHome ? row.home_score : row.away_score;
  const opponentScore = isHome ? row.away_score : row.home_score;
  const decided = row.status === 'final' && teamScore !== null && opponentScore !== null;
  return {
    id: row.id,
    seasonType: row.season_type,
    gameDate: row.game_date,
    startTime: row.start_time,
    status: row.status,
    isHome,
    opponentTeamId: isHome ? row.away_team_id : row.home_team_id,
    teamScore,
    opponentScore,
    result: decided ? (teamScore > opponentScore ? 'win' : 'loss') : null,
    overtimes: Math.max(0, (row.periods ?? REGULATION_PERIODS) - REGULATION_PERIODS),
    venue: row.venue,
  };
}

/**
 * A csapat összes meccse a szezonban (minden státusz és szezontípus), időrendben.
 * Egy csapatnak szezononként legfeljebb kb. 110 meccse van (82 alapszakasz +
 * play-in + rájátszás), ezért nem kell lapozás (T1).
 */
export async function fetchTeamGames(db: NbaClient, seasonId: string, teamId: string): Promise<TeamGame[]> {
  const { data, error } = await db
    .from('games')
    .select(GAME_COLUMNS)
    .eq('season_id', seasonId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('game_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as GameRow[]).map(row => toTeamGame(row, teamId));
}

/** A meccsek között előforduló szezontípusok, időrendben (alapszakasz → play-in → rájátszás). */
export function seasonTypesOf(games: TeamGame[]): number[] {
  const present = new Set(games.map(g => g.seasonType));
  const known = SEASON_TYPE_ORDER.filter(type => present.has(type));
  const unknown = [...present].filter(type => !SEASON_TYPE_ORDER.includes(type)).sort((a, b) => a - b);
  return [...known, ...unknown];
}

/** Mérleg és pontösszeg a lezárt meccsekből; a le nem zárt meccs nem számít. */
export function summarizeRecord(games: TeamGame[]): TeamRecord {
  const record: TeamRecord = {
    wins: 0,
    losses: 0,
    homeWins: 0,
    homeLosses: 0,
    awayWins: 0,
    awayLosses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
  for (const game of games) {
    if (game.result === null || game.teamScore === null || game.opponentScore === null) continue;
    const won = game.result === 'win';
    if (won) record.wins++;
    else record.losses++;
    if (game.isHome) {
      if (won) record.homeWins++;
      else record.homeLosses++;
    } else if (won) record.awayWins++;
    else record.awayLosses++;
    record.pointsFor += game.teamScore;
    record.pointsAgainst += game.opponentScore;
  }
  return record;
}
