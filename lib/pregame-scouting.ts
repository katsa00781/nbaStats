// A meccs előtti scouting motor: az ASEStats `pregame-scouting` portja. Tiszta függvények,
// a sémát nem ismerik; a bemenetet az adapter (lib/adapters/pregame-adapter.ts) állítja
// elő. A riport a saját csapat nézőpontjából készül: az ellenfél profilja, a poszt-
// párharcok, a nyerési esély, a kulcsfaktorok és a forgatókönyvek. A benchmark egy
// szakasz (alapszakasz / play-in / rájátszás) csapataiból épül, P10–P90 skálán.
//
// Eltérések az ASEStatstől:
//  - a csapatmutatók a Csapatstatisztika definícióit követik (T14, T17): a tempó közös
//    birtoklásszámból és 48 percre vetítve, Oliver-féle TO%, FT-mutató = FTM / FGA
//    (a kanonikus képletek a lib/stat-formulas.ts-ből, T22);
//  - nincs magasság (az ESPN-adat nem tartalmazza): a `heightCm` mindig hiányzik;
//  - a dobásprofil (`shotProfiles`) és a sérülés-kontextus (`injuryContext`) a motorban
//    megvan, de az adapter még nem tölti: külön egység;
//  - a szezon és a liga kulcs az adapterben a szakasz azonosítója (egy benchmark / szakasz).

import { parsePositionBuckets, type Position } from '@/lib/positions';
import { freeThrowRate, turnoverPct } from '@/lib/stat-formulas';
import { DEFENSE_STYLE_LABELS, OFFENSE_STYLE_LABELS, finalizeDefenseStyle, finalizeOffenseStyle } from '@/lib/style-vocabulary';
export type { Position };

export type TeamSeasonStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
  games: number;
  /** Összes játékperc (48 meccsenként + 5 hosszabbításonként): a tempó 48 percre vetítéséhez. Hiányában meccsenkénti birtoklás. */
  gameMinutes?: number;
  pointsFor: number;
  pointsAgainst: number;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  fouls: number;
  val: number;
  opponent?: {
    fga2: number;
    fgm2: number;
    fga3: number;
    fgm3: number;
    fta: number;
    ftm: number;
    oreb: number;
    dreb: number;
    tov: number;
  };
};

export type PlayerSeasonStat = {
  playerId: string;
  name: string;
  position: Position;
  positionLabel?: string;
  positionBuckets?: Position[];
  heightCm?: number;
  games: number;
  minutes: number;
  points: number;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  val: number;
  roles: string[];
};

export type ShotZoneKey = 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3';

export type ShotZoneStats = {
  attempts: number;
  made: number;
  pct: number;
};

export type ShotProfileSummary = {
  attempts: number;
  made: number;
  fgPct: number;
  zoneStats: Record<ShotZoneKey, ShotZoneStats>;
};

export type BenchmarkPercentiles = {
  P10: number;
  P25: number;
  P40: number;
  P50: number;
  P60: number;
  P75: number;
  P90: number;
};

export type TeamBenchmarks = Record<string, BenchmarkPercentiles>;

export type LeagueTeamBenchmarks = Record<
  string,
  Record<string, TeamBenchmarks>
>;

export type PositionComparison = {
  position: Position;
  ownValPer36: number;
  oppValPer36: number;
  ownPointsPer36: number;
  oppPointsPer36: number;
  deltaValPer36: number;
  matchupFlag?: 'critical_disadvantage' | 'clear_advantage';
};

export type ScoutingReportLLMContext = {
  opponentTempoDescriptor: string;
  ownTempoDescriptor: string;
  opponentDominantAxis: 'transition' | 'periméter' | 'festék';
  tempoControlNote?: string;
  matchupRealizationNote?: string;
  riskNote?: string;
  varianceDrivers: string[];
  positionDeltaSummary: {
    perimeterDelta: number;
    frontcourtDelta: number;
  };
  significantMatchups: Array<{
    position: Position;
    deltaValPer36: number;
    matchupFlag?: PositionComparison['matchupFlag'];
  }>;
  confidenceReasons?: string[];
  shotProfileNotes?: string[];
  shotDefenseNotes?: string[];
};

export type AdvancedPlayerStat = {
  playerId: string;
  name: string;
  position: Position;
  minutes: number;
  minutesPerGame: number;
  valPer36: number;
  pointsPer36: number;
  proxyPer: number;
  proxyWinShare: number;
};

export type AdvancedPlayerEligibility = {
  minTotalMinutes: number;
  minMinutesPerGame: number;
  minEligibleGames: number;
};

export type XFactorImpact = {
  primaryDeltaPct: number;
  secondaryDeltaPct: number;
  combinedDeltaPct: number;
};

export type ScenarioOutcome = {
  key: string;
  label: string;
  ownPct: number;
  opponentPct: number;
  deltaVsBase: number;
  note: string;
};

export type RiskScenario = {
  title: string;
  trigger: string;
  instantResponse: string;
  estimatedOwnSwingPct: number;
};

export type FanSummary = {
  headline: string;
  keyEdges: string[];
  majorRisks: string[];
  gamePlan: string[];
  fallbackPlan: string[];
};

export type CalibrationDimension = {
  key: string;
  label: string;
  score: number;
  note: string;
  context?: string;
};

export type CalibrationDiagnostics = {
  overallIntensity: number;
  scaleLabel?: string;
  summary?: string;
  dimensions: CalibrationDimension[];
};

type KeyPlayerGroups = {
  primaryScorers: string[];
  primaryPlaymakers: string[];
  stretchThreats: string[];
  mismatchCandidates: string[];
};

export type ScoutingReport = {
  ownTeamId: string;
  ownTeamName: string;
  opponentTeamId: string;
  opponentTeamName: string;
  league: string;
  season: string;
  winProbability: {
    ownPct: number;
    opponentPct: number;
    predictedWinner: 'own' | 'opponent' | 'even';
    confidence: 'Low' | 'Medium' | 'High';
    confidenceReasons: string[];
  };
  positionComparison: PositionComparison[];
  profile: {
    tempo: string;
    offense: string[];
    defense: string[];
  };
  ownTeamProfile?: {
    tempo: string;
    offense: string[];
    defense: string[];
  };
  threats: string[];
  vulnerabilities: string[];
  keyPlayers: KeyPlayerGroups;
  ownKeyPlayers: KeyPlayerGroups;
  focusPoints: string[];
  xFactorContext?: PreGameXFactorContext;
  xFactorImpact?: XFactorImpact;
  scenarioOutcomes?: ScenarioOutcome[];
  riskScenarios?: RiskScenario[];
  fanSummary?: FanSummary;
  calibrationDiagnostics?: CalibrationDiagnostics;
  advancedPlayers?: {
    own: AdvancedPlayerStat[];
    opponent: AdvancedPlayerStat[];
  };
  advancedPlayersEligibility?: {
    own: AdvancedPlayerEligibility;
    opponent: AdvancedPlayerEligibility;
  };
  riskFlags?: string[];
  injuryContext?: {
    own: string[];
    opponent: string[];
  };
  positionComparisonNote?: string;
  llmContext?: ScoutingReportLLMContext;
  shotProfileContext?: {
    ownZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    opponentZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    ownAllowedZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    opponentAllowedZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    ownTopZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    opponentTopZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    ownDefensePressureZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    opponentDefensePressureZones: Array<{ label: string; rate: number; pct: number; rateDeltaVsLeague: number; pctDeltaVsLeague: number }>;
    clashZones: string[];
    notes: string[];
    defenseNotes: string[];
  };
  teamStats?: {
    own: { pace: number; efg: number; threeRate: number; threePct: number; turnoverRate: number; ftRate: number; orebRate: number; assistRate: number };
    opponent: { pace: number; efg: number; threeRate: number; threePct: number; turnoverRate: number; ftRate: number; orebRate: number; assistRate: number };
  };
  summary: string;
};

type XFactorCandidate = {
  key: string;
  label: string;
  short: string;
};

type XFactorInsight = {
  primary: XFactorCandidate;
  secondary: XFactorCandidate;
};

export type PreGameXFactorContext = {
  primaryKey: string;
  secondaryKey?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDeltaPct?: number;
  secondaryDeltaPct?: number;
  combinedDeltaPct?: number;
  riskFlags?: string[];
};

const REGULATION_MINUTES = 48;

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const zScore = (value: number, pool: number[]) => {
  const mean = average(pool);
  const sd = stdDev(pool);
  if (!Number.isFinite(value) || !Number.isFinite(sd) || sd <= 0.0001) return 0;
  return (value - mean) / sd;
};

export const POSITION_LABELS: Record<Position, string> = {
  PG: 'irányító',
  SG: 'dobóhátvéd',
  SF: 'kiscsatár',
  PF: 'erőcsatár',
  C: 'center',
};

// Magyar határozott névelő: magánhangzóval kezdődő szó előtt „az”, különben „a”.
const withArticle = (word: string) => `${/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'} ${word}`;

const SHOT_ZONE_LABELS: Record<ShotZoneKey, string> = {
  rim: 'Gyűrű',
  paint: 'Festék',
  mid: 'Középtáv',
  corner3: 'Sarok tripla',
  aboveBreak3: 'Egyéb tripla',
};

const BALL_HANDLER_ROLE_HINTS = new Set<string>([
  'Primary Ball Handler',
  'Secondary Creator',
  'Secondary Playmaker',
  'Offensive Hub',
]);

const getPlayerPositionBuckets = (player: PlayerSeasonStat): Position[] => {
  if (player.positionBuckets?.length) return player.positionBuckets;
  const parsedLabel = parsePositionBuckets(player.positionLabel);
  if (parsedLabel.length > 0) return parsedLabel;
  const fallback = parsePositionBuckets(player.position);
  if (fallback.length > 0) return fallback;
  return player.position ? [player.position] : [];
};

const playerMatchesPosition = (player: PlayerSeasonStat, position: Position) =>
  getPlayerPositionBuckets(player).includes(position);

const playerMatchesAnyPosition = (player: PlayerSeasonStat, positions: Position[]) =>
  positions.some(pos => playerMatchesPosition(player, pos));

// Ensures PG slot stats fall back to combo guards if no natural point guard logged minutes.
const selectPlayersForPosition = (players: PlayerSeasonStat[], position: Position) => {
  const primaryMatches = players.filter(player => playerMatchesPosition(player, position));
  if (position !== 'PG') return primaryMatches;
  if (primaryMatches.length > 0) return primaryMatches;

  const comboGuards = players.filter(player => {
    const guardSlot = playerMatchesAnyPosition(player, ['PG', 'SG']);
    const handlesBall = (player.roles ?? []).some(role => BALL_HANDLER_ROLE_HINTS.has(role));
    return guardSlot && handlesBall;
  });
  if (comboGuards.length > 0) return comboGuards;

  return players.filter(player => playerMatchesPosition(player, 'SG'));
};

const CRITICAL_MATCHUP_DELTA = -12;
const CLEAR_ADVANTAGE_DELTA = 12;
const SIGNIFICANT_MATCHUP_DELTA = 10;
const POSITION_MATCHUP_WEIGHTS: Record<string, number> = {
  PG: 0.25, SG: 0.15, SF: 0.15, PF: 0.20, C: 0.25,
};
const MATCHUP_PROB_SCALE = 10;
const MATCHUP_PROB_CAP = 15;

