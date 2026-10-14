// Adapter az NBA sémáról a meccs utáni riport motorjának (lib/postgame-report.ts)
// bemenetére: egy lezárt meccs box score-jából (BoxScoreTeam, csapatsor + játékossorok)
// és a szakasz csapatsorainak összesítőiből (TeamStageStats) állítja elő a csapat meccsét,
// a szezonbeli referenciát (a vizsgált meccs nélkül), a liga-benchmarkot és a játékosok
// meccssorait. A játékosok posztját a játékos-elemző motor adja, a szezon-összegekből.
// A motor így nem ismeri a sémát.

import type { BoxScorePlayer, BoxScoreTeam, BoxScoreTeamTotals } from '@/lib/box-score-data';
import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { PlayerGameStat, PostGameReport, TeamGameStat, TeamSeasonStat } from '@/lib/postgame-report';
import type { TeamStageStats } from '@/lib/team-stats-data';
import { toRawPlayerStat } from '@/lib/adapters/player-analysis-adapter';
import { MIN_TEAM_ANALYSIS_GAMES, MIN_TEAM_BENCHMARK_POOL } from '@/lib/adapters/team-analysis-adapter';
import { normalizePlayerStats } from '@/lib/player-analysis';
import { analyzePostGameReport, buildTeamBenchmarks } from '@/lib/postgame-report';
import { resolvePrimaryPosition } from '@/lib/positions';
import { simpleValuation } from '@/lib/stat-formulas';

/** A benchmark kulcsa: egy szakasz egy „liga”, ezért a motor liga / szezon kulcsa a szakasz. */
const BENCHMARK_LEAGUE = 'NBA';

export type PostgameOutcome =
  | {
      status: 'ready';
      report: PostGameReport;
      /** Volt-e a szakaszban elég csapat a liga-benchmarkhoz (különben csak a szezonátlag a referencia). */
      hasLeagueBenchmark: boolean;
    }
  /** A meccshez nincs csapatsor valamelyik oldalra: a riport nem készíthető. */
  | { status: 'no-team-stats' }
  /** A csapatnak nincs szezon-összesítője a szakaszban (nem várt). */
  | { status: 'no-season-stats' };

export interface PostgameLookups {
  teamName: string;
  opponentName: string;
}

interface SideTotals {
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
  tov: number;
  pf: number;
}

const toSide = (totals: BoxScoreTeamTotals): SideTotals => ({
  points: totals.points,
  fgm: totals.fgMade,
  fga: totals.fgAttempted,
  fg3m: totals.threeMade,
  fg3a: totals.threeAttempted,
  ftm: totals.ftMade,
  fta: totals.ftAttempted,
  oreb: totals.offensiveRebounds,
  dreb: totals.rebounds - totals.offensiveRebounds,
  reb: totals.rebounds,
  ast: totals.assists,
  stl: totals.steals,
  blk: totals.blocks,
  tov: totals.turnovers,
  pf: totals.fouls,
});

const valuationOf = (side: SideTotals) =>
  simpleValuation({
    points: side.points,
    rebounds: side.reb,
    assists: side.ast,
    steals: side.stl,
    blocks: side.blk,
    fgMade: side.fgm,
    fgAttempted: side.fga,
    ftMade: side.ftm,
    ftAttempted: side.fta,
    turnovers: side.tov,
  });

/** Egy meccs csapatsora a motor `TeamGameStat`-jaként. */
function toTeamGameStat(side: SideTotals, teamId: string, name: string, pointsAgainst: number, seasonType: number): TeamGameStat {
  return {
    teamId,
    teamName: name,
    league: BENCHMARK_LEAGUE,
    season: String(seasonType),
    pointsFor: side.points,
    pointsAgainst,
    fga2: side.fga - side.fg3a,
    fgm2: side.fgm - side.fg3m,
    fga3: side.fg3a,
    fgm3: side.fg3m,
    fta: side.fta,
    ftm: side.ftm,
    oreb: side.oreb,
    dreb: side.dreb,
    ast: side.ast,
    tov: side.tov,
    stl: side.stl,
    blk: side.blk,
    fouls: side.pf,
    val: valuationOf(side),
  };
}

