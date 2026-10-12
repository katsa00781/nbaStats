// Adapter az NBA sémáról a játékos-elemző motor (lib/player-analysis.ts) bemenetére:
// a view összegeiből (LeaguePlayerTotals) szakaszonként állítja elő a motor nyers
// játékos-soraiból épülő poszt-benchmarkot, és elemzi a kiválasztott játékost a
// kiválasztott csapatnál. A motor így nem ismeri a sémát.

import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type {
  AdvancedPlayerBlocks,
  LeagueBenchmarks,
  Position,
  PlayerAnalysis,
  RawPlayerSeasonStat,
} from '@/lib/player-analysis';
import {
  analyzePlayerSeason,
  buildAdvancedPlayerBlocks,
  buildLeagueBenchmarks,
  isEligibleSample,
  MIN_BENCHMARK_POOL,
  normalizePlayerStats,
  REQUIRED_MIN_GAMES,
  REQUIRED_MIN_MINUTES_PER_GAME,
} from '@/lib/player-analysis';
import { simpleValuation } from '@/lib/stat-formulas';

export type PlayerAnalysisOutcome =
  | { status: 'ready'; analysis: PlayerAnalysis; blocks: AdvancedPlayerBlocks }
  /** Kevés meccs vagy perc: a percentilisek nem megbízhatók (T15). */
  | { status: 'small-sample'; games: number; minutesPerGame: number }
  /** A poszt pooljában nincs elég alkalmas játékos (pl. play-in). */
  | { status: 'no-benchmark'; position: Position }
  /** A dobásbontás (close / mid) hiányzik: nincs dobás-esemény ehhez a játékoshoz. */
  | { status: 'no-shot-data' };

export const ANALYSIS_REQUIREMENTS = {
  minGames: REQUIRED_MIN_GAMES,
  minMinutesPerGame: REQUIRED_MIN_MINUTES_PER_GAME,
  minBenchmarkPool: MIN_BENCHMARK_POOL,
} as const;

/** View-sor(ok) → a motor nyers sora; `null`, ha a dobásbontás hiányzik. */
export function toRawPlayerStat(totals: LeaguePlayerTotals): RawPlayerSeasonStat | null {
  if (
    totals.total_close_made === null ||
    totals.total_close_attempted === null ||
    totals.total_mid_made === null ||
    totals.total_mid_attempted === null
  ) {
    return null;
  }
  return {
    playerId: totals.player_id,
    // A motor nem használja a nevet; az adapter nem hordozza.
    name: '',
    position: 'C',
    positionLabel: totals.position,
    games: totals.games_played,
    minutes: totals.total_minutes,
    points: totals.total_points,
    close: { made: totals.total_close_made, attempted: totals.total_close_attempted },
    mid: { made: totals.total_mid_made, attempted: totals.total_mid_attempted },
    three: { made: totals.total_three_made, attempted: totals.total_three_attempted },
    ft: { made: totals.total_free_throw_made, attempted: totals.total_free_throw_attempted },
    rebounds: {
      offensive: totals.total_offensive_rebounds,
      defensive: totals.total_defensive_rebounds,
      total: totals.total_rebounds,
    },
    assists: totals.total_assists,
    steals: totals.total_steals,
    blocks: totals.total_blocks,
    turnovers: totals.total_turnovers,
    fouls: { committed: totals.total_fouls_committed },
    valuation: simpleValuation({
      points: totals.total_points,
      rebounds: totals.total_rebounds,
      assists: totals.total_assists,
      steals: totals.total_steals,
      blocks: totals.total_blocks,
      fgMade: totals.total_fgm,
      fgAttempted: totals.total_fga,
      ftMade: totals.total_free_throw_made,
      ftAttempted: totals.total_free_throw_attempted,
      turnovers: totals.total_turnovers,
    }),
  };
}

