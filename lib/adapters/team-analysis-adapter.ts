// Adapter az NBA sémáról a csapat-elemző motor (lib/team-analysis.ts) bemenetére:
// a csapatsorok szakaszonkénti összesítőiből (TeamStageStats, mindkét oldal) és a
// játékosok szezon-összegeiből (view) állítja elő a csapatok nyers soraiból épülő
// benchmarkot, és elemzi a kiválasztott csapatot. A rosterhez a játékos-elemző motor
// szolgáltatja a posztot, a szerepköröket és a használati arányt, ugyanazzal a
// poszt szerinti liga-benchmarkkal, mint a Játékos-elemzés. A motor így nem ismeri a sémát.

import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { TeamAnalysis, TeamSeasonStat } from '@/lib/team-analysis';
import type { TeamStageStats } from '@/lib/team-stats-data';
import { buildStageBenchmarks, toRawPlayerStat } from '@/lib/adapters/player-analysis-adapter';
import { analyzePlayerSeason, isEligibleSample, normalizePlayerStats } from '@/lib/player-analysis';
import { simpleValuation } from '@/lib/stat-formulas';
import { analyzeTeamSeason, buildTeamBenchmarks } from '@/lib/team-analysis';

/** Ennyi meccs alatt a csapat mutatói és percentilisei még nem mérvadók (T15). */
export const MIN_TEAM_ANALYSIS_GAMES = 10;
/** A benchmarkhoz legalább ennyi, a küszöböt elérő csapat kell a szakaszban. */
export const MIN_TEAM_BENCHMARK_POOL = 8;
/**
 * Ennyi alkalmas (szerepkörrel és használattal bíró) játékos alatt a roster-alapú
 * megállapítások (szerepkörök, használat-koncentráció, kockázatok) nem megbízhatók.
 * A rájátszásban a 8 meccs / 18 perc küszöb miatt csapatonként 2–5 játékos alkalmas.
 */
export const MIN_RELIABLE_ROSTER_PLAYERS = 6;

export type TeamAnalysisOutcome =
  | { status: 'ready'; analysis: TeamAnalysis; eligiblePlayers: number }
  /** Kevés meccs: a percentilisek nem megbízhatók. */
  | { status: 'small-sample'; games: number }
  /** A szakaszban kevés csapat éri el a meccsszám-küszöböt (pl. play-in). */
  | { status: 'no-benchmark'; teams: number };

export interface TeamAnalysisLookups {
  /** csapat azonosító → név (a benchmark hasonló-klaszter listájához). */
  teamNames: ReadonlyMap<string, string>;
  /** játékos azonosító → név; a kiválasztott csapat játékosaihoz elég (a többi névtelen marad). */
  playerNames: ReadonlyMap<string, string>;
}

/** A csapat rosterje a szakaszban: játékosonként egy sor (a cserélt játékosnál csak az itteni meccsek). */
function buildRoster(
  totals: readonly LeaguePlayerTotals[],
  playerBenchmarks: ReturnType<typeof buildStageBenchmarks>,
  teamId: string,
  seasonType: number,
  playerNames: ReadonlyMap<string, string>,
): TeamSeasonStat['roster'] {
  const roster: TeamSeasonStat['roster'] = [];
  for (const row of totals) {
    if (row.team_id !== teamId || row.season_type !== seasonType) continue;
    const raw = toRawPlayerStat(row);
    // A dobásbontás nélküli sor (kb. 0,3%) nem osztható posztra: kimarad.
    if (!raw) continue;
    const normalized = normalizePlayerStats(raw);
    // Szerepkör és használat csak az alkalmas mintájú, benchmarkkal rendelkező játékosnál van;
    // a perce így is beleszámít a poszt szerinti percmegoszlásba.
    const eligible = isEligibleSample(normalized) && Boolean(playerBenchmarks[normalized.position]);
    roster.push({
      playerId: row.player_id,
      name: playerNames.get(row.player_id) ?? '',
      position: normalized.position,
      positionBuckets: normalized.positionBuckets,
      minutes: row.total_minutes,
      usageProxy: eligible ? normalized.usageProxyPer36 : 0,
      roleKeys: eligible ? analyzePlayerSeason(raw, playerBenchmarks).roleKeys : [],
    });
  }
  return roster;
}

function toTeamSeasonStat(stats: TeamStageStats, name: string, roster: TeamSeasonStat['roster']): TeamSeasonStat {
  const { own, opponent } = stats;
  return {
    teamId: stats.teamId,
    teamName: name,
    games: stats.games,
    gameMinutes: stats.gameMinutes,
    pointsFor: own.points,
    pointsAgainst: opponent.points,
    fga2: own.fga - own.fg3a,
    fgm2: own.fgm - own.fg3m,
    fga3: own.fg3a,
    fgm3: own.fg3m,
    fta: own.fta,
    ftm: own.ftm,
    oreb: own.oreb,
    dreb: own.dreb,
    ast: own.ast,
    tov: own.tov,
    stl: own.stl,
    blk: own.blk,
    fouls: own.pf,
    val: simpleValuation({
      points: own.points,
      rebounds: own.reb,
      assists: own.ast,
      steals: own.stl,
      blocks: own.blk,
      fgMade: own.fgm,
      fgAttempted: own.fga,
      ftMade: own.ftm,
      ftAttempted: own.fta,
      turnovers: own.tov,
    }),
    opponent: {
      fga2: opponent.fga - opponent.fg3a,
      fgm2: opponent.fgm - opponent.fg3m,
      fga3: opponent.fg3a,
      fgm3: opponent.fg3m,
      fta: opponent.fta,
      ftm: opponent.ftm,
      oreb: opponent.oreb,
      dreb: opponent.dreb,
      tov: opponent.tov,
    },
    roster,
  };
}

/**
 * A csapat elemzése egy szakaszban, a szakasz azonos meccsszám-küszöböt elérő
 * csapataihoz mérve. `null`, ha a csapatnak nincs sora a szakaszban. A kis minta és a
 * kis pool nem hiba: a nézet erről tájékoztat.
 */
export function analyzeStageTeam(
  stageStats: readonly TeamStageStats[],
  totals: readonly LeaguePlayerTotals[],
  teamId: string,
  seasonType: number,
  lookups: TeamAnalysisLookups,
): TeamAnalysisOutcome | null {
  const selected = stageStats.find(stats => stats.teamId === teamId && stats.seasonType === seasonType);
  if (!selected) return null;
  if (selected.games < MIN_TEAM_ANALYSIS_GAMES) return { status: 'small-sample', games: selected.games };

  const pool = stageStats.filter(stats => stats.seasonType === seasonType && stats.games >= MIN_TEAM_ANALYSIS_GAMES);
  if (pool.length < MIN_TEAM_BENCHMARK_POOL) return { status: 'no-benchmark', teams: pool.length };

  const playerBenchmarks = buildStageBenchmarks(totals, seasonType);
  const seasonStats = pool.map(stats =>
    toTeamSeasonStat(
      stats,
      lookups.teamNames.get(stats.teamId) ?? '',
      buildRoster(totals, playerBenchmarks, stats.teamId, seasonType, stats.teamId === teamId ? lookups.playerNames : new Map()),
    ),
  );
  const target = seasonStats.find(stats => stats.teamId === teamId);
  if (!target) return null;

  return {
    status: 'ready',
    analysis: analyzeTeamSeason(target, buildTeamBenchmarks(seasonStats)),
    eligiblePlayers: target.roster.filter(player => player.usageProxy > 0).length,
  };
}