type TempoBand = 'high' | 'medium' | 'low';

type TeamStyleProfile = {
  tempo: string;
  offense: string[];
  defense: string[];
};

const getTempoScore = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) =>
  getPercentileScore(benchmarks, team, 'pace');

const getTempoBand = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks): TempoBand => {
  const paceScore = getTempoScore(team, benchmarks);
  if (paceScore >= 65) return 'high';
  if (paceScore <= 35) return 'low';
  return 'medium';
};

const describeTempo = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const paceScore = getTempoScore(team, benchmarks);
  if (paceScore >= 85) return 'rendkívül gyors tempójú';
  if (paceScore >= 65) return 'gyors tempójú';
  if (paceScore <= 15) return 'rendkívül lassú tempójú';
  if (paceScore <= 35) return 'lassú tempójú';
  return 'közepes tempójú';
};

const getTempoLevelLabel = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const tempoBand = getTempoBand(team, benchmarks);
  if (tempoBand === 'high') return 'Magas';
  if (tempoBand === 'low') return 'Alacsony';
  return 'Közepes';
};

const finalizeTeamProfile = (
  tempo: string,
  style: ReturnType<typeof buildTeamStyle>,
  options?: { defensiveDataLimited?: boolean }
): TeamStyleProfile => ({
  tempo,
  offense: finalizeOffenseStyle(style.offense),
  defense: finalizeDefenseStyle(style.defense, options?.defensiveDataLimited),
});

const summarizePositionDeltas = (positionComparison: PositionComparison[]) => {
  const perimeterDelta = positionComparison
    .filter(item => ['PG', 'SG', 'SF'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const frontcourtDelta = positionComparison
    .filter(item => ['PF', 'C'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  return { perimeterDelta, frontcourtDelta };
};

const buildVarianceDrivers = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  riskFlags: string[] = []
) => {
  const drivers: string[] = [];
  const tripleVariance =
    scoreAbove(benchmarks, opponent, 'three_rate', 60) ||
    scoreAbove(benchmarks, opponent, 'three_pct', 60) ||
    scoreAbove(benchmarks, ownTeam, 'three_rate', 60) ||
    scoreAbove(benchmarks, ownTeam, 'three_pct', 60);
  if (tripleVariance) drivers.push('tripla-variancia');

  const ftVariance =
    scoreAbove(benchmarks, opponent, 'ft_rate', 60) ||
    scoreAbove(benchmarks, ownTeam, 'ft_rate', 60) ||
    riskFlags.some(flag => {
      const lowered = flag.toLowerCase();
      return (
        lowered.includes('fault') ||
        lowered.includes('ft-rate') ||
        lowered.includes('büntető') ||
        lowered.includes('bünteto')
      );
    });
  if (ftVariance) drivers.push('büntetőarány / faultterhelés');

  return drivers;
};

const buildSignificantMatchups = (positionComparison: PositionComparison[]) =>
  positionComparison
    .filter(item => Math.abs(item.deltaValPer36) >= SIGNIFICANT_MATCHUP_DELTA)
    .map(item => ({
      position: item.position,
      deltaValPer36: item.deltaValPer36,
      matchupFlag: item.matchupFlag,
    }));


const quantile = (sorted: number[], percentile: number) => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * percentile;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const getStatValue = (team: NormalizedTeamStats, stat: string) => {
  switch (stat) {
    case 'pace':
      return team.pace;
    case 'assist_rate':
      return team.assistRate;
    case 'turnover_rate':
      return team.turnoverRate;
    case 'oreb_rate':
      return team.orebRate;
    case 'two_rate':
      return team.twoRate;
    case 'three_rate':
      return team.threeRate;
    case 'three_pct':
      return team.threePct;
    case 'ft_rate':
      return team.ftRate;
    case 'efg':
      return team.efg;
    case 'val_per_game':
      return team.valPerGame;
    case 'stl_per_game':
      return team.games > 0 ? team.stl / team.games : 0;
    case 'blk_per_game':
      return team.games > 0 ? team.blk / team.games : 0;
    case 'fouls_per_game':
      return team.games > 0 ? team.fouls / team.games : 0;
    default:
      return 0;
  }
};

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number; // per game
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
  valPerGame: number;
};

export const normalizeTeamStats = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const opponent = raw.opponent ?? {
    fga2: 0,
    fgm2: 0,
    fga3: 0,
    fgm3: 0,
    fta: 0,
    ftm: 0,
    oreb: 0,
    dreb: 0,
    tov: 0,
  };
  const computePossessions = (
    fga2: number,
    fga3: number,
    fta: number,
    oreb: number,
    tov: number
  ) => {
    const totalFga = fga2 + fga3;
    const attempts = totalFga + 0.44 * fta + tov;
    const possessions = attempts - oreb;
    return Math.max(possessions, 0);
  };

  const teamPossessions = computePossessions(raw.fga2, raw.fga3, raw.fta, raw.oreb, raw.tov);
  const opponentPossessions = computePossessions(
    opponent.fga2,
    opponent.fga3,
    opponent.fta,
    opponent.oreb,
    opponent.tov
  );
  const teamPossessionsPerGame = games > 0 ? teamPossessions / games : 0;
  const opponentPossessionsPerGame = games > 0 ? opponentPossessions / games : 0;
  const minutesPerGame = raw.gameMinutes && raw.gameMinutes > 0 ? raw.gameMinutes / games : REGULATION_MINUTES;
  const pace = Math.max(((teamPossessionsPerGame + opponentPossessionsPerGame) / 2) * (REGULATION_MINUTES / minutesPerGame), 0);
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  // Oliver-féle TO% (T14): TOV / (FGA + 0,44·FTA + TOV), arányként.
  const turnoverRate = turnoverPct(raw.tov, fga, raw.fta) / 100;
  const orebRate = (raw.oreb + opponent.dreb) > 0 ? raw.oreb / (raw.oreb + opponent.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  // FT-mutató = FTM / FGA (T17).
  const ftRate = freeThrowRate(raw.ftm, fga);
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;
  const valPerGame = raw.val / games;

  return {
    ...raw,
    fga,
    fgm,
    pace: round(pace, 2),
    assistRate: round(assistRate, 3),
    turnoverRate: round(turnoverRate, 3),
    orebRate: round(orebRate, 3),
    twoRate: round(twoRate, 3),
    threeRate: round(threeRate, 3),
    threePct: round(threePct, 1),
    ftRate: round(ftRate, 3),
    efg: round(efg, 1),
    valPerGame: round(valPerGame, 1),
  };
};

const TEAM_STAT_KEYS = [
  'pace',
  'assist_rate',
  'turnover_rate',
  'oreb_rate',
  'two_rate',
  'three_rate',
  'three_pct',
  'ft_rate',
  'efg',
  'val_per_game',
  'stl_per_game',
  'blk_per_game',
  'fouls_per_game',
];

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): LeagueTeamBenchmarks => {
  const normalized = teams.map(normalizeTeamStats);
  const result: LeagueTeamBenchmarks = {};

  normalized.forEach(team => {
    if (!result[team.league]) result[team.league] = {};
    if (!result[team.league][team.season]) result[team.league][team.season] = {};
  });

  Object.keys(result).forEach(league => {
    Object.keys(result[league]).forEach(season => {
      const pool = normalized.filter(t => t.league === league && t.season === season);
      const statBenchmarks: TeamBenchmarks = {};
      TEAM_STAT_KEYS.forEach(stat => {
        const values = pool
          .map(team => getStatValue(team, stat))
          .filter(v => Number.isFinite(v))
          .sort((a, b) => a - b);
        statBenchmarks[stat] = {
          P10: round(quantile(values, 0.1), 3),
          P25: round(quantile(values, 0.25), 3),
          P40: round(quantile(values, 0.4), 3),
          P50: round(quantile(values, 0.5), 3),
          P60: round(quantile(values, 0.6), 3),
          P75: round(quantile(values, 0.75), 3),
          P90: round(quantile(values, 0.9), 3),
        };
      });
      result[league][season] = statBenchmarks;
    });
  });

  return result;
};

const getBenchmarkThreshold = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  pct: keyof BenchmarkPercentiles
) => {
  return benchmarks[team.league]?.[team.season]?.[stat]?.[pct] ?? 0;
};

// Returns 0–100 via linear interpolation between P10 and P90.
// A score of 50 means halfway between the 10th and 90th percentile, not the median.
const getPercentileScore = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string
) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  const value = getStatValue(team, stat);
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const scoreAbove = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) >= score;

const scoreBelow = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) <= score;

const getDominantAxis = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');
  const perimeterScore = Math.max(threeRateScore, round(threeRateScore * 0.7 + threePctScore * 0.3, 1));
  const paintScore = Math.max(twoRateScore, round(twoRateScore * 0.75 + ftRateScore * 0.25, 1));

  if (paceScore >= 75 && paceScore >= perimeterScore + 8 && paceScore >= paintScore + 8) return 'transition';
  if (perimeterScore >= 58 && perimeterScore >= paintScore + 3) return 'periméter';
  if (paintScore >= 60 && paintScore >= perimeterScore + 3) return 'festék';

  const maxScore = Math.max(paceScore, perimeterScore, paintScore);
  if (maxScore === paceScore) return 'transition';
  if (maxScore === perimeterScore) return 'periméter';
  return 'festék';
};

const buildTeamStyle = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const offense: string[] = [];
  const defense: string[] = [];
  const tempoBand = getTempoBand(team, benchmarks);
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');

  if (tempoBand === 'high') offense.push(OFFENSE_STYLE_LABELS.transition);
  if (tempoBand === 'low' && assistScore >= 60) {
    offense.push(OFFENSE_STYLE_LABELS.halfcourt);
  }
  if ((threeRateScore >= 60 && threePctScore >= 60) || threeRateScore >= 70) {
    offense.push(OFFENSE_STYLE_LABELS.perimeter);
  }
  if (
    twoRateScore >= 70
    && ftRateScore >= 60
    && threeRateScore <= 45
  ) {
    offense.push(OFFENSE_STYLE_LABELS.interior);
  }

  if (offense.length === 0) {
    if (threeRateScore >= 58) {
      offense.push(OFFENSE_STYLE_LABELS.perimeter);
    } else if (paceScore <= 40 && assistScore >= 50) {
      offense.push(OFFENSE_STYLE_LABELS.halfcourt);
    } else if (twoRateScore >= 60 || ftRateScore >= 60) {
      offense.push(OFFENSE_STYLE_LABELS.interior);
    }
  }

  if (scoreAbove(benchmarks, team, 'stl_per_game', 60)) defense.push(DEFENSE_STYLE_LABELS.pressure);
  if (scoreAbove(benchmarks, team, 'blk_per_game', 60)) defense.push(DEFENSE_STYLE_LABELS.rim);
  if (scoreBelow(benchmarks, team, 'fouls_per_game', 40)) defense.push(DEFENSE_STYLE_LABELS.disciplined);

  return { offense, defense };
};

const computePlayerUsage = (player: PlayerSeasonStat) => {
  const fga = player.fga2 + player.fga3;
  const possessionsUsed = fga + 0.44 * player.fta + player.tov;
  return player.games > 0 ? possessionsUsed / player.games : 0;
};