/** Szakasz-összesítő → `TeamSeasonStat`; `exclude`: a vizsgált meccs oldalai, amelyeket levonunk. */
function toTeamSeasonStat(
  stats: TeamStageStats,
  name: string,
  seasonType: number,
  exclude?: { own: SideTotals; opponent: SideTotals },
): TeamSeasonStat {
  const sub = (total: number, part: number | undefined) => total - (part ?? 0);
  const own = {
    points: sub(stats.own.points, exclude?.own.points),
    fgm: sub(stats.own.fgm, exclude?.own.fgm),
    fga: sub(stats.own.fga, exclude?.own.fga),
    fg3m: sub(stats.own.fg3m, exclude?.own.fg3m),
    fg3a: sub(stats.own.fg3a, exclude?.own.fg3a),
    ftm: sub(stats.own.ftm, exclude?.own.ftm),
    fta: sub(stats.own.fta, exclude?.own.fta),
    oreb: sub(stats.own.oreb, exclude?.own.oreb),
    dreb: sub(stats.own.dreb, exclude?.own.dreb),
    reb: sub(stats.own.reb, exclude?.own.reb),
    ast: sub(stats.own.ast, exclude?.own.ast),
    stl: sub(stats.own.stl, exclude?.own.stl),
    blk: sub(stats.own.blk, exclude?.own.blk),
    tov: sub(stats.own.tov, exclude?.own.tov),
    pf: sub(stats.own.pf, exclude?.own.pf),
  };
  const opponent = {
    points: sub(stats.opponent.points, exclude?.opponent.points),
    fga: sub(stats.opponent.fga, exclude?.opponent.fga),
    fta: sub(stats.opponent.fta, exclude?.opponent.fta),
    tov: sub(stats.opponent.tov, exclude?.opponent.tov),
    oreb: sub(stats.opponent.oreb, exclude?.opponent.oreb),
    dreb: sub(stats.opponent.dreb, exclude?.opponent.dreb),
  };
  return {
    teamId: stats.teamId,
    teamName: name,
    league: BENCHMARK_LEAGUE,
    season: String(seasonType),
    games: stats.games - (exclude ? 1 : 0),
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
    val: valuationOf(own),
    oppDreb: opponent.dreb,
    oppPossessions: Math.max(opponent.fga + 0.44 * opponent.fta + opponent.tov - opponent.oreb, 0),
  };
}

/** A pályára lépett játékos meccssora; a posztot a szezon-összegekből illesztett poszt adja. */
function toPlayerGameStat(
  player: BoxScorePlayer,
  teamId: string,
  seasonType: number,
  totals: readonly LeaguePlayerTotals[],
): PlayerGameStat {
  const seasonRow = totals.find(
    row => row.player_id === player.playerId && row.team_id === teamId && row.season_type === seasonType,
  );
  const raw = seasonRow ? toRawPlayerStat(seasonRow) : null;
  // A dobásbontás nélküli sor nem osztható posztra: az ESPN G / F / C jelöléséből jön az első illeszkedő poszt.
  const position = raw ? normalizePlayerStats(raw).position : resolvePrimaryPosition(player.position);
  return {
    playerId: player.playerId,
    name: player.name,
    position,
    isStarter: player.starter,
    minutes: player.minutes,
    points: player.points,
    fga2: player.fgAttempted - player.threeAttempted,
    fgm2: player.fgMade - player.threeMade,
    fga3: player.threeAttempted,
    fgm3: player.threeMade,
    fta: player.ftAttempted,
    ftm: player.ftMade,
    oreb: player.offensiveRebounds,
    dreb: player.rebounds - player.offensiveRebounds,
    ast: player.assists,
    tov: player.turnovers,
    stl: player.steals,
    blk: player.blocks,
    val: player.valuation,
    roles: [],
  };
}

/**
 * A meccs utáni riport a `teamId` csapat nézőpontjából egy lezárt meccsre. A szezonbeli
 * referencia a szakasz összesítője a vizsgált meccs nélkül (különben a meccs önmagához
 * mérné magát); kis mintánál (< 3 meccs) a motor a liga mediánra vált. A liga-benchmark a
 * szakasz legalább 10 meccset játszott csapataiból áll (min. 8 csapat); híján a riport csak
 * a szezonátlaghoz mér.
 */
export function buildGameReport(
  boxScore: readonly BoxScoreTeam[],
  stageStats: readonly TeamStageStats[],
  totals: readonly LeaguePlayerTotals[],
  teamId: string,
  opponentTeamId: string,
  seasonType: number,
  lookups: PostgameLookups,
): PostgameOutcome {
  const own = boxScore.find(side => side.teamId === teamId);
  const other = boxScore.find(side => side.teamId === opponentTeamId);
  if (!own?.totals || !other?.totals) return { status: 'no-team-stats' };

  const ownSide = toSide(own.totals);
  const opponentSide = toSide(other.totals);
  const inStage = stageStats.filter(stats => stats.seasonType === seasonType);
  const ownStage = inStage.find(stats => stats.teamId === teamId);
  if (!ownStage) return { status: 'no-season-stats' };

  const teamSeason = toTeamSeasonStat(ownStage, lookups.teamName, seasonType, { own: ownSide, opponent: opponentSide });
  const pool = inStage.filter(stats => stats.games >= MIN_TEAM_ANALYSIS_GAMES);
  const hasLeagueBenchmark = pool.length >= MIN_TEAM_BENCHMARK_POOL;
  const benchmarks = hasLeagueBenchmark
    ? buildTeamBenchmarks(pool.map(stats => toTeamSeasonStat(stats, '', seasonType)))
    : {};

  // A pályára lépett játékosok a motor számára.
  const players = own.players.map(player => toPlayerGameStat(player, teamId, seasonType, totals));

  const report = analyzePostGameReport(
    toTeamGameStat(ownSide, teamId, lookups.teamName, opponentSide.points, seasonType),
    toTeamGameStat(opponentSide, opponentTeamId, lookups.opponentName, ownSide.points, seasonType),
    teamSeason,
    benchmarks,
    players,
  );
  return { status: 'ready', report, hasLeagueBenchmark };
}
