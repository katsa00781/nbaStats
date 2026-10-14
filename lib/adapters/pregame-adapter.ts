// Adapter az NBA sémáról a meccs előtti scouting motor (lib/pregame-scouting.ts)
// bemenetére: a csapatsorok szakaszonkénti összesítőiből (TeamStageStats, mindkét
// oldal) a szakasz csapatainak benchmarkját, a játékos-összegekből (view) a két csapat
// rotációs játékosait állítja elő. A játékosok posztját és szerepköreit a
// játékos-elemző motor adja, ugyanazzal a poszt szerinti liga-benchmarkkal, mint a
// Játékos-elemzés. A motor így nem ismeri a sémát.

import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { PlayerSeasonStat, ScoutingReport, TeamSeasonStat } from '@/lib/pregame-scouting';
import type { TeamStageStats } from '@/lib/team-stats-data';
import { MIN_TEAM_ANALYSIS_GAMES, MIN_TEAM_BENCHMARK_POOL } from '@/lib/adapters/team-analysis-adapter';
import { buildStageBenchmarks, toRawPlayerStat } from '@/lib/adapters/player-analysis-adapter';
import { analyzePlayerSeason, isEligibleSample, normalizePlayerStats } from '@/lib/player-analysis';
import { analyzePreGameScouting, buildTeamBenchmarks } from '@/lib/pregame-scouting';
import { simpleValuation } from '@/lib/stat-formulas';

/** Mindkét csapatnak legalább ennyi meccse kell a szakaszban (azonos a Csapat-elemzés küszöbével). */
export const MIN_SCOUTING_GAMES = MIN_TEAM_ANALYSIS_GAMES;
/** A benchmarkhoz legalább ennyi, a küszöböt elérő csapat kell a szakaszban. */
export const MIN_SCOUTING_BENCHMARK_POOL = MIN_TEAM_BENCHMARK_POOL;
/**
 * A rotációs játékos küszöbe: a motor a kulcsjátékosokat a csapat teljes listájának
 * z-pontjaiból választja, ezért a ritkán játszó (sokszor néhány percet kapó) játékos
 * kimarad belőle. A küszöb alacsonyabb a Játékos-elemzés 8 meccs / 18 percénél: a
 * scoutingnak a teljes rotáció kell, nem csak a nagy percet kapók.
 */
export const MIN_ROTATION_GAMES = 5;
export const MIN_ROTATION_MINUTES_PER_GAME = 10;

/** A benchmark kulcsa: egy szakasz egy „liga”, ezért a motor liga / szezon kulcsa a szakasz. */
const BENCHMARK_LEAGUE = 'NBA';

export type ScoutingOutcome =
  | { status: 'ready'; report: ScoutingReport; ownRotation: number; opponentRotation: number }
  /** Valamelyik csapatnak nincs sora a szakaszban (még nem játszott). */
  | { status: 'no-data'; teamIds: string[] }
  /** Kevés meccs: a percentilisek nem megbízhatók. */
  | { status: 'small-sample'; teams: Array<{ teamId: string; games: number }> }
  /** A szakaszban kevés csapat éri el a meccsszám-küszöböt (pl. play-in). */
  | { status: 'no-benchmark'; teams: number };

export interface ScoutingLookups {
  /** csapat azonosító → név. */
  teamNames: ReadonlyMap<string, string>;
  /** játékos azonosító → név; a két csapat játékosaihoz elég (a többi névtelen marad). */
  playerNames: ReadonlyMap<string, string>;
}

function toTeamSeasonStat(stats: TeamStageStats, name: string): TeamSeasonStat {
  const { own, opponent } = stats;
  return {
    teamId: stats.teamId,
    teamName: name,
    league: BENCHMARK_LEAGUE,
    season: String(stats.seasonType),
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
  };
}