const buildShotProfileContext = (
  ownShotProfile?: ShotProfileSummary | null,
  opponentShotProfile?: ShotProfileSummary | null,
  leagueShotProfile?: ShotProfileSummary | null,
  ownAllowedShotProfile?: ShotProfileSummary | null,
  opponentAllowedShotProfile?: ShotProfileSummary | null
) => {
  if (!ownShotProfile || !opponentShotProfile || !leagueShotProfile) return undefined;

  const summarize = (profile: ShotProfileSummary) => {
    const totalAttempts = Math.max(profile.attempts, 1);
    const leagueTotalAttempts = Math.max(leagueShotProfile.attempts, 1);

    return (Object.keys(profile.zoneStats) as ShotZoneKey[])
      .map(zone => {
        const attempts = profile.zoneStats[zone].attempts;
        const rate = (attempts / totalAttempts) * 100;
        const pct = profile.zoneStats[zone].pct;
        const leagueRate = (leagueShotProfile.zoneStats[zone].attempts / leagueTotalAttempts) * 100;
        const leaguePct = leagueShotProfile.zoneStats[zone].pct;

        return {
          key: zone,
          label: SHOT_ZONE_LABELS[zone],
          attempts,
          rate: round(rate, 1),
          pct: round(pct, 1),
          rateDeltaVsLeague: round(rate - leagueRate, 1),
          pctDeltaVsLeague: round(pct - leaguePct, 1),
        };
      })
      .sort((a, b) => {
        const aScore = a.rateDeltaVsLeague * 0.7 + a.pctDeltaVsLeague * 0.3;
        const bScore = b.rateDeltaVsLeague * 0.7 + b.pctDeltaVsLeague * 0.3;
        return bScore - aScore;
      });
  };

  const ownZones = summarize(ownShotProfile);
  const opponentZones = summarize(opponentShotProfile);
  const ownAllowedZones = ownAllowedShotProfile ? summarize(ownAllowedShotProfile) : [];
  const opponentAllowedZones = opponentAllowedShotProfile ? summarize(opponentAllowedShotProfile) : [];
  const ownTopZones = ownZones.filter(zone => zone.attempts >= 12).slice(0, 2);
  const opponentTopZones = opponentZones.filter(zone => zone.attempts >= 12).slice(0, 2);
  const ownDefensePressureZones = ownAllowedZones
    .filter(zone => zone.attempts >= 12)
    .sort((a, b) => a.rateDeltaVsLeague - b.rateDeltaVsLeague || a.pctDeltaVsLeague - b.pctDeltaVsLeague)
    .slice(0, 2);
  const opponentDefensePressureZones = opponentAllowedZones
    .filter(zone => zone.attempts >= 12)
    .sort((a, b) => a.rateDeltaVsLeague - b.rateDeltaVsLeague || a.pctDeltaVsLeague - b.pctDeltaVsLeague)
    .slice(0, 2);
  const clashZones = ownTopZones
    .map(zone => zone.label)
    .filter(label => opponentTopZones.some(item => item.label === label));

  const notes: string[] = [];
  const defenseNotes: string[] = [];
  const ownBestEfficiency = ownZones.find(zone => zone.pctDeltaVsLeague >= 2 && zone.attempts >= 10) || null;
  const opponentBestEfficiency = opponentZones.find(zone => zone.pctDeltaVsLeague >= 2 && zone.attempts >= 10) || null;

  if (ownBestEfficiency) {
    notes.push(`${ownBestEfficiency.label}: saját támadó zónaelőny (${ownBestEfficiency.pctDeltaVsLeague >= 0 ? '+' : ''}${ownBestEfficiency.pctDeltaVsLeague.toFixed(1)} pp liga fölött).`);
  }
  if (opponentBestEfficiency) {
    notes.push(`${opponentBestEfficiency.label}: ellenfél elsődleges hatékony zónája (${opponentBestEfficiency.pctDeltaVsLeague >= 0 ? '+' : ''}${opponentBestEfficiency.pctDeltaVsLeague.toFixed(1)} pp liga fölött).`);
  }
  if (clashZones.length > 0) {
    notes.push(`Zónaütközés: mindkét csapat hangsúlyosan támadja a következő területeket: ${clashZones.join(', ')}.`);
  }
  if (clashZones.includes('Gyűrű')) {
    defenseNotes.push('Gyűrű-zónaütközés: a mérkőzés gerince a festékharc lehet, ezért help-védekezés és korai visszarendeződés is kritikus.');
  }
  if (clashZones.includes('Sarok tripla') || clashZones.includes('Egyéb tripla')) {
    defenseNotes.push('Periméter-zónaütközés: a closeout-fegyelem és a tiszta triplahelyzetek limitálása közvetlenül swingeli a varianciát.');
  }

  const ownBestAttackVsOpponentDefense = ownZones
    .map(zone => {
      const opponentAllowed = opponentAllowedZones.find(item => item.label === zone.label);
      if (!opponentAllowed) return null;
      return {
        ...zone,
        edge: round(zone.pctDeltaVsLeague - opponentAllowed.pctDeltaVsLeague, 1),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.edge - a.edge)[0] || null;

  const opponentBestAttackVsOwnDefense = opponentZones
    .map(zone => {
      const ownAllowed = ownAllowedZones.find(item => item.label === zone.label);
      if (!ownAllowed) return null;
      return {
        ...zone,
        edge: round(zone.pctDeltaVsLeague - ownAllowed.pctDeltaVsLeague, 1),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.edge - a.edge)[0] || null;

  if (ownBestAttackVsOpponentDefense && ownBestAttackVsOpponentDefense.edge >= 2) {
    defenseNotes.push(`${ownBestAttackVsOpponentDefense.label}: saját támadás kedvező zóna-matchup az ellenfél engedett profiljához képest.`);
  }
  if (opponentBestAttackVsOwnDefense && opponentBestAttackVsOwnDefense.edge >= 2) {
    defenseNotes.push(`${opponentBestAttackVsOwnDefense.label}: ellenfél támadási matchup-fenyegetés a saját engedett profilhoz mérten.`);
  }

  return {
    ownZones,
    opponentZones,
    ownAllowedZones,
    opponentAllowedZones,
    ownTopZones,
    opponentTopZones,
    ownDefensePressureZones,
    opponentDefensePressureZones,
    clashZones,
    notes: notes.slice(0, 3),
    defenseNotes: defenseNotes.slice(0, 3),
  };
};

const computeProxyPer = (player: PlayerSeasonStat) => {
  const minutes = Math.max(player.minutes || 0, 1);
  const pointsPer36 = (player.points / minutes) * 36;
  const astPer36 = (player.ast / minutes) * 36;
  const stlPer36 = (player.stl / minutes) * 36;
  const blkPer36 = (player.blk / minutes) * 36;
  const tovPer36 = (player.tov / minutes) * 36;
  const score =
    pointsPer36 * 0.35 +
    astPer36 * 0.22 +
    stlPer36 * 0.26 +
    blkPer36 * 0.17 -
    tovPer36 * 0.20;
  return round(Math.max(score, 0), 1);
};

const computeProxyWinShare = (
  player: PlayerSeasonStat,
  teamTotalVal: number,
  teamGames: number,
  teamWinProbPct: number
) => {
  const valueShare = teamTotalVal > 0 ? player.val / teamTotalVal : 0;
  const efficiencyBoost = player.games > 0 ? clamp((player.val / player.games) / 18, 0.5, 1.5) : 1;
  const expectedWins = (teamGames || 1) * (teamWinProbPct / 100);
  return round(valueShare * expectedWins * efficiencyBoost, 2);
};

const getAdvancedEligibility = (teamGames: number): AdvancedPlayerEligibility => {
  const safeTeamGames = Math.max(Math.round(teamGames || 0), 6);
  const minEligibleGames = clamp(Math.round(safeTeamGames * 0.2), 3, 8);
  const minMinutesPerGame = safeTeamGames >= 24 ? 10 : safeTeamGames >= 14 ? 9 : 8;
  const minTotalMinutes = minEligibleGames * minMinutesPerGame;
  return {
    minTotalMinutes,
    minMinutesPerGame,
    minEligibleGames,
  };
};

const getAdvancedFallbackEligibility = (eligibility: AdvancedPlayerEligibility): AdvancedPlayerEligibility => ({
  minTotalMinutes: Math.max(45, Math.round(eligibility.minTotalMinutes * 0.7)),
  minMinutesPerGame: Math.max(6, round(eligibility.minMinutesPerGame * 0.75, 1)),
  minEligibleGames: Math.max(2, Math.round(eligibility.minEligibleGames * 0.75)),
});

const buildAdvancedPlayers = (
  players: PlayerSeasonStat[],
  teamGames: number,
  teamWinProbPct: number
): AdvancedPlayerStat[] => {
  const teamTotalVal = players.reduce((sum, player) => sum + (player.val || 0), 0) || 1;
  const withMinutes = players
    .filter(player => (player.minutes || 0) > 0)
    .map(player => {
      const minutes = player.minutes || 0;
      const games = Math.max(player.games || 0, 1);
      const minutesPerGame = minutes / games;
      return {
        ...player,
        minutes,
        minutesPerGame,
      };
    });

  const eligibility = getAdvancedEligibility(teamGames);
  const fallbackEligibility = getAdvancedFallbackEligibility(eligibility);

  const eligible = withMinutes.filter(player => {
    const games = Math.max(player.games || 0, 1);
    return (
      player.minutes >= eligibility.minTotalMinutes &&
      player.minutesPerGame >= eligibility.minMinutesPerGame &&
      games >= eligibility.minEligibleGames
    );
  });

  const filteredPool = eligible.length >= 3
    ? eligible
    : withMinutes.filter(player => {
      const games = Math.max(player.games || 0, 1);
      return (
        player.minutes >= fallbackEligibility.minTotalMinutes &&
        player.minutesPerGame >= fallbackEligibility.minMinutesPerGame &&
        games >= fallbackEligibility.minEligibleGames
      );
    });

  return filteredPool
    .map(player => {
      const minutes = Math.max(player.minutes || 0, 1);
      const valPer36 = (player.val / minutes) * 36;
      const pointsPer36 = (player.points / minutes) * 36;
      return {
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        minutes: round(minutes, 1),
        minutesPerGame: round(player.minutesPerGame, 1),
        valPer36: round(valPer36, 1),
        pointsPer36: round(pointsPer36, 1),
        proxyPer: computeProxyPer(player),
        proxyWinShare: computeProxyWinShare(player, teamTotalVal, teamGames, teamWinProbPct),
      };
    })
    .sort((a, b) => b.proxyPer - a.proxyPer)
    .slice(0, 5);
};

const computeUsageConcentration = (players: PlayerSeasonStat[]) => {
  const usage = players.map(computePlayerUsage).filter(v => Number.isFinite(v)).sort((a, b) => b - a);
  const total = usage.reduce((sum, v) => sum + v, 0) || 1;
  const top2 = usage.slice(0, 2).reduce((sum, v) => sum + v, 0);
  return round(top2 / total, 3);
};

const buildPositionComparison = (ownPlayers: PlayerSeasonStat[], opponentPlayers: PlayerSeasonStat[]) => {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  const allocationWeightForPosition = (player: PlayerSeasonStat, target: Position) => {
    const buckets = getPlayerPositionBuckets(player).filter(pos => positions.includes(pos));
    if (buckets.length === 0) return 0;
    if (buckets.includes(target)) return 1 / buckets.length;
    // Borrowed combo-guard fallback to PG should not be fully duplicated in SG totals.
    if (target === 'PG' && buckets.includes('SG')) return 0.5;
    return 0;
  };

  const aggregate = (players: PlayerSeasonStat[], position: Position) => {
    const bucket = selectPlayersForPosition(players, position);
    return bucket
      .reduce(
        (acc, player) => {
          const weight = allocationWeightForPosition(player, position);
          if (weight <= 0) return acc;
          acc.games += (player.games || 0) * weight;
          acc.minutes += (player.minutes || 0) * weight;
          acc.val += (player.val || 0) * weight;
          acc.points += (player.points || 0) * weight;
          return acc;
        },
        { games: 0, minutes: 0, val: 0, points: 0 }
      );
  };

  return positions.map(position => {
    const own = aggregate(ownPlayers, position);
    const opp = aggregate(opponentPlayers, position);

    const ownValPer36 = own.minutes > 0 ? (own.val / own.minutes) * 36 : 0;
    const oppValPer36 = opp.minutes > 0 ? (opp.val / opp.minutes) * 36 : 0;
    const ownPointsPer36 = own.minutes > 0 ? (own.points / own.minutes) * 36 : 0;
    const oppPointsPer36 = opp.minutes > 0 ? (opp.points / opp.minutes) * 36 : 0;

    const deltaValPer36 = round(ownValPer36 - oppValPer36, 1);
    let matchupFlag: PositionComparison['matchupFlag'];
    if (deltaValPer36 <= CRITICAL_MATCHUP_DELTA) {
      matchupFlag = 'critical_disadvantage';
    } else if (deltaValPer36 >= CLEAR_ADVANTAGE_DELTA) {
      matchupFlag = 'clear_advantage';
    }

    return {
      position,
      ownValPer36: round(ownValPer36, 1),
      oppValPer36: round(oppValPer36, 1),
      ownPointsPer36: round(ownPointsPer36, 1),
      oppPointsPer36: round(oppPointsPer36, 1),
      deltaValPer36,
      matchupFlag,
    };
  });
};

const identifyKeyPlayers = (players: PlayerSeasonStat[], teamUsageShare: number) => {
  const usageValues = players.map(computePlayerUsage).filter(v => Number.isFinite(v));
  const valPer36Pool = players.map(player => {
    const minutes = Math.max(player.minutes || 0, 1);
    return (player.val / minutes) * 36;
  });
  const astPerGamePool = players.map(player => player.games > 0 ? player.ast / player.games : 0);
  const astToPool = players.map(player => player.tov > 0 ? player.ast / player.tov : player.ast);
  const threeVolumePool = players.map(player => player.games > 0 ? player.fga3 / player.games : 0);
  const threePctPool = players.map(player => player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0);

  const primaryScorers: Array<{ key: string; label: string; score: number }> = [];
  const primaryPlaymakers: Array<{ key: string; label: string; score: number }> = [];
  const stretchThreats: Array<{ key: string; label: string; score: number }> = [];
  const mismatchCandidates: Array<{ key: string; label: string; score: number }> = [];

  const heightByPos = players.reduce((acc, player) => {
    const height = player.heightCm;
    if (typeof height === 'number' && Number.isFinite(height)) {
      getPlayerPositionBuckets(player).forEach(pos => {
        acc[pos] = acc[pos] || { sum: 0, count: 0 };
        acc[pos].sum += height;
        acc[pos].count += 1;
      });
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const avgHeight = (pos: Position) => {
    const entry = heightByPos[pos];
    return entry && entry.count > 0 ? entry.sum / entry.count : null;
  };

  players.forEach(player => {
    const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
    const astTo = player.tov > 0 ? player.ast / player.tov : player.ast;
    const usage = computePlayerUsage(player);
    const astPerGame = player.games > 0 ? player.ast / player.games : 0;
    const threeVolume = player.games > 0 ? player.fga3 / player.games : 0;
    const minutes = Math.max(player.minutes || 0, 1);
    const valPer36 = (player.val / minutes) * 36;
    const primaryPos = getPlayerPositionBuckets(player)[0] ?? player.position;
    const posAvgHeight = avgHeight(primaryPos);
    const height = player.heightCm;
    const usageNorm = zScore(usage, usageValues);
    const valNorm = zScore(valPer36, valPer36Pool);
    const astNorm = zScore(astPerGame, astPerGamePool);
    const astToNorm = zScore(astTo, astToPool);
    const threeVolumeNorm = zScore(threeVolume, threeVolumePool);
    const threePctNorm = zScore(threePct, threePctPool);

    if (usageNorm >= 0.35 || (usageNorm >= 0.1 && valNorm >= 0.35)) {
      primaryScorers.push({ key: player.name, label: player.name, score: usageNorm * 0.65 + valNorm * 0.35 });
    }
    if (astPerGame >= 2.5 && astTo >= 1.4) {
      primaryPlaymakers.push({ key: player.name, label: player.name, score: astNorm * 0.6 + astToNorm * 0.4 });
    }
    if (threeVolume >= 1.5 && threePct >= 34) {
      stretchThreats.push({ key: player.name, label: player.name, score: threeVolumeNorm * 0.55 + threePctNorm * 0.45 });
    }
    if (usageNorm >= 0 || valNorm >= 0.15) {
      mismatchCandidates.push({ key: player.name, label: player.name, score: valNorm * 0.65 + usageNorm * 0.35 });
    }
    if (posAvgHeight != null && typeof height === 'number' && Number.isFinite(height) && height >= posAvgHeight + 5) {
      mismatchCandidates.push({ key: player.name, label: `${player.name} (magassági előny)`, score: valNorm + 0.9 });
    }
  });

  if (teamUsageShare >= 0.55 && primaryScorers.length === 0) {
    const topUsage = players.slice().sort((a, b) => computePlayerUsage(b) - computePlayerUsage(a))[0];
    if (topUsage) primaryScorers.push({ key: topUsage.name, label: topUsage.name, score: computePlayerUsage(topUsage) });
  }

  const pickTop = (items: Array<{ key: string; label: string; score: number }>) => {
    const unique = new Map<string, { label: string; score: number }>();
    items.forEach(item => {
      const current = unique.get(item.key);
      if (!current || item.score > current.score) {
        unique.set(item.key, { label: item.label, score: item.score });
      }
    });
    return Array.from(unique.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.label)
      .filter(Boolean);
  };

  return {
    primaryScorers: pickTop(primaryScorers),
    primaryPlaymakers: pickTop(primaryPlaymakers),
    stretchThreats: pickTop(stretchThreats),
    mismatchCandidates: pickTop(mismatchCandidates),
  };
};

const buildThreats = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, usageShare: number) => {
  const threats: string[] = [];
  if (scoreAbove(benchmarks, team, 'three_rate', 60)) {
    threats.push('Magas tripla-volumen → nagyobb pontszerzési variancia, gyors futások veszélye');
  }
  if (scoreAbove(benchmarks, team, 'three_pct', 60)) {
    threats.push('Erős 3P-hatékonyság → gyors pontfutás kockázat');
  }
  if (scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    threats.push('Szervezett labdajáratás → rotációs bontás veszély');
  }
  if (scoreAbove(benchmarks, team, 'efg', 60) && !scoreAbove(benchmarks, team, 'three_pct', 60)) {
    threats.push('Hatékony dobás → félpályás megállítás nehezebb');
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    threats.push('Festékdomináns támadás → faultterhelés és belső nyomás');
  }
  if (scoreAbove(benchmarks, team, 'oreb_rate', 60)) {
    threats.push('Erős támadólepattanózás → második esély pontok veszélye');
  }
  if (usageShare >= 0.55) threats.push('Kulcsjátékos dominancia → fókuszált elfojtás szükséges');
  return threats;
};

const buildVulnerabilities = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const vulnerabilities: string[] = [];
  if (scoreAbove(benchmarks, team, 'turnover_rate', 60)) vulnerabilities.push('Magas labdaeladás arány');
  if (scoreBelow(benchmarks, team, 'assist_rate', 40)) vulnerabilities.push('Alacsony assziszt-arány');
  if (scoreBelow(benchmarks, team, 'efg', 40)) vulnerabilities.push('Alacsony dobáshatékonyság');
  if (scoreBelow(benchmarks, team, 'ft_rate', 40)) vulnerabilities.push('Kevés büntető');
  if (scoreBelow(benchmarks, team, 'three_pct', 40)) vulnerabilities.push('Gyenge periméter-hatékonyság');
  if (scoreBelow(benchmarks, team, 'oreb_rate', 40)) vulnerabilities.push('Gyenge támadólepattanózás');
  return vulnerabilities;
};

const buildFocusPoints = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  xFactors?: XFactorInsight
) => {
  const focus: string[] = [];
  let contingencyFocus: string | null = null;

  if (scoreAbove(benchmarks, opponent, 'three_rate', 60)) {
    focus.push('Periméter-védekezés kiemelt, agresszív kilépések a triplákon');
  }
  if (scoreAbove(benchmarks, opponent, 'three_pct', 60)) {
    focus.push('Kilépés fegyelem, ne engedj tiszta triplát');
  }
  if (scoreAbove(benchmarks, opponent, 'ft_rate', 60)) {
    focus.push('Fault-limitáció, betörések védése');
  }
  if (scoreAbove(benchmarks, opponent, 'two_rate', 60)) {
    focus.push('Festékzárás, help rotációk gyorsítása');
  }
  if (scoreAbove(benchmarks, opponent, 'assist_rate', 60)) {
    focus.push('Labdajáratás bontása, passzsávok zárása');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60)) {
    focus.push('Nyomás alatt labdaeladás kényszerítése');
  }

  if (scoreAbove(benchmarks, ownTeam, 'pace', 60) && scoreBelow(benchmarks, opponent, 'pace', 40)) {
    focus.push('Gyorsabb tempó erőltetése');
  }
  if (scoreAbove(benchmarks, ownTeam, 'assist_rate', 60) && scoreBelow(benchmarks, opponent, 'assist_rate', 40)) {
    focus.push('Labdajáratásból előny építése');
  }

  if (scoreBelow(benchmarks, opponent, 'three_pct', 40) && scoreAbove(benchmarks, ownTeam, 'three_rate', 60)) {
    focus.push('Külső dobóterhelés növelése (ellenfél gyenge periméter-hatékonyság)');
  }
  if (scoreBelow(benchmarks, opponent, 'turnover_rate', 40) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 60)) {
    focus.push('Labdabiztonság kiemelt, az ellenfél védekezése nem kényszerít labdaeladást');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60) && scoreAbove(benchmarks, ownTeam, 'stl_per_game', 60)) {
    focus.push('Labdaszerzés maximalizálása, agresszív nyomás engedhető');
  }
  if (scoreBelow(benchmarks, opponent, 'two_rate', 40) && scoreAbove(benchmarks, ownTeam, 'two_rate', 60)) {
    focus.push('Festékelőny erőltetése (ellenfél alacsony 2P-fókusz)');
  }
  if (scoreBelow(benchmarks, opponent, 'ft_rate', 40) && scoreAbove(benchmarks, ownTeam, 'two_rate', 55)) {
    focus.push('Festéktámadásból büntetők kiharcolása, drive-and-kick és korai belső érintések erőltetése');
  }

  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    focus.push('Labdabiztonság vs labdanyomás, egyszerűsített döntések, letámadás-bontó sémák');
  }
  if (scoreAbove(benchmarks, ownTeam, 'oreb_rate', 60) && scoreBelow(benchmarks, opponent, 'oreb_rate', 40)) {
    focus.push('OREB agresszivitás növelése, második esélyek kihasználása');
  }

  if (xFactors && !focus.some(item => item.startsWith('Ha '))) {
    contingencyFocus = `Ha ${xFactors.primary.short} nem működik → ${xFactors.secondary.short}`;
  }

  const uniqueFocus = Array.from(new Set(focus)).slice(0, 5);
  if (!contingencyFocus) return uniqueFocus;
  if (uniqueFocus.includes(contingencyFocus)) return uniqueFocus;
  if (uniqueFocus.length < 5) return [...uniqueFocus, contingencyFocus];
  uniqueFocus[4] = contingencyFocus;
  return uniqueFocus;
};