/** Egy játékos csapatonkénti soraiból egy (a cserélt játékos egy sorba összegződik). */
function mergeTeamRows(rows: readonly LeaguePlayerTotals[]): LeaguePlayerTotals {
  return rows.reduce((sum, row) => ({
    ...sum,
    games_played: sum.games_played + row.games_played,
    total_minutes: sum.total_minutes + row.total_minutes,
    total_points: sum.total_points + row.total_points,
    total_fgm: sum.total_fgm + row.total_fgm,
    total_fga: sum.total_fga + row.total_fga,
    // A bontás hiányzó értéke (null) az összegben is hiányzik.
    total_close_made: sum.total_close_made === null || row.total_close_made === null ? null : sum.total_close_made + row.total_close_made,
    total_close_attempted: sum.total_close_attempted === null || row.total_close_attempted === null ? null : sum.total_close_attempted + row.total_close_attempted,
    total_mid_made: sum.total_mid_made === null || row.total_mid_made === null ? null : sum.total_mid_made + row.total_mid_made,
    total_mid_attempted: sum.total_mid_attempted === null || row.total_mid_attempted === null ? null : sum.total_mid_attempted + row.total_mid_attempted,
    total_three_made: sum.total_three_made + row.total_three_made,
    total_three_attempted: sum.total_three_attempted + row.total_three_attempted,
    total_free_throw_made: sum.total_free_throw_made + row.total_free_throw_made,
    total_free_throw_attempted: sum.total_free_throw_attempted + row.total_free_throw_attempted,
    total_offensive_rebounds: sum.total_offensive_rebounds + row.total_offensive_rebounds,
    total_defensive_rebounds: sum.total_defensive_rebounds + row.total_defensive_rebounds,
    total_rebounds: sum.total_rebounds + row.total_rebounds,
    total_assists: sum.total_assists + row.total_assists,
    total_steals: sum.total_steals + row.total_steals,
    total_blocks: sum.total_blocks + row.total_blocks,
    total_turnovers: sum.total_turnovers + row.total_turnovers,
    total_fouls_committed: sum.total_fouls_committed + row.total_fouls_committed,
  }));
}

/**
 * Az adott szakasz poszt-benchmarkja a liga összes játékosából. A szezon közben
 * igazolt játékos a poolban egy (összegzett) játékos: a benchmark játékosokból áll,
 * nem csapat-játékos párokból.
 */
export function buildStageBenchmarks(totals: readonly LeaguePlayerTotals[], seasonType: number): LeagueBenchmarks {
  const byPlayer = new Map<string, LeaguePlayerTotals[]>();
  for (const row of totals) {
    if (row.season_type !== seasonType) continue;
    const rows = byPlayer.get(row.player_id);
    if (rows) rows.push(row);
    else byPlayer.set(row.player_id, [row]);
  }
  const raws: RawPlayerSeasonStat[] = [];
  for (const rows of byPlayer.values()) {
    const raw = toRawPlayerStat(mergeTeamRows(rows));
    if (raw) raws.push(raw);
  }
  return buildLeagueBenchmarks(raws);
}

/**
 * A játékos elemzése a kiválasztott csapatnál (a lista átlagaival azonos meccsek).
 * A kis minta és a hiányzó benchmark nem hiba: a nézet erről tájékoztat.
 */
export function analyzeStagePlayer(
  totals: readonly LeaguePlayerTotals[],
  benchmarks: LeagueBenchmarks,
  playerId: string,
  teamId: string,
  seasonType: number,
): PlayerAnalysisOutcome | null {
  const row = totals.find(
    candidate => candidate.player_id === playerId && candidate.team_id === teamId && candidate.season_type === seasonType,
  );
  if (!row) return null;

  const raw = toRawPlayerStat(row);
  if (!raw) return { status: 'no-shot-data' };

  const normalized = normalizePlayerStats(raw);
  if (!isEligibleSample(normalized)) {
    return { status: 'small-sample', games: normalized.games, minutesPerGame: normalized.minutesPerGame };
  }
  if (!benchmarks[normalized.position]) return { status: 'no-benchmark', position: normalized.position };

  return {
    status: 'ready',
    analysis: analyzePlayerSeason(raw, benchmarks),
    blocks: buildAdvancedPlayerBlocks(raw, benchmarks),
  };
}