/** A csapat rotációja a szakaszban: játékosonként egy sor (a cserélt játékosnál csak az itteni meccsek). */
function buildRotation(
  totals: readonly LeaguePlayerTotals[],
  playerBenchmarks: ReturnType<typeof buildStageBenchmarks>,
  teamId: string,
  seasonType: number,
  playerNames: ReadonlyMap<string, string>,
): PlayerSeasonStat[] {
  const rotation: PlayerSeasonStat[] = [];
  for (const row of totals) {
    if (row.team_id !== teamId || row.season_type !== seasonType) continue;
    if (row.games_played < MIN_ROTATION_GAMES || row.total_minutes / row.games_played < MIN_ROTATION_MINUTES_PER_GAME) continue;
    const raw = toRawPlayerStat(row);
    // A dobásbontás nélküli sor (kb. 0,3%) nem osztható posztra: kimarad.
    if (!raw) continue;
    const normalized = normalizePlayerStats(raw);
    // Szerepkör csak az alkalmas mintájú, benchmarkkal rendelkező játékosnál van; a
    // motor a szerepkört csak a PG-hely tartalékválasztásához használja.
    const eligible = isEligibleSample(normalized) && Boolean(playerBenchmarks[normalized.position]);
    rotation.push({
      playerId: row.player_id,
      name: playerNames.get(row.player_id) ?? '',
      position: normalized.position,
      // Az ESPN csak G / F / C jelölést ad: a vödrök (G → PG + SG, F → SF + PF) a két
      // posztot azonos sorokkal és dupla súllyal számolnák a poszt-párharcban. Ezért a
      // statisztikailag illesztett egy poszt az egyetlen vödör.
      positionBuckets: [normalized.position],
      games: row.games_played,
      minutes: row.total_minutes,
      points: row.total_points,
      fga2: row.total_fga - row.total_three_attempted,
      fgm2: row.total_fgm - row.total_three_made,
      fga3: row.total_three_attempted,
      fgm3: row.total_three_made,
      fta: row.total_free_throw_attempted,
      ftm: row.total_free_throw_made,
      oreb: row.total_offensive_rebounds,
      dreb: row.total_defensive_rebounds,
      ast: row.total_assists,
      tov: row.total_turnovers,
      stl: row.total_steals,
      blk: row.total_blocks,
      val: raw.valuation,
      roles: eligible ? analyzePlayerSeason(raw, playerBenchmarks).roleKeys : [],
    });
  }
  return rotation;
}

/**
 * A meccs előtti riport egy szakaszra: a saját csapat és az ellenfél a szakasz azonos
 * meccsszám-küszöböt elérő csapataihoz mérve. A hiányzó adat, a kis minta és a kis
 * pool nem hiba: a nézet erről tájékoztat.
 */
export function scoutStageOpponent(
  stageStats: readonly TeamStageStats[],
  totals: readonly LeaguePlayerTotals[],
  ownTeamId: string,
  opponentTeamId: string,
  seasonType: number,
  lookups: ScoutingLookups,
): ScoutingOutcome {
  const inStage = stageStats.filter(stats => stats.seasonType === seasonType);
  const selected = [ownTeamId, opponentTeamId].map(teamId => ({
    teamId,
    stats: inStage.find(stats => stats.teamId === teamId),
  }));
  const missing = selected.filter(entry => !entry.stats).map(entry => entry.teamId);
  if (missing.length > 0) return { status: 'no-data', teamIds: missing };

  const tooFew = selected
    .map(entry => ({ teamId: entry.teamId, games: entry.stats?.games ?? 0 }))
    .filter(entry => entry.games < MIN_SCOUTING_GAMES);
  if (tooFew.length > 0) return { status: 'small-sample', teams: tooFew };

  const pool = inStage.filter(stats => stats.games >= MIN_SCOUTING_GAMES);
  if (pool.length < MIN_SCOUTING_BENCHMARK_POOL) return { status: 'no-benchmark', teams: pool.length };

  const teamStats = pool.map(stats => toTeamSeasonStat(stats, lookups.teamNames.get(stats.teamId) ?? ''));
  const own = teamStats.find(stats => stats.teamId === ownTeamId);
  const opponent = teamStats.find(stats => stats.teamId === opponentTeamId);
  if (!own || !opponent) return { status: 'no-data', teamIds: [ownTeamId, opponentTeamId] };

  const playerBenchmarks = buildStageBenchmarks(totals, seasonType);
  const ownRotation = buildRotation(totals, playerBenchmarks, ownTeamId, seasonType, lookups.playerNames);
  const opponentRotation = buildRotation(totals, playerBenchmarks, opponentTeamId, seasonType, lookups.playerNames);

  return {
    status: 'ready',
    report: analyzePreGameScouting(opponent, opponentRotation, own, buildTeamBenchmarks(teamStats), ownRotation),
    ownRotation: ownRotation.length,
    opponentRotation: opponentRotation.length,
  };
}