const buildRiskNotes = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const riskFlags: string[] = [];

  if (scoreAbove(benchmarks, opponent, 'ft_rate', 65)) {
    riskFlags.push('FT-rate volumen kockázat (fault + vonal)');
  }
  if (scoreAbove(benchmarks, opponent, 'oreb_rate', 65)) {
    riskFlags.push('OREB volumen kockázat (második esélyek)');
  }
  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    riskFlags.push('Labdabiztonsági kockázat (nyomás alatti TO)');
  }

  return {
    note: riskFlags.length > 0 ? `Kockázati jelzők: ${riskFlags.join(', ')}.` : '',
    flags: riskFlags,
  };
};

const buildTempoControlNote = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const dominantAxis = getDominantAxis(opponent, benchmarks);
  if (dominantAxis !== 'transition') return '';

  if (getTempoBand(opponent, benchmarks) !== 'high') return '';

  return getTempoBand(ownTeam, benchmarks) === 'low'
    ? 'Kontrollált tempó kockázat: átmeneti játékot preferáló ellenfél, futások megfékezése kulcs.'
    : 'Tempó-futás kontroll: futások kezelése és defenzív egyensúly fenntartása kiemelt feladat.';
};

const buildMatchupRealizationNote = (
  positionComparison: PositionComparison[],
  profile: ReturnType<typeof buildTeamStyle>
) => {
  const perimeterDelta = positionComparison
    .filter(item => ['PG', 'SG', 'SF'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const frontcourtDelta = positionComparison
    .filter(item => ['PF', 'C'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);

  const notes: string[] = [];
  if (perimeterDelta >= 3 && profile.defense.includes('Labdanyomás')) {
    notes.push('Periméter előny csak stabil labdabiztonsággal és tudatos térnyitással realizálható (ellenfél labdanyomás).');
  }
  if (frontcourtDelta >= 3 && (profile.defense.includes('Festékvédelem') || profile.defense.includes('Kevés faultos védekezés'))) {
    notes.push('Belső poszt előny kihasználása térnyitást és faultkikényszerítést igényel (festékvédelem).');
  }

  return notes.join(' ');
};

const buildCriticalMatchupNote = (
  positionComparison: PositionComparison[],
  winProbability: ScoutingReport['winProbability'],
  ownTeamName: string
) => {
  const biggestNegative = positionComparison
    .filter(item => item.deltaValPer36 <= -2)
    .sort((a, b) => a.deltaValPer36 - b.deltaValPer36)[0];
  const biggestPositive = positionComparison
    .filter(item => item.deltaValPer36 >= 2)
    .sort((a, b) => b.deltaValPer36 - a.deltaValPer36)[0];

  if (!biggestNegative && !biggestPositive) return '';

  const parts: string[] = [];

  if (biggestNegative) {
    parts.push(
      `${withArticle(POSITION_LABELS[biggestNegative.position])} poszton van a legnagyobb rés (${biggestNegative.deltaValPer36} VAL/36)`
    );
  }

  if (biggestPositive) {
    parts.push(
      `${ownTeamName} legerősebb visszaütési pontja ${withArticle(POSITION_LABELS[biggestPositive.position])} poszt (${biggestPositive.deltaValPer36 >= 0 ? '+' : ''}${biggestPositive.deltaValPer36} VAL/36)`
    );
  }

  if (biggestNegative && biggestPositive) {
    if (Math.abs(biggestNegative.deltaValPer36) > biggestPositive.deltaValPer36 + 2) {
      parts.push('ez részben kompenzálható, de a nettó matchup-mérleg még mindig inkább az ellenfél felé billen');
    } else {
      parts.push('ez magyarázza, hogy egy önmagában kellemetlen poszthátrány nem feltétlenül döntő, ha más tengelyeken van visszaütési pont');
    }
  } else if (biggestNegative && winProbability.predictedWinner === 'own') {
    parts.push('a modell így is az összképet favorizálja, de ez a rés érzékeny pont marad');
  }

  return parts.length > 0 ? `Megjegyzés: ${parts.join(', ')}.` : '';
};

const buildXFactors = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  threats: string[],
  vulnerabilities: string[]
): XFactorInsight => {
  const candidates: XFactorCandidate[] = [];

  const hasPerimeterThreat = threats.some(item => item.includes('tripla') || item.includes('3P'));
  const hasTurnoverWeakness = vulnerabilities.some(item => item.toLowerCase().includes('labdaeladás'));
  const hasReboundOpportunity = vulnerabilities.some(item => item.toLowerCase().includes('lepattanó'));
  const tempoScore = getPercentileScore(benchmarks, opponent, 'pace');

  if (hasPerimeterThreat) {
    candidates.push({ key: 'perimeter', label: 'periméter kontrollja és tripla-variancia kezelése', short: 'periméter kontroll' });
  }
  if (hasTurnoverWeakness) {
    candidates.push({ key: 'turnover', label: 'labdaszerzések és extra támadások menedzselése', short: 'labdaszerzés / extra támadások' });
  }
  if (hasReboundOpportunity) {
    candidates.push({ key: 'rebound_edge', label: 'támadólepattanó fókusz és második esélyek maximalizálása', short: 'OREB / második esély' });
  }
  if (tempoScore >= 70) {
    candidates.push({ key: 'tempo', label: 'átmeneti futások kontrollja és visszarendeződés', short: 'tempó kontroll' });
  }

  const defaultCandidate = { key: 'paint', label: 'festék kontrollja és faultterhelés menedzselése', short: 'festék kontroll' };
  if (!candidates.some(item => item.key === defaultCandidate.key)) {
    candidates.push(defaultCandidate);
  }

  const primary = candidates[0];
  const secondary = candidates.find(item => item.key !== primary.key) || defaultCandidate;

  return { primary, secondary };
};

const buildXFactorImpact = (
  xFactors: XFactorInsight,
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): XFactorImpact => {
  const baseByKey: Record<string, { floor: number; ceiling: number }> = {
    perimeter: { floor: 1.8, ceiling: 4.6 },
    turnover: { floor: 1.4, ceiling: 3.9 },
    rebound_edge: { floor: 1.2, ceiling: 3.6 },
    tempo: { floor: 1.4, ceiling: 4.1 },
    paint: { floor: 1.2, ceiling: 3.4 },
  };

  const blend = (floor: number, ceiling: number, ratio: number) =>
    floor + (ceiling - floor) * clamp(ratio, 0, 1);

  const keyDelta = (key?: string) => {
    if (!key) return 1.6;
    const range = baseByKey[key] ?? { floor: 1.2, ceiling: 3.2 };
    const perimeterIntensity = (
      getPercentileScore(benchmarks, opponent, 'three_rate') +
      getPercentileScore(benchmarks, opponent, 'three_pct')
    ) / 200;
    const turnoverIntensity = (
      getPercentileScore(benchmarks, opponent, 'turnover_rate') +
      getPercentileScore(benchmarks, ownTeam, 'stl_per_game')
    ) / 200;
    const reboundIntensity = (
      getPercentileScore(benchmarks, ownTeam, 'oreb_rate') +
      (100 - getPercentileScore(benchmarks, opponent, 'oreb_rate'))
    ) / 200;
    const tempoIntensity = clamp(
      (Math.abs(getPercentileScore(benchmarks, ownTeam, 'pace') - getPercentileScore(benchmarks, opponent, 'pace')) +
        getPercentileScore(benchmarks, opponent, 'pace')) / 180,
      0,
      1
    );
    const paintIntensity = (
      getPercentileScore(benchmarks, ownTeam, 'two_rate') +
      getPercentileScore(benchmarks, ownTeam, 'ft_rate')
    ) / 200;

    const intensityByKey: Record<string, number> = {
      perimeter: perimeterIntensity,
      turnover: turnoverIntensity,
      rebound_edge: reboundIntensity,
      tempo: tempoIntensity,
      paint: paintIntensity,
    };

    return round(blend(range.floor, range.ceiling, intensityByKey[key] ?? 0.5), 1);
  };

  const primaryDeltaPct = keyDelta(xFactors.primary.key);
  const secondaryDeltaPct = round(keyDelta(xFactors.secondary.key) * 0.7, 1);
  const combinedDeltaPct = round(primaryDeltaPct + secondaryDeltaPct, 1);

  return {
    primaryDeltaPct,
    secondaryDeltaPct,
    combinedDeltaPct,
  };
};

const buildRiskScenarios = (
  riskFlags: string[],
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): RiskScenario[] => {
  const scenarios: RiskScenario[] = [];

  const oppFtScore = getPercentileScore(benchmarks, opponent, 'ft_rate');
  const oppOrebScore = getPercentileScore(benchmarks, opponent, 'oreb_rate');
  const oppStlScore = getPercentileScore(benchmarks, opponent, 'stl_per_game');
  const ownToScore = getPercentileScore(benchmarks, ownTeam, 'turnover_rate');
  const oppThreeBlend =
    (getPercentileScore(benchmarks, opponent, 'three_rate') + getPercentileScore(benchmarks, opponent, 'three_pct')) / 2;
  const paceGap = Math.abs(getPercentileScore(benchmarks, ownTeam, 'pace') - getPercentileScore(benchmarks, opponent, 'pace'));

  const dynamicSwing = (base: number, intensity: number, max: number) =>
    -round(clamp(base + (intensity / 100) * (max - base), base, max), 1);

  if (riskFlags.some(flag => flag.toLowerCase().includes('ft-rate'))) {
    scenarios.push({
      title: 'Faultterhelés felpörgése',
      trigger: 'Az ellenfél sokat jut vonalra az első félidőben.',
      instantResponse: 'Korai rotáció, festéksegítés késleltetése, verticality-fókusz.',
      estimatedOwnSwingPct: dynamicSwing(2.4, oppFtScore, 6.4),
    });
  }

  if (riskFlags.some(flag => flag.toLowerCase().includes('oreb'))) {
    scenarios.push({
      title: 'Második esély pontok',
      trigger: 'Két egymást követő támadólepattanó ugyanabban a szakaszban.',
      instantResponse: 'Plusz boxout szabály, gyengeoldali zárás, hosszú lepattanó-vadászat.',
      estimatedOwnSwingPct: dynamicSwing(2.1, oppOrebScore, 5.8),
    });
  }

  if (riskFlags.some(flag => flag.toLowerCase().includes('labdabiztons'))) {
    scenarios.push({
      title: 'Nyomás alatti eladások',
      trigger: '3+ gyorsindítás kapott pont labdaeladásból negyeden belül.',
      instantResponse: 'Két labdakezelős felállás, rövid outlet, első passz egyszerűsítése.',
      estimatedOwnSwingPct: dynamicSwing(2.6, (oppStlScore + ownToScore) / 2, 6.8),
    });
  }

  if (scoreAbove(benchmarks, opponent, 'three_rate', 60) && scoreAbove(benchmarks, opponent, 'three_pct', 60)) {
    scenarios.push({
      title: 'Periméter-run veszély',
      trigger: 'Két gyors tripla ugyanabból az akciótípusból.',
      instantResponse: 'Switch-szigorítás, agresszívabb első closeout, zóna-look 1-2 támadásra.',
      estimatedOwnSwingPct: dynamicSwing(2.2, oppThreeBlend, 6.3),
    });
  }

  if (getTempoBand(ownTeam, benchmarks) === 'low' && getTempoBand(opponent, benchmarks) === 'high') {
    scenarios.push({
      title: 'Tempó-szétcsúszás',
      trigger: 'A meccs a saját tempó felett pörög két negyeden át.',
      instantResponse: 'Támadóidő mélyebb kihasználása, támadólepattanó-visszafogás, korai visszarendeződés.',
      estimatedOwnSwingPct: dynamicSwing(1.8, paceGap, 5.2),
    });
  }

  if (scenarios.length === 0) {
    scenarios.push({
      title: 'Kontrollált alapforgatókönyv',
      trigger: 'Nincs kiugró kockázati trigger.',
      instantResponse: 'Félpályás ritmuskontroll, stabil kezdő rotáció és tudatosan időzített timeout a spacing resethez.',
      estimatedOwnSwingPct: dynamicSwing(0.9, Math.max(oppFtScore, oppOrebScore, oppStlScore), 2.8),
    });
  }

  return scenarios.slice(0, 4);
};

const buildScenarioOutcomes = (
  winProbability: ScoutingReport['winProbability'],
  xFactorImpact: XFactorImpact,
  varianceDrivers: string[],
  riskScenarios: RiskScenario[],
  ownTeamName: string,
  opponentTeamName: string
): ScenarioOutcome[] => {
  const baseOwn = winProbability.ownPct;
  const makeScenario = (key: string, label: string, delta: number, note: string): ScenarioOutcome => {
    const ownPct = round(clamp(baseOwn + delta, 8, 92), 1);
    return {
      key,
      label,
      ownPct,
      opponentPct: round(100 - ownPct, 1),
      deltaVsBase: round(ownPct - baseOwn, 1),
      note,
    };
  };

  const downside = Math.abs(riskScenarios.reduce((sum, item) => sum + Math.min(item.estimatedOwnSwingPct, 0), 0));
  const confidenceMultiplier = winProbability.confidence === 'High'
    ? 0.85
    : winProbability.confidence === 'Medium'
      ? 1
      : 1.15;
  const variancePenalty = clamp(0.9 + varianceDrivers.length * 1.15 + downside * 0.16, 1.2, 8.6);
  const controlledDelta = round(xFactorImpact.combinedDeltaPct * (0.85 + (50 - Math.abs(50 - baseOwn)) / 100), 1);

  const scenarios: ScenarioOutcome[] = [
    makeScenario(
      'base',
      'Alapforgatókönyv',
      0,
      `Kiinduló modell a jelenlegi statisztikai állapot szerint (${ownTeamName} vs ${opponentTeamName}).`
    ),
    makeScenario(
      'controlled_tempo',
      'Kontrollált tempó és fókuszált végrehajtás',
      controlledDelta,
      'A kulcsfaktorok realizálódnak, a tempó kontrollált marad.'
    ),
    makeScenario(
      'high_variance',
      'Magas variancia, ellenfél futásokkal',
      -(variancePenalty * confidenceMultiplier + downside * 0.32),
      'A tripla-variancia és a kockázati triggerek az ellenfél oldalára billentik a futásokat.'
    ),
  ];

  return scenarios;
};

const buildCalibrationDiagnostics = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  varianceDrivers: string[],
  riskFlags: string[]
): CalibrationDiagnostics => {
  const perimeterScore = round(
    (getPercentileScore(benchmarks, opponent, 'three_rate') +
      getPercentileScore(benchmarks, opponent, 'three_pct')) / 2,
    1
  );
  const pressureScore = round(
    (getPercentileScore(benchmarks, opponent, 'stl_per_game') +
      getPercentileScore(benchmarks, ownTeam, 'turnover_rate')) / 2,
    1
  );
  const paintScore = round(
    (getPercentileScore(benchmarks, ownTeam, 'two_rate') +
      getPercentileScore(benchmarks, ownTeam, 'ft_rate') +
      (100 - getPercentileScore(benchmarks, opponent, 'fouls_per_game'))) / 3,
    1
  );
  const tempoScore = round(
    clamp(
      (Math.abs(getPercentileScore(benchmarks, ownTeam, 'pace') - getPercentileScore(benchmarks, opponent, 'pace')) +
        getPercentileScore(benchmarks, opponent, 'pace')) / 1.8,
      0,
      100
    ),
    1
  );
  const volatilityScore = round(
    clamp(
      varianceDrivers.length * 22 + riskFlags.length * 12,
      0,
      100
    ),
    1
  );

  const scoreToNote = (score: number) => {
    if (score >= 70) return 'Magas';
    if (score >= 45) return 'Közepes';
    return 'Alacsony';
  };

  const dimensions: CalibrationDimension[] = [
    {
      key: 'perimeter_pressure',
      label: 'Periméter nyomás',
      score: perimeterScore,
      note: scoreToNote(perimeterScore),
      context: `Ellenfél 3P-profil: ${opponent.threePct.toFixed(1)}% tripla, ${(opponent.threeRate * 100).toFixed(1)}% triplaarány.`,
    },
    {
      key: 'ball_pressure',
      label: 'Labdanyomás / TO-kockázat',
      score: pressureScore,
      note: scoreToNote(pressureScore),
      context: `Labdanyomás olvasat: ${(opponent.games > 0 ? opponent.stl / opponent.games : 0).toFixed(1)} labdaszerzés/meccs vs ${(ownTeam.turnoverRate * 100).toFixed(1)}% saját TO%.`,
    },
    {
      key: 'paint_edge',
      label: 'Festék-faultelőny',
      score: paintScore,
      note: scoreToNote(paintScore),
      context: `Festékből generálható faultnyomás: ${(ownTeam.ftRate * 100).toFixed(1)}% saját FT rate vs ${(opponent.games > 0 ? opponent.fouls / opponent.games : 0).toFixed(1)} fault/meccs ellenféloldalon.`,
    },
    {
      key: 'tempo_gap',
      label: 'Tempó-eltérés',
      score: tempoScore,
      note: scoreToNote(tempoScore),
      context: `Tempóprofil: saját ${ownTeam.pace.toFixed(1)} poss/meccs vs ellenfél ${opponent.pace.toFixed(1)} poss/meccs.`,
    },
    {
      key: 'volatility',
      label: 'Variancia-kitettség',
      score: volatilityScore,
      note: scoreToNote(volatilityScore),
      context: varianceDrivers.length > 0
        ? `Varianciaforrások: ${varianceDrivers.join(', ')}${riskFlags.length > 0 ? ` | kockázati zászlók: ${riskFlags.join(', ')}` : ''}.`
        : 'Nincs kiugró varianciaforrás vagy extra kockázati zászló.',
    },
  ];

  const overallIntensity = round(
    dimensions.reduce((sum, item) => sum + item.score, 0) / (dimensions.length || 1),
    1
  );

  const overallLabel = scoreToNote(overallIntensity);

  return {
    overallIntensity,
    scaleLabel: '0-100 matchup-intenzitás skála',
    summary: `${overallLabel} nehézségű matchup; a magasabb értékek azok a tengelyek, ahol a párosítás leginkább kilengést okozhat.`,
    dimensions,
  };
};

const buildFanSummary = (
  ownTeamName: string,
  opponentTeamName: string,
  winProbability: ScoutingReport['winProbability'],
  threats: string[],
  vulnerabilities: string[],
  focusPoints: string[],
  positionComparison: PositionComparison[],
  riskScenarios: RiskScenario[]
): FanSummary => {
  const ownEdgePositions = positionComparison
    .filter(item => item.deltaValPer36 >= 2)
    .map(item => POSITION_LABELS[item.position] ?? item.position)
    .slice(0, 3);

  const favoredPct = winProbability.predictedWinner === 'own'
    ? winProbability.ownPct
    : winProbability.predictedWinner === 'opponent'
      ? winProbability.opponentPct
      : 50;

  const headline = winProbability.predictedWinner === 'own'
    ? favoredPct >= 70
      ? `${ownTeamName} erős favoritnak számít, de a matchup kulcsterületeit így is kontrollálni kell.`
      : favoredPct >= 60
        ? `${ownTeamName} világos előnyben van, de fegyelmezett végrehajtás kell a modell realizálásához.`
        : `${ownTeamName} enyhe-mérsékelt előnyben van, a futások kezelése döntheti el a meccset.`
    : winProbability.predictedWinner === 'opponent'
      ? favoredPct >= 70
        ? `${opponentTeamName} egyértelmű favorit, ezért magas fegyelmi szint és jó ritmusváltás kell a fordításhoz.`
        : favoredPct >= 60
          ? `${opponentTeamName} jelentős előnyben van, ezért kontrollált tempó és a legerősebb saját tengelyek maximalizálása kell a meccs nyitva tartásához.`
          : `${opponentTeamName} enyhe-mérsékelt előnyben van, jó ritmusváltással nyitva tartható a matchup.`
      : 'Kiegyenlített párharc várható, a kulcsfutások dönthetnek a végjátékban.';

  return {
    headline,
    keyEdges: [
      ownEdgePositions.length > 0
        ? `Pozíciós előny: ${ownEdgePositions.join(', ')}.`
        : 'Nincs egyértelmű posztfölény, párosítási döntések lesznek a kulcs.',
      ...vulnerabilities.slice(0, 2).map(item => `Támadható pont: ${item}.`),
    ].slice(0, 3),
    majorRisks: [
      ...threats.slice(0, 2).map(item => item.endsWith('.') ? item : `${item}.`),
      ...riskScenarios
        .filter(item => item.title !== 'Kontrollált alapforgatókönyv')
        .slice(0, 1)
        .map(item => `${item.title}: ${item.trigger}`),
    ].slice(0, 3),
    gamePlan: focusPoints.slice(0, 3),
    fallbackPlan: riskScenarios.slice(0, 2).map(item => item.instantResponse),
  };
};

const buildSummary = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  profile: ReturnType<typeof buildTeamStyle>,
  threats: string[],
  vulnerabilities: string[],
  benchmarks: LeagueTeamBenchmarks,
  winProbability: ScoutingReport['winProbability'],
  positionComparison: PositionComparison[],
  xFactors: XFactorInsight,
  matchupRealizationNote: string,
  tempoControlNote: string,
  focusPoints: string[],
  ownTeamName: string,
  riskFlags: string[] = [],
  varianceDrivers: string[] = [],
  xFactorImpact?: XFactorImpact,
  riskScenarios: RiskScenario[] = [],
  fanSummary?: FanSummary,
  positionComparisonNote?: string,
  injuryContext?: { own: string[]; opponent: string[] },
  confidenceReasons: string[] = [],
  shotProfileNotes: string[] = [],
  shotDefenseNotes: string[] = []
) => {
  const tempo = describeTempo(opponent, benchmarks);
  const offense = profile.offense.length > 0 ? profile.offense.join(', ') : 'kiegyensúlyozott';
  const defense = profile.defense.length > 0 ? profile.defense.join(', ') : 'kiegyensúlyozott';
  const dominantAxis = getDominantAxis(opponent, benchmarks);
  const axisLabel = dominantAxis === 'transition'
    ? 'átmeneti játék'
    : dominantAxis === 'periméter'
      ? 'periméter'
      : 'festék';

  const viewpointLine = `Elemzés nézőpontja: ${ownTeamName}`;
  const favoredLabel = winProbability.predictedWinner === 'even'
    ? 'Nincs (egyensúly)'
    : winProbability.predictedWinner === 'own'
      ? ownTeamName
      : opponent.teamName;
  const probabilityText = winProbability.predictedWinner === 'even'
    ? 'Valószínűség: 50-50'
    : `Valószínűség: ${winProbability.ownPct}% - ${winProbability.opponentPct}%`;
  const favoredPct = winProbability.predictedWinner === 'even'
    ? 50
    : winProbability.predictedWinner === 'own'
      ? winProbability.ownPct
      : winProbability.opponentPct;
  const confidenceMap: Record<ScoutingReport['winProbability']['confidence'], string> = {
    High: 'Bizonyosság: Magas',
    Medium: 'Bizonyosság: Közepes',
    Low: 'Bizonyosság: Alacsony',
  };
  const probabilityConfidenceLabel = favoredPct >= 55 && favoredPct <= 60
    ? 'Bizonyosság: Közepes–alacsony'
    : confidenceMap[winProbability.confidence];
  const probabilityLine = `Eredmény-prognózis: Várható győztes: ${favoredLabel} | ${probabilityText} | ${probabilityConfidenceLabel}.`;
  const confidenceReasonLine = confidenceReasons.length > 0
    ? `Bizonyosság kontextusa: ${confidenceReasons.join(' • ')}.`
    : '';

  const threatText = threats.length > 0
    ? threats.join('; ')
    : 'kiegyensúlyozott fegyvertár, extrém veszély nélkül';
  const vulnText = vulnerabilities.length > 0
    ? vulnerabilities.join('; ')
    : 'matchupfüggő, rendszerszintű rés nem látszik';
  const ownRiskText = riskFlags.length > 0
    ? riskFlags.join('; ')
    : 'általános faultterhelés- és lepattanó-kontroll figyelmeztetés, konkrét riasztás nélkül';
  const injuryLine = (() => {
    const parts: string[] = [];
    if (injuryContext?.own?.length) {
      parts.push(`${ownTeamName}: ${injuryContext.own.join(', ')}`);
    }
    if (injuryContext?.opponent?.length) {
      parts.push(`${opponent.teamName}: ${injuryContext.opponent.join(', ')}`);
    }
    return parts.length > 0 ? `Sérülések: ${parts.join(' | ')}.` : '';
  })();

  const { perimeterDelta, frontcourtDelta } = summarizePositionDeltas(positionComparison);
  const posSummary = perimeterDelta >= 3 && frontcourtDelta >= 3
    ? 'Minden poszt-kategóriában saját előny, szisztematikus nyomásgyakorlás fenntartható.'
    : perimeterDelta >= 3 && frontcourtDelta <= -1
    ? 'Periméteren saját előny (PG–SG–SF), az ellenfél inkább a magas posztokon veszélyes.'
    : frontcourtDelta >= 3 && perimeterDelta <= -1
      ? 'Belső poszt előny (PF–C), periméteren óvatos párosítás szükséges.'
      : 'Pozíciós előnyök megoszlanak, párosítás-alapú döntés javasolt.';

  const formatDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const criticalLine = positionComparison
    .filter(item => item.matchupFlag === 'critical_disadvantage')
    .map(item => `${POSITION_LABELS[item.position] ?? item.position} (${formatDelta(item.deltaValPer36)})`)
    .join(', ');
  const advantageLine = positionComparison
    .filter(item => item.matchupFlag === 'clear_advantage')
    .map(item => `${POSITION_LABELS[item.position] ?? item.position} (${formatDelta(item.deltaValPer36)})`)
    .join(', ');

  const positionSectionParts = [
    `Pozíciós dinamika: ${posSummary} ${matchupRealizationNote}`.trim(),
    criticalLine ? `Kritikus hátrány: ${criticalLine}.` : '',
    advantageLine ? `Egyértelmű előny: ${advantageLine}.` : '',
    positionComparisonNote?.trim() ?? '',
  ].filter(part => part.length > 0);
  const positionSection = positionSectionParts.join(' ');

  const shotProfileLine = shotProfileNotes.length > 0
    ? `Dobástérkép-fókusz: ${shotProfileNotes.join(' • ')}.`
    : '';
  const shotDefenseLine = shotDefenseNotes.length > 0
    ? `Dobástérkép-védekezés: ${shotDefenseNotes.join(' • ')}.`
    : '';

  const focusLine = focusPoints.length > 0
    ? `Fókuszpontok (reakciók): ${focusPoints.join(' • ')}.`
    : '';

  const varianceNote = varianceDrivers.length > 0
    ? `Magas varianciájú mérkőzés: ${varianceDrivers.join(' + ')}.`
    : '';
  const tempoLineParts = [tempoControlNote, varianceNote].filter(Boolean);
  const tempoLine = tempoLineParts.length > 0
    ? `Tempó és variancia: ${tempoLineParts.join(' ')}`
    : '';

  const xFactorLine = `X-faktor: Elsődleges: ${xFactors.primary.label}; Másodlagos: ${xFactors.secondary.label}.`;
  const xFactorImpactLine = xFactorImpact
    ? `X-faktor modellált swing-potenciál: +${xFactorImpact.primaryDeltaPct}% (elsődleges), +${xFactorImpact.secondaryDeltaPct}% (másodlagos), együtt +${xFactorImpact.combinedDeltaPct}% kontrollált forgatókönyvben.`
    : '';
  const riskScenarioLine = riskScenarios.length > 0
    ? `Ha-bekövetkezik forgatókönyvek: ${riskScenarios.map(item => `${item.title} → ${item.instantResponse}`).join(' | ')}.`
    : '';
  const fanLine = fanSummary?.headline ? `Szurkolói fókusz: ${fanSummary.headline}` : '';

  const sections = [
    viewpointLine,
    probabilityLine,
    confidenceReasonLine,
    `Kontextus: Az ellenfél ${tempo}, ${offense} támadást játszik, védekezése ${defense}. Domináns tengely: ${axisLabel}.`,
    `Fő veszélyek: ${threatText}.`,
    `Feltételes sebezhetőségek (ellenfél): ${vulnText}.`,
    `Saját kockázati pontok: ${ownRiskText}.`,
    injuryLine,
    positionSection,
    shotProfileLine,
    shotDefenseLine,
    focusLine,
    tempoLine,
    xFactorLine,
    xFactorImpactLine,
    riskScenarioLine,
    fanLine,
  ]
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return sections.join('\n');
};

const computeTeamRating = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const metrics = [
    { stat: 'efg', weight: 1.4, invert: false },
    { stat: 'turnover_rate', weight: 1.2, invert: true },
    { stat: 'assist_rate', weight: 1.0, invert: false },
    { stat: 'oreb_rate', weight: 0.6, invert: false },
    { stat: 'ft_rate', weight: 0.6, invert: false },
    { stat: 'three_pct', weight: 0.8, invert: false },
    { stat: 'val_per_game', weight: 1.4, invert: false },
    { stat: 'stl_per_game', weight: 0.5, invert: false },
    { stat: 'blk_per_game', weight: 0.4, invert: false },
    { stat: 'fouls_per_game', weight: 0.4, invert: true },
  ];

  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0) || 1;
  const weightedScore = metrics.reduce((sum, metric) => {
    const percentile = getPercentileScore(benchmarks, team, metric.stat);
    const score = metric.invert ? 100 - percentile : percentile;
    return sum + score * metric.weight;
  }, 0);

  return weightedScore / totalWeight;
};

const computeWinProbability = (
  ownTeam: NormalizedTeamStats,
  opponentTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const ownRating = computeTeamRating(ownTeam, benchmarks);
  const opponentRating = computeTeamRating(opponentTeam, benchmarks);
  const diff = ownRating - opponentRating;

  const ownThreeRateScore = getPercentileScore(benchmarks, ownTeam, 'three_rate');
  const oppThreeRateScore = getPercentileScore(benchmarks, opponentTeam, 'three_rate');
  const volatilityFactor = ownThreeRateScore >= 70 || oppThreeRateScore >= 70 ? 0.9 : 1;

  const adjustedDiff = diff * volatilityFactor;
  const probability = 1 / (1 + Math.exp(-adjustedDiff / 18));
  const ownPct = clamp(probability, 0.08, 0.92) * 100;
  const opponentPct = 100 - ownPct;
  const absDiff = Math.abs(adjustedDiff);
  const confidenceReasons: string[] = [];

  let confidence: 'Low' | 'Medium' | 'High' = absDiff >= 16
    ? 'High'
    : absDiff >= 8
      ? 'Medium'
      : 'Low';

  if (absDiff < 8) {
    confidenceReasons.push('szűk rating-különbség');
  }

  const minGames = Math.min(ownTeam.games || 0, opponentTeam.games || 0);
  if (minGames < 10 && confidence === 'High') {
    confidence = 'Medium';
  }
  if (minGames < 10) {
    confidenceReasons.push('korlátozott szezonminta');
  }
  if (volatilityFactor < 1 && confidence === 'High') {
    confidence = 'Medium';
  }
  if (volatilityFactor < 1) {
    confidenceReasons.push('magas tripla-variancia');
  }

  const predictedWinner: 'own' | 'opponent' | 'even' = absDiff < 2
    ? 'even'
    : adjustedDiff > 0
      ? 'own'
      : 'opponent';

  return {
    ownPct: round(ownPct, 1),
    opponentPct: round(opponentPct, 1),
    predictedWinner,
    confidence,
    confidenceReasons,
  };
};

const applyMatchupAdjustment = (
  baseProb: ReturnType<typeof computeWinProbability>,
  positionComparison: ReturnType<typeof buildPositionComparison>
): ReturnType<typeof computeWinProbability> => {
  const weightedDelta = positionComparison.reduce((acc, pos) => {
    const w = POSITION_MATCHUP_WEIGHTS[pos.position] ?? 0.20;
    return acc + pos.deltaValPer36 * w;
  }, 0);

  const rawAdjust = weightedDelta * MATCHUP_PROB_SCALE;
  const adjustment = clamp(rawAdjust, -MATCHUP_PROB_CAP, MATCHUP_PROB_CAP);
  if (Math.abs(adjustment) < 2) return baseProb;

  const newOwnPct = round(clamp(baseProb.ownPct + adjustment, 8, 92), 1);
  const absDiff = Math.abs(newOwnPct - 50);
  const predictedWinner: 'own' | 'opponent' | 'even' =
    absDiff < 2 ? 'even' : newOwnPct > 50 ? 'own' : 'opponent';

  const confidence =
    baseProb.confidence === 'High' && Math.abs(adjustment) >= 8 ? 'Medium' : baseProb.confidence;

  return {
    ...baseProb,
    ownPct: newOwnPct,
    opponentPct: round(100 - newOwnPct, 1),
    predictedWinner,
    confidence,
    confidenceReasons: [
      ...baseProb.confidenceReasons,
      ...(Math.abs(adjustment) >= 5 ? ['matchup-mérleg korrekció'] : []),
    ],
  };
};

export const analyzePreGameScouting = (
  opponentTeam: TeamSeasonStat,
  opponentPlayers: PlayerSeasonStat[],
  ownTeam: TeamSeasonStat,
  leagueBenchmarks: LeagueTeamBenchmarks,
  ownPlayers: PlayerSeasonStat[] = [],
  injuryContext?: { own: string[]; opponent: string[] },
  shotProfiles?: {
    own?: ShotProfileSummary | null;
    opponent?: ShotProfileSummary | null;
    league?: ShotProfileSummary | null;
    ownAllowed?: ShotProfileSummary | null;
    opponentAllowed?: ShotProfileSummary | null;
  }
): ScoutingReport => {
  const normalizedOpponent = normalizeTeamStats(opponentTeam);
  const normalizedOwn = normalizeTeamStats(ownTeam);

  const opponentStyle = buildTeamStyle(normalizedOpponent, leagueBenchmarks);
  const ownStyle = buildTeamStyle(normalizedOwn, leagueBenchmarks);
  const usageShare = computeUsageConcentration(opponentPlayers);
  const ownUsageShare = computeUsageConcentration(ownPlayers);
  const keyPlayers = identifyKeyPlayers(opponentPlayers, usageShare);
  const ownKeyPlayers = identifyKeyPlayers(ownPlayers, ownUsageShare);

  const ownHeightByPos = ownPlayers.reduce((acc, player) => {
    const height = player.heightCm;
    if (typeof height === 'number' && Number.isFinite(height)) {
      getPlayerPositionBuckets(player).forEach(pos => {
        acc[pos] = acc[pos] || { sum: 0, count: 0 };
        acc[pos].sum += height;
        acc[pos].count += 1;
      });
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const opponentHeightByPos = opponentPlayers.reduce((acc, player) => {
    const height = player.heightCm;
    if (typeof height === 'number' && Number.isFinite(height)) {
      getPlayerPositionBuckets(player).forEach(pos => {
        acc[pos] = acc[pos] || { sum: 0, count: 0 };
        acc[pos].sum += height;
        acc[pos].count += 1;
      });
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const avgHeight = (map: Record<Position, { sum: number; count: number }>, pos: Position) => {
    const entry = map[pos];
    return entry && entry.count > 0 ? entry.sum / entry.count : null;
  };

  const heightMismatchNotes: string[] = [];
  (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).forEach(pos => {
    const ownAvg = avgHeight(ownHeightByPos, pos);
    const oppAvg = avgHeight(opponentHeightByPos, pos);
    if (ownAvg && oppAvg && oppAvg - ownAvg >= 4) {
      heightMismatchNotes.push(`Magassági hátrány a ${pos} poszton (≈${round(oppAvg - ownAvg, 1)} cm).`);
    }
  });
  const threats = buildThreats(normalizedOpponent, leagueBenchmarks, usageShare);
  const vulnerabilities = buildVulnerabilities(normalizedOpponent, leagueBenchmarks);
  const positionComparison = buildPositionComparison(ownPlayers, opponentPlayers);
  const winProbability = applyMatchupAdjustment(
    computeWinProbability(normalizedOwn, normalizedOpponent, leagueBenchmarks),
    positionComparison
  );
  const xFactors = buildXFactors(normalizedOpponent, normalizedOwn, leagueBenchmarks, threats, vulnerabilities);
  const xFactorImpact = buildXFactorImpact(xFactors, normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const riskNotes = buildRiskNotes(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const tempoControlNote = buildTempoControlNote(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const matchupRealizationNote = buildMatchupRealizationNote(positionComparison, opponentStyle);
  const focusPoints = buildFocusPoints(normalizedOpponent, normalizedOwn, leagueBenchmarks, xFactors);
  const positionComparisonNote = buildCriticalMatchupNote(positionComparison, winProbability, ownTeam.teamName);
  const { perimeterDelta, frontcourtDelta } = summarizePositionDeltas(positionComparison);
  const varianceDrivers = buildVarianceDrivers(normalizedOpponent, normalizedOwn, leagueBenchmarks, riskNotes.flags);
  const riskScenarios = buildRiskScenarios(riskNotes.flags, normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const shotProfileContext = buildShotProfileContext(
    shotProfiles?.own,
    shotProfiles?.opponent,
    shotProfiles?.league,
    shotProfiles?.ownAllowed,
    shotProfiles?.opponentAllowed
  );
  const scenarioOutcomes = buildScenarioOutcomes(
    winProbability,
    xFactorImpact,
    varianceDrivers,
    riskScenarios,
    ownTeam.teamName,
    opponentTeam.teamName
  );
  const calibrationDiagnostics = buildCalibrationDiagnostics(
    normalizedOpponent,
    normalizedOwn,
    leagueBenchmarks,
    varianceDrivers,
    riskNotes.flags
  );
  const fanSummary = buildFanSummary(
    ownTeam.teamName,
    opponentTeam.teamName,
    winProbability,
    threats,
    vulnerabilities,
    focusPoints,
    positionComparison,
    riskScenarios
  );
  const advancedPlayers = {
    own: buildAdvancedPlayers(ownPlayers, ownTeam.games || normalizedOwn.games || 1, winProbability.ownPct),
    opponent: buildAdvancedPlayers(
      opponentPlayers,
      opponentTeam.games || normalizedOpponent.games || 1,
      winProbability.opponentPct
    ),
  };
  const advancedPlayersEligibility = {
    own: getAdvancedEligibility(ownTeam.games || normalizedOwn.games || 1),
    opponent: getAdvancedEligibility(opponentTeam.games || normalizedOpponent.games || 1),
  };
  const opponentTempoDescriptor = describeTempo(normalizedOpponent, leagueBenchmarks);
  const ownTempoDescriptor = describeTempo(normalizedOwn, leagueBenchmarks);
  const opponentProfile = finalizeTeamProfile(
    getTempoLevelLabel(normalizedOpponent, leagueBenchmarks),
    opponentStyle,
    { defensiveDataLimited: opponentStyle.defense.length === 0 }
  );
  const ownTeamProfile = finalizeTeamProfile(
    getTempoLevelLabel(normalizedOwn, leagueBenchmarks),
    ownStyle,
    { defensiveDataLimited: ownStyle.defense.length === 0 }
  );
  const dominantAxis = getDominantAxis(normalizedOpponent, leagueBenchmarks);
  const significantMatchups = buildSignificantMatchups(positionComparison);
  const llmContext: ScoutingReportLLMContext = {
    opponentTempoDescriptor,
    ownTempoDescriptor,
    opponentDominantAxis: dominantAxis,
    tempoControlNote: tempoControlNote || undefined,
    matchupRealizationNote: matchupRealizationNote || undefined,
    riskNote: riskNotes.note || undefined,
    varianceDrivers,
    confidenceReasons: winProbability.confidenceReasons,
    shotProfileNotes: shotProfileContext?.notes,
    shotDefenseNotes: shotProfileContext?.defenseNotes,
    positionDeltaSummary: {
      perimeterDelta,
      frontcourtDelta,
    },
    significantMatchups,
  };
  const xFactorContext: PreGameXFactorContext = {
    primaryKey: xFactors.primary.key,
    primaryLabel: xFactors.primary.label,
    secondaryKey: xFactors.secondary?.key,
    secondaryLabel: xFactors.secondary?.label,
    primaryDeltaPct: xFactorImpact.primaryDeltaPct,
    secondaryDeltaPct: xFactorImpact.secondaryDeltaPct,
    combinedDeltaPct: xFactorImpact.combinedDeltaPct,
    riskFlags: riskNotes.flags,
  };

  return {
    ownTeamId: ownTeam.teamId,
    ownTeamName: ownTeam.teamName,
    opponentTeamId: opponentTeam.teamId,
    opponentTeamName: opponentTeam.teamName,
    league: opponentTeam.league,
    season: opponentTeam.season,
    winProbability,
    positionComparison,
    profile: opponentProfile,
    ownTeamProfile,
    threats,
    vulnerabilities,
    keyPlayers: {
      ...keyPlayers,
      mismatchCandidates: [...keyPlayers.mismatchCandidates, ...heightMismatchNotes].slice(0, 4),
    },
    ownKeyPlayers,
    focusPoints,
    xFactorContext,
    xFactorImpact,
    scenarioOutcomes,
    riskScenarios,
    fanSummary,
    calibrationDiagnostics,
    shotProfileContext,
    advancedPlayers,
    advancedPlayersEligibility,
    teamStats: {
      own: {
        pace: normalizedOwn.pace,
        efg: normalizedOwn.efg,
        threeRate: round(normalizedOwn.threeRate * 100, 1),
        threePct: normalizedOwn.threePct,
        turnoverRate: round(normalizedOwn.turnoverRate * 100, 1),
        ftRate: round(normalizedOwn.ftRate * 100, 1),
        orebRate: round(normalizedOwn.orebRate * 100, 1),
        assistRate: round(normalizedOwn.assistRate * 100, 1),
      },
      opponent: {
        pace: normalizedOpponent.pace,
        efg: normalizedOpponent.efg,
        threeRate: round(normalizedOpponent.threeRate * 100, 1),
        threePct: normalizedOpponent.threePct,
        turnoverRate: round(normalizedOpponent.turnoverRate * 100, 1),
        ftRate: round(normalizedOpponent.ftRate * 100, 1),
        orebRate: round(normalizedOpponent.orebRate * 100, 1),
        assistRate: round(normalizedOpponent.assistRate * 100, 1),
      },
    },
    riskFlags: riskNotes.flags,
    positionComparisonNote: positionComparisonNote || undefined,
    llmContext,
    summary: buildSummary(
      normalizedOpponent,
      normalizedOwn,
      opponentStyle,
      threats,
      vulnerabilities,
      leagueBenchmarks,
      winProbability,
      positionComparison,
      xFactors,
      matchupRealizationNote,
      tempoControlNote,
      focusPoints,
      ownTeam.teamName,
      riskNotes.flags,
      varianceDrivers,
      xFactorImpact,
      riskScenarios,
      fanSummary,
      positionComparisonNote || '',
      injuryContext,
      winProbability.confidenceReasons,
      shotProfileContext?.notes ?? [],
      shotProfileContext?.defenseNotes ?? []
    ),
    injuryContext,
  };
};
