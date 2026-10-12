// A csapat-elemző motor: az ASEStats `team-analysis` portja. Tiszta függvények, a
// sémát nem ismerik; a bemenetet az adapter (lib/adapters/team-analysis-adapter.ts)
// állítja elő. A benchmark egy szakasz (alapszakasz / play-in / rájátszás) csapataiból
// épül, a percentilis P10–P90 skálán készül.
//
// Eltérések az ASEStatstől:
//  - a fejlett mutatók a Csapatstatisztika definícióit követik (T14, T17): közös
//    birtoklásszám a tempóhoz és mindkét ratinghez, Oliver-féle TO%, FT-mutató = FTM / FGA;
//  - a benchmark egyszintű (egy szakasz), nincs liga / szezon kulcs;
//  - nincs magasság (az ESPN-adat nem tartalmazza), és nincs hiányzó-ellenfél-adat ág:
//    az adapter csak teljes (mindkét oldali csapatsorral rendelkező) meccseket ad át;
//  - a forma / clutch / dobástérkép / lineup / impact profil nem része a portnak.

import type { RoleKey } from '@/lib/player-analysis';
import type { Position } from '@/lib/positions';
import {
  effectiveFgPct,
  estimatePossessions,
  freeThrowRate,
  offensiveReboundPct,
  ratingPer100,
  shootingPct,
  turnoverPct,
} from '@/lib/stat-formulas';
import { DEFENSE_STYLE_LABELS, OFFENSE_STYLE_LABELS } from '@/lib/style-vocabulary';

export type { Position };

const REGULATION_MINUTES = 48;

// A roster-jelzések küszöbei. Az ASEStats abszolút értékei (top-2 használat ≥ 0,55,
// magas posztok percei < 35%) a kisebb FIBA-rosterre szóltak; az NBA-ban (12–20 fős
// roster) az első soha, a második a csapatok 27/30-án teljesülne. Ezért a két jelzés
// a liga percentilisére épül: a szakasz csapatai között a legmagasabb használat-
// koncentráció, illetve a legkisebb magas poszt-jelenlét jelez.
const SCORER_DEPENDENCY_PERCENTILE = 80;
const WEAK_FRONTCOURT_PERCENTILE = 20;
const MIN_CREATORS = 2;
// Az ASEStats „FT rate ≥ 0,30” szabálya FTA / FGA-ra szólt; az FTM / FGA (T17)
// skálájára a liga ~77%-os büntetőtalálatával átszámolva.
const INTERIOR_FT_RATE_MIN = 0.23;

export type TeamSeasonStat = {
  teamId: string;
  teamName: string;
  games: number;
  /** Összes játékperc: 48 meccsenként + 5 hosszabbításonként (a tempó 48 percre vetítéséhez). */
  gameMinutes: number;
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
  opponent: {
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
  roster: Array<{
    playerId: string;
    name: string;
    position: Position;
    positionBuckets?: Position[];
    minutes: number;
    usageProxy: number;
    roleKeys: RoleKey[];
  }>;
};

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number; // 48 percre vetített közös birtoklásszám
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
  valPerGame: number;
  ortg: number; // pont 100 közös birtoklásra
  drtg: number; // kapott pont 100 közös birtoklásra
  netRtg: number; // ortg - drtg
  opp2Pct: number;
  opp3Pct: number;
  oppTurnoverRate: number;
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

export type TeamBenchmarkMeta = {
  teamCount: number;
  usageP10: number;
  usageP90: number;
  frontcourtPresenceP10: number;
  frontcourtPresenceP90: number;
  clusterCounts: Record<string, number>;
  clusterMembers: Record<string, Array<{ teamId: string; teamName: string }>>;
};

export type TeamBenchmarks = Record<string, BenchmarkPercentiles> & {
  _meta?: TeamBenchmarkMeta;
};

export type TeamStyle = {
  offense: string[];
  defense: string[];
};

export type RosterFlags = {
  scorerDependency: boolean;
  lowPlaymakingDepth: boolean;
  weakReboundingPresence: boolean;
};

export type TeamAnalysis = {
  teamId: string;
  teamName: string;
  style: TeamStyle;
  strengths: string[];
  limitations: string[];
  rosterSummary: {
    positionMinutesShare: Record<Position, number>;
    roleCounts: Record<string, number>;
    rolePlayers: Record<string, string[]>;
    top2UsageShare: number;
    flags: RosterFlags;
    positionPlayers: Record<Position, string[]>;
    totalMinutes: number;
  };
  rosterInsights: string[];
  riskPriorities: string[];
  leagueProfile: {
    entries: Array<{
      key: string;
      label: string;
      percentile: number;
      value: number;
      tier: string;
    }>;
    clusterLabel: string;
    clusterCount: number | null;
    teamCount: number | null;
    clusterPeers: string[];
  };
  defensiveProfile: {
    rimProtection: string;
    perimeterDefense: string;
    rebounding: string;
    foulDiscipline: string;
    notes: string[];
  };
  summary: string;
};

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const LOWER_BETTER_STATS = new Set(['turnover_rate', 'opp2_pct', 'opp3_pct', 'fouls_per_game', 'drtg']);

const ROLE_CATALOG: RoleKey[] = [
  'Primary Ball Handler',
  'Secondary Creator',
  'Defensive Guard',
  'Offensive Hub',
  '3&D Wing',
  'Scoring Wing',
  'Secondary Playmaker',
  'Glue Guy',
  'Slasher',
  'Floor Spacer',
  'Stretch 4',
  'Physical 4',
  'Rim Protector',
  'Roll Man',
  'Stretch 5',
  'Energy Big',
];

const POSITION_ORDER: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

type RosterPlayer = TeamSeasonStat['roster'][number];
type NormalizedRosterEntry = RosterPlayer & { positionBuckets: Position[]; basePosition: Position };

const dedupePositions = (positions: Array<Position | undefined>): Position[] => {
  const seen = new Set<Position>();
  const ordered: Position[] = [];
  positions.forEach(pos => {
    if (!pos) return;
    if (seen.has(pos)) return;
    seen.add(pos);
    ordered.push(pos);
  });
  return ordered;
};

const POSITION_BASE_SCORES: Record<Position, number> = {
  PG: -0.15,
  SG: -0.05,
  SF: 0,
  PF: 0.1,
  C: 0.2,
};

const ROLE_POSITION_HINTS: Record<RoleKey, Partial<Record<Position, number>>> = {
  'Primary Ball Handler': { PG: 0.9 },
  'Secondary Creator': { PG: 0.5, SG: 0.4 },
  'Defensive Guard': { PG: 0.4, SG: 0.6 },
  'Offensive Hub': { SF: 0.4, PF: 0.3 },
  '3&D Wing': { SG: 0.3, SF: 0.6 },
  'Scoring Wing': { SG: 0.4, SF: 0.5 },
  'Secondary Playmaker': { PG: 0.4, SG: 0.3, SF: 0.2 },
  'Glue Guy': { SF: 0.4, PF: 0.2 },
  'Slasher': { SG: 0.5, SF: 0.4 },
  'Floor Spacer': { SG: 0.3, SF: 0.3, PF: 0.2 },
  'Stretch 4': { PF: 0.9, SF: 0.2 },
  'Physical 4': { PF: 0.9, C: 0.3 },
  'Rim Protector': { C: 1 },
  'Roll Man': { C: 0.7, PF: 0.4 },
  'Stretch 5': { C: 0.9, PF: 0.4 },
  'Energy Big': { PF: 0.6, C: 0.5 },
};

const getRoleBias = (roles: RoleKey[], position: Position) =>
  roles.reduce((score, role) => score + (ROLE_POSITION_HINTS[role]?.[position] ?? 0), 0);

const resolveRosterPosition = (player: NormalizedRosterEntry): Position => {
  const buckets = player.positionBuckets.length > 0 ? player.positionBuckets : [player.basePosition];
  let bestPosition = player.basePosition;
  let bestScore = -Infinity;

  buckets.forEach((candidate, index) => {
    let score = POSITION_BASE_SCORES[candidate] ?? 0;
    score -= index * 0.1;
    score += getRoleBias(player.roleKeys, candidate);
    if (candidate === player.basePosition) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      bestPosition = candidate;
    }
  });

  return bestPosition;
};

// Az adapter játékosonként egy sort ad (a cserélt játékosnál csapatonként külön), ezért
// az ASEStats összevonó lépése (azonos játékos több sora) kiesett.
const normalizeRoster = (roster: RosterPlayer[]): Array<NormalizedRosterEntry & { position: Position }> =>
  roster.map(player => {
    const entry: NormalizedRosterEntry = {
      ...player,
      positionBuckets: dedupePositions([...(player.positionBuckets ?? []), player.position]),
      basePosition: player.position,
    };
    return { ...entry, position: resolveRosterPosition(entry) };
  });

const percentileFromThresholds = (value: number, p10: number, p90: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) return 50;
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const percentileLabel = (score: number) => {
  if (score >= 80) return 'Liga elit';
  if (score >= 60) return 'Liga felett';
  if (score >= 40) return 'Liga átlag';
  if (score >= 20) return 'Liga alatt';
  return 'Liga gyenge';
};

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

const getTempoDescriptor = (paceScore: number) => {
  if (paceScore <= 15) {
    return {
      label: 'rendkívül lassú tempójú',
      note: 'Ez kontrollált félpályás ritmust ad, de hátrányból nehezebb tempót váltani.',
    };
  }
  if (paceScore <= 35) {
    return {
      label: 'lassú tempójú',
      note: 'Ez inkább félpályás döntéshozatalt erősít, mint tranzíciós nyomást.',
    };
  }
  if (paceScore >= 85) {
    return {
      label: 'rendkívül gyors tempójú',
      note: 'Ez sok nyílt pályás helyzetet generál, de nagyobb varianciával jár.',
    };
  }
  if (paceScore >= 65) {
    return {
      label: 'gyors tempójú',
      note: 'A csapat ritmusa kedvez a korai támadásoknak és a tranzíciós pontoknak.',
    };
  }
  return {
    label: 'közepes tempójú',
    note: 'A ritmusuk rugalmas, nem kizárólag félpályás vagy tranzíciós identitású.',
  };
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
    case 'dreb_rate':
      return team.dreb + team.opponent.oreb > 0 ? team.dreb / (team.dreb + team.opponent.oreb) : 0;
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
    case 'ortg':
      return team.ortg;
    case 'drtg':
      return team.drtg;
    case 'net_rtg':
      return team.netRtg;
    case 'val_per_game':
      return team.valPerGame;
    case 'opp2_pct':
      return team.opp2Pct;
    case 'opp3_pct':
      return team.opp3Pct;
    case 'opp_to_rate':
      return team.oppTurnoverRate;
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

const possessionsOf = (side: { fga: number; fta: number; tov: number; oreb: number }) =>
  estimatePossessions({ fga: side.fga, fta: side.fta, turnovers: side.tov, offensiveRebounds: side.oreb });

export const normalizeTeamStats = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const opponentFga = raw.opponent.fga2 + raw.opponent.fga3;
  // Közös birtoklásszám: (saját + ellenfél) / 2 (T14); a tempó 48 percre vetített.
  const sharedPossessions =
    (possessionsOf({ fga, fta: raw.fta, tov: raw.tov, oreb: raw.oreb })
      + possessionsOf({ fga: opponentFga, fta: raw.opponent.fta, tov: raw.opponent.tov, oreb: raw.opponent.oreb })) / 2;
  const pace = raw.gameMinutes > 0 ? (sharedPossessions / raw.gameMinutes) * REGULATION_MINUTES : 0;
  const ortg = ratingPer100(raw.pointsFor, sharedPossessions);
  const drtg = ratingPer100(raw.pointsAgainst, sharedPossessions);
  const netRtg = sharedPossessions > 0 ? ortg - drtg : 0;
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  const turnoverRate = turnoverPct(raw.tov, fga, raw.fta) / 100;
  const orebRate = offensiveReboundPct(raw.oreb, raw.opponent.dreb) / 100;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = shootingPct(raw.fgm3, raw.fga3);
  const ftRate = freeThrowRate(raw.ftm, fga);
  const efg = effectiveFgPct(fgm, raw.fgm3, fga);
  const valPerGame = raw.val / games;
  const opp2Pct = shootingPct(raw.opponent.fgm2, raw.opponent.fga2);
  const opp3Pct = shootingPct(raw.opponent.fgm3, raw.opponent.fga3);
  const oppTurnoverRate = turnoverPct(raw.opponent.tov, opponentFga, raw.opponent.fta) / 100;

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
    ortg: round(ortg, 1),
    drtg: round(drtg, 1),
    netRtg: round(netRtg, 1),
    opp2Pct: round(opp2Pct, 1),
    opp3Pct: round(opp3Pct, 1),
    oppTurnoverRate: round(oppTurnoverRate, 3),
  };
};

const STAT_KEYS = [
  'pace',
  'assist_rate',
  'turnover_rate',
  'oreb_rate',
  'dreb_rate',
  'two_rate',
  'three_rate',
  'three_pct',
  'ft_rate',
  'efg',
  'ortg',
  'drtg',
  'net_rtg',
  'val_per_game',
  'opp2_pct',
  'opp3_pct',
  'opp_to_rate',
  'stl_per_game',
  'blk_per_game',
  'fouls_per_game',
];

const getBenchmarkThreshold = (benchmarks: TeamBenchmarks, stat: string, pct: keyof BenchmarkPercentiles) =>
  benchmarks[stat]?.[pct] ?? 0;

const getPercentileScore = (benchmarks: TeamBenchmarks, team: NormalizedTeamStats, stat: string) => {
  const p10 = getBenchmarkThreshold(benchmarks, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, stat, 'P90');
  const value = getStatValue(team, stat);
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const getPerformanceScore = (benchmarks: TeamBenchmarks, team: NormalizedTeamStats, stat: string) => {
  const rawScore = getPercentileScore(benchmarks, team, stat);
  return LOWER_BETTER_STATS.has(stat) ? 100 - rawScore : rawScore;
};

const getLeagueMeta = (benchmarks: TeamBenchmarks) => benchmarks._meta;

const getClusterLabel = (inputs: {
  paceScore: number;
  twoRateScore: number;
  threeRateScore: number;
  assistScore: number;
  pressureScore: number;
}) => {
  const { paceScore, twoRateScore, threeRateScore, assistScore, pressureScore } = inputs;

  if (paceScore >= 70 && pressureScore >= 60) return 'Transition-heavy';
  if (paceScore >= 60 && twoRateScore >= 60) return 'Gyors, belső fókuszú';
  if (paceScore <= 40 && threeRateScore >= 60) return 'Lassú, periméter-fókuszú';
  if (paceScore <= 45 && assistScore >= 60) return 'Halfcourt, playmaker-domináns';
  if (pressureScore >= 70 && paceScore <= 55) return 'Defense-first';

  const fallbackScores: [string, number][] = [
    ['pressure', pressureScore],
    ['pace', paceScore],
    ['two_rate', twoRateScore],
    ['three_rate', threeRateScore],
    ['assist', assistScore],
  ];
  const [topKey] = fallbackScores.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (topKey === 'pressure') return 'Defense-first';
  if (topKey === 'pace') return 'Transition-heavy';
  if (topKey === 'two_rate') return 'Gyors, belső fókuszú';
  if (topKey === 'three_rate') return 'Lassú, periméter-fókuszú';
  return 'Halfcourt, playmaker-domináns';
};

const scoreAbove = (benchmarks: TeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) >= score;

const scoreBelow = (benchmarks: TeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) <= score;

const performanceAbove = (benchmarks: TeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPerformanceScore(benchmarks, team, stat) >= score;

const performanceBelow = (benchmarks: TeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPerformanceScore(benchmarks, team, stat) <= score;

const buildRosterSummary = (team: NormalizedTeamStats) => {
  const normalizedRoster = normalizeRoster(team.roster);
  const totalMinutes = normalizedRoster.reduce((sum, player) => sum + (player.minutes || 0), 0) || 1;

  const positionMinutesShare: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  const positionPlayers: Record<Position, Array<{ name: string; minutes: number }>> = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  };

  const roleCounts: Record<string, number> = ROLE_CATALOG.reduce((acc, role) => {
    acc[role] = 0;
    return acc;
  }, {} as Record<string, number>);
  const rolePlayers: Record<string, string[]> = ROLE_CATALOG.reduce((acc, role) => {
    acc[role] = [];
    return acc;
  }, {} as Record<string, string[]>);

  const getPositionAllocation = (player: NormalizedRosterEntry & { position: Position }): Array<{ position: Position; share: number }> => {
    const candidates = dedupePositions([player.position, ...player.positionBuckets]);
    const secondary = candidates.find(pos => pos !== player.position);
    if (!secondary) return [{ position: player.position, share: 1 }];

    // Hibrid felosztás az 1–2 poszton játszóknál (pl. PG/SG, SG/SF).
    return [
      { position: player.position, share: 0.65 },
      { position: secondary, share: 0.35 },
    ];
  };

  normalizedRoster.forEach(player => {
    getPositionAllocation(player).forEach(allocation => {
      const weightedMinutes = (player.minutes || 0) * allocation.share;
      positionMinutesShare[allocation.position] += weightedMinutes;
      positionPlayers[allocation.position].push({ name: player.name, minutes: weightedMinutes });
    });

    player.roleKeys.forEach(role => {
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
      if (!rolePlayers[role]) rolePlayers[role] = [];
      rolePlayers[role].push(player.name);
    });
  });

  POSITION_ORDER.forEach(pos => {
    positionMinutesShare[pos] = round((positionMinutesShare[pos] / totalMinutes) * 100, 1);
  });

  const sortedUsage = normalizedRoster
    .map(player => player.usageProxy)
    .filter(value => Number.isFinite(value))
    .sort((a, b) => b - a);
  const totalUsage = sortedUsage.reduce((sum, value) => sum + value, 0) || 1;
  const top2Usage = sortedUsage.slice(0, 2).reduce((sum, value) => sum + value, 0);
  const top2UsageShare = round(top2Usage / totalUsage, 3);

  const creatorRoles: RoleKey[] = ['Primary Ball Handler', 'Secondary Creator', 'Secondary Playmaker'];
  const creatorCount = normalizedRoster.filter(player => player.roleKeys.some(role => creatorRoles.includes(role))).length;

  const positionPlayerNames = (Object.keys(positionPlayers) as Position[]).reduce(
    (acc, pos) => {
      acc[pos] = positionPlayers[pos]
        .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))
        .map(entry => entry.name);
      return acc;
    },
    { PG: [], SG: [], SF: [], PF: [], C: [] } as Record<Position, string[]>,
  );

  return {
    positionMinutesShare,
    roleCounts,
    rolePlayers,
    top2UsageShare,
    creatorCount,
    positionPlayers: positionPlayerNames,
    totalMinutes,
  };
};

type RosterBase = ReturnType<typeof buildRosterSummary>;
type RosterSummary = RosterBase & { flags: RosterFlags };

const usageScoreOf = (roster: RosterBase, benchmarks: TeamBenchmarks) => {
  const leagueMeta = getLeagueMeta(benchmarks);
  return leagueMeta ? percentileFromThresholds(roster.top2UsageShare, leagueMeta.usageP10, leagueMeta.usageP90) : 50;
};

const frontcourtScoreOf = (roster: RosterBase, benchmarks: TeamBenchmarks) => {
  const leagueMeta = getLeagueMeta(benchmarks);
  const presence = (roster.positionMinutesShare.PF + roster.positionMinutesShare.C) / 100;
  return leagueMeta
    ? percentileFromThresholds(presence, leagueMeta.frontcourtPresenceP10, leagueMeta.frontcourtPresenceP90)
    : 50;
};

const withFlags = (roster: RosterBase, benchmarks: TeamBenchmarks): RosterSummary => ({
  ...roster,
  flags: {
    scorerDependency: usageScoreOf(roster, benchmarks) >= SCORER_DEPENDENCY_PERCENTILE,
    lowPlaymakingDepth: roster.creatorCount < MIN_CREATORS,
    weakReboundingPresence: frontcourtScoreOf(roster, benchmarks) <= WEAK_FRONTCOURT_PERCENTILE,
  },
});

const pressureScoreOf = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks) =>
  getPercentileScore(benchmarks, team, 'opp_to_rate');

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): TeamBenchmarks => {
  const pool = teams.map(normalizeTeamStats);
  const rosterSummaries = pool.map(team => ({ team, roster: buildRosterSummary(team) }));

  const usageShares = rosterSummaries
    .map(entry => entry.roster.top2UsageShare)
    .filter(value => Number.isFinite(value))
    .sort((a, b) => a - b);
  const frontcourtPresence = rosterSummaries
    .map(entry => (entry.roster.positionMinutesShare.PF + entry.roster.positionMinutesShare.C) / 100)
    .filter(value => Number.isFinite(value))
    .sort((a, b) => a - b);

  const usageP10 = round(quantile(usageShares, 0.1), 3);
  const usageP90 = round(quantile(usageShares, 0.9), 3);
  const frontcourtPresenceP10 = round(quantile(frontcourtPresence, 0.1), 3);
  const frontcourtPresenceP90 = round(quantile(frontcourtPresence, 0.9), 3);

  const benchmarks: TeamBenchmarks = {};
  STAT_KEYS.forEach(stat => {
    const values = pool
      .map(team => getStatValue(team, stat))
      .filter(v => Number.isFinite(v))
      .sort((a, b) => a - b);
    benchmarks[stat] = {
      P10: round(quantile(values, 0.1), 3),
      P25: round(quantile(values, 0.25), 3),
      P40: round(quantile(values, 0.4), 3),
      P50: round(quantile(values, 0.5), 3),
      P60: round(quantile(values, 0.6), 3),
      P75: round(quantile(values, 0.75), 3),
      P90: round(quantile(values, 0.9), 3),
    };
  });

  const clusterCounts: Record<string, number> = {};
  const clusterMembers: Record<string, Array<{ teamId: string; teamName: string }>> = {};
  rosterSummaries.forEach(entry => {
    const cluster = getClusterLabel({
      paceScore: getPercentileScore(benchmarks, entry.team, 'pace'),
      twoRateScore: getPercentileScore(benchmarks, entry.team, 'two_rate'),
      threeRateScore: getPercentileScore(benchmarks, entry.team, 'three_rate'),
      assistScore: getPercentileScore(benchmarks, entry.team, 'assist_rate'),
      pressureScore: pressureScoreOf(entry.team, benchmarks),
    });
    clusterCounts[cluster] = (clusterCounts[cluster] ?? 0) + 1;
    if (!clusterMembers[cluster]) clusterMembers[cluster] = [];
    clusterMembers[cluster].push({ teamId: entry.team.teamId, teamName: entry.team.teamName });
  });

  benchmarks._meta = {
    teamCount: pool.length,
    usageP10,
    usageP90,
    frontcourtPresenceP10,
    frontcourtPresenceP90,
    clusterCounts,
    clusterMembers,
  };
  return benchmarks;
};

const getShotProfileDescriptor = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks) => {
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');

  if (Math.abs(team.twoRate - team.threeRate) <= 0.08) {
    if (threePctScore >= 75 && threeRateScore <= 40) {
      return 'Kiegyensúlyozott belső-külső megoszlás, elit triplaminőséggel, de konzervatív külső volumennel.';
    }
    return 'Kiegyensúlyozott belső-külső támadási profil.';
  }

  if (twoRateScore >= 70 && team.ftRate >= INTERIOR_FT_RATE_MIN) {
    return 'Belső hangsúlyú támadási profil, gyűrű- és fault-nyomással.';
  }

  if (threeRateScore >= 65 && threePctScore >= 60) {
    return 'Periméter-hangsúlyú támadási profil, hatékony külső kivitelezéssel.';
  }

  if (threePctScore >= 75 && threeRateScore <= 40) {
    return 'Szelektív shot profile: a tripla minősége erős, a volumene visszafogott.';
  }

  return twoRateScore > threeRateScore
    ? 'Enyhén belső orientációjú támadási profil.'
    : 'Enyhén periméter orientációjú támadási profil.';
};

const getPlaymakingDescriptor = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks, roster: RosterBase) => {
  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  const usageScore = usageScoreOf(roster, benchmarks);
  const offensiveHubCount = roster.roleCounts['Offensive Hub'] || 0;

  if (assistScore >= 60 && usageScore <= 35) {
    return 'Committee-based playmaking: nincs domináns high-usage hub, a labdajáratás kollektív.';
  }
  if (assistScore >= 60 && offensiveHubCount > 0) {
    return 'A támadó kapcsolódás stabil, van hub-jellegű összekötő pont a rendszerben.';
  }
  if (assistScore <= 40 && offensiveHubCount === 0) {
    return 'A támadó kapcsolódás sérülékenyebb, kevés a stabil összekötő playmaking pont.';
  }
  return 'A playmaking inkább vegyes modellre épül, nem egyetlen első opcióra.';
};

const buildDefensiveProfile = (
  team: NormalizedTeamStats,
  benchmarks: TeamBenchmarks,
  roster: RosterBase,
): TeamAnalysis['defensiveProfile'] => {
  const rimProtectionScore = getPerformanceScore(benchmarks, team, 'opp2_pct');
  const perimeterDefenseScore = getPerformanceScore(benchmarks, team, 'opp3_pct');
  const foulDisciplineScore = getPerformanceScore(benchmarks, team, 'fouls_per_game');
  const rimProtectors = roster.roleCounts['Rim Protector'] || 0;
  const defensiveGuards = roster.roleCounts['Defensive Guard'] || 0;

  const rimProtection = rimProtectionScore >= 60
    ? 'Erős gyűrűvédekezés'
    : rimProtectionScore <= 40
      ? 'Sebezhető gyűrűvédekezés'
      : 'Közepes gyűrűvédekezés';

  const perimeterDefense = perimeterDefenseScore >= 60
    ? 'Stabil perimétervédekezés'
    : perimeterDefenseScore <= 40
      ? 'Sebezhető perimétervédekezés'
      : 'Közepes perimétervédekezés';

  // Az ASEStats abszolút küszöbei (0,74 / 0,63) FIBA-hoz hangoltak: az NBA-ban a
  // védelmi lepattanó-arány 0,70–0,80 közt mozog, és gyenge sosem lenne. Percentilis.
  const drebScore = getPercentileScore(benchmarks, team, 'dreb_rate');
  const rebounding = drebScore >= 60
    ? 'Erős védelmi lepattanózás'
    : drebScore <= 40
      ? 'Gyenge védelmi lepattanózás'
      : 'Átlagos védelmi lepattanózás';

  const foulDiscipline = foulDisciplineScore >= 60
    ? 'Fegyelmezett fault-menedzsment'
    : foulDisciplineScore <= 40
      ? 'Fault-terhelés kockázat'
      : 'Közepes fault-discipline';

  const notes: string[] = [];
  if (rimProtectors >= 2) notes.push('A rosterben több rim protector opció is van.');
  if (defensiveGuards === 0) notes.push('Dedikált defensive guard hiányában a periméter-matchupok érzékenyebbek lehetnek.');

  return { rimProtection, perimeterDefense, rebounding, foulDiscipline, notes };
};

const detectTeamStyle = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks): TeamStyle => {
  const offense: string[] = [];
  const defense: string[] = [];

  if (
    scoreAbove(benchmarks, team, 'pace', 75)
    && (scoreAbove(benchmarks, team, 'stl_per_game', 60) || scoreAbove(benchmarks, team, 'opp_to_rate', 60))
  ) {
    offense.push(OFFENSE_STYLE_LABELS.transition);
  }
  if (scoreBelow(benchmarks, team, 'pace', 40) && scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    offense.push(OFFENSE_STYLE_LABELS.halfcourt);
  }
  if (scoreAbove(benchmarks, team, 'three_rate', 60) && scoreAbove(benchmarks, team, 'three_pct', 60)) {
    offense.push(OFFENSE_STYLE_LABELS.perimeter);
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 70) && scoreAbove(benchmarks, team, 'ft_rate', 60) && scoreBelow(benchmarks, team, 'three_rate', 45)) {
    offense.push(OFFENSE_STYLE_LABELS.interior);
  }

  if (scoreAbove(benchmarks, team, 'stl_per_game', 60) && scoreAbove(benchmarks, team, 'opp_to_rate', 60)) {
    defense.push(DEFENSE_STYLE_LABELS.pressure);
  }
  if (scoreBelow(benchmarks, team, 'fouls_per_game', 40) && scoreBelow(benchmarks, team, 'pace', 40)) {
    defense.push(DEFENSE_STYLE_LABELS.disciplined);
  }
  if (scoreAbove(benchmarks, team, 'blk_per_game', 60) && performanceAbove(benchmarks, team, 'opp2_pct', 60)) {
    defense.push(DEFENSE_STYLE_LABELS.rim);
  }
  if (performanceAbove(benchmarks, team, 'opp3_pct', 60)) {
    defense.push(DEFENSE_STYLE_LABELS.perimeter);
  }

  return { offense, defense };
};

const buildRosterInsights = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks, roster: RosterBase) => {
  const insights: string[] = [];

  const guardShare = roster.positionMinutesShare.PG + roster.positionMinutesShare.SG;
  const wingShare = roster.positionMinutesShare.SF;
  const bigShare = roster.positionMinutesShare.PF + roster.positionMinutesShare.C;

  if (bigShare >= 60) {
    insights.push('Erősen frontcourt-nehéz rotáció, ami matchup-specifikus méretelőnyt és mobilitási kompromisszumot is hozhat.');
  }
  if (guardShare <= 20) {
    insights.push('Kevés guard perc, a periméter-kezdeményezés korlátozott lehet.');
  }
  if (wingShare <= 10) {
    insights.push('Alacsony wing jelenlét, perimétervédekezés sebezhető lehet.');
  }

  const creators = (roster.roleCounts['Primary Ball Handler'] || 0)
    + (roster.roleCounts['Secondary Creator'] || 0)
    + (roster.roleCounts['Secondary Playmaker'] || 0);
  if (creators <= 1) {
    insights.push('Kevés elsődleges/second playmaker, támadás könnyen beszűkülhet.');
  }
  if (creators >= 2 && getPercentileScore(benchmarks, team, 'assist_rate') >= 60) {
    insights.push('A labdajáratás inkább megosztott playmakingre épül, nem egyetlen domináns creatorra.');
  }

  const rollMen = roster.roleCounts['Roll Man'] || 0;
  const stretchBigs = (roster.roleCounts['Stretch 5'] || 0) + (roster.roleCounts['Stretch 4'] || 0);
  const rimProtectors = roster.roleCounts['Rim Protector'] || 0;

  if (rollMen >= 2) {
    insights.push('Erős pick-and-roll befejező mélység (Roll Man szerepkörök).');
  }
  if (stretchBigs >= 2) {
    insights.push('Több külső dobó magas, jobb spacing potenciál.');
  }
  if (rimProtectors >= 2) {
    insights.push('Festékvédekezésben több rim protector opció.');
  }
  if ((roster.roleCounts['Glue Guy'] || 0) >= 3) {
    insights.push('Glue Guy szerepben redundancia látszik, ami percek és labda nélküli feladatok ütközését okozhatja.');
  }
  if ((roster.roleCounts['Scoring Wing'] || 0) === 0 && getPercentileScore(benchmarks, team, 'three_pct') >= 70) {
    insights.push('Wing scoring minőség van, de inkább spot-up és labdajáratás utáni helyzetekből, nem tiszta self-creationből.');
  }

  const isHighPace = scoreAbove(benchmarks, team, 'pace', 75);
  const frontcourtShare = roster.positionMinutesShare.PF + roster.positionMinutesShare.C;
  if (isHighPace && frontcourtShare < 20) {
    insights.push('A magas tempó rövid szakaszokon előnyös, azonban a frontcourt mélység hiánya miatt fenntarthatósági kockázatot hordoz 48 perces terhelésen.');
  }
  if (isHighPace && frontcourtShare >= 20) {
    insights.push('A magas tempó a roster összetétele alapján fenntartható.');
  }

  return insights;
};

const strengthLabels: Record<string, string> = {
  ortg: 'Hatékony támadás (ORTG)',
  net_rtg: 'Pozitív net rating',
  assist_rate: 'Magas assziszt-arány',
  turnover_rate: 'Labdabiztonság',
  oreb_rate: 'Erős támadólepattanózás',
  two_rate: 'Magas 2P-arány',
  three_rate: 'Magas triplavolumen',
  three_pct: 'Magas 3P%',
  ft_rate: 'Sok büntető',
  efg: 'Hatékony dobás',
  val_per_game: 'Magas VAL',
  opp2_pct: 'Festékvédekezés',
  opp3_pct: 'Perimétervédekezés',
  opp_to_rate: 'Labdaszerzés/nyomás',
};

const limitationLabels: Record<string, string> = {
  drtg: 'Sebezhető védekezés (DRTG)',
  net_rtg: 'Negatív net rating',
  assist_rate: 'Alacsony assziszt-arány',
  turnover_rate: 'Magas eladott labda arány',
  oreb_rate: 'Gyenge támadólepattanózás',
  two_rate: 'Alacsony 2P-arány',
  three_rate: 'Alacsony triplavolumen',
  three_pct: 'Alacsony 3P%',
  ft_rate: 'Kevés büntető',
  efg: 'Alacsony dobáshatékonyság',
  val_per_game: 'Alacsony VAL',
  opp2_pct: 'Festék sebezhető',
  opp3_pct: 'Periméter sebezhető',
};

const buildStrengths = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks) => {
  const strengths = Object.keys(strengthLabels)
    .filter(stat => performanceAbove(benchmarks, team, stat, 60))
    .map(stat => strengthLabels[stat])
    .slice(0, 4);

  if (getPercentileScore(benchmarks, team, 'pace') >= 80) {
    strengths.unshift('Magas tempó');
  }

  return strengths.slice(0, 4);
};

const buildLimitations = (team: NormalizedTeamStats, benchmarks: TeamBenchmarks) => {
  const limitations = Object.keys(limitationLabels)
    .filter(stat => performanceBelow(benchmarks, team, stat, 40))
    .map(stat => limitationLabels[stat])
    .slice(0, 4);

  if (getPercentileScore(benchmarks, team, 'pace') <= 20) {
    limitations.unshift('Rendkívül lassú tempó');
  }

  return limitations.slice(0, 4);
};

const buildRiskPriorities = (
  team: NormalizedTeamStats,
  benchmarks: TeamBenchmarks,
  roster: RosterBase,
  limitations: string[],
) => {
  const risks: Array<{ label: string; weight: number }> = [];

  const positionMinuteRiskThresholds: Record<Position, { critical: number; warning: number; baseWeight: number }> = {
    PG: { critical: 11, warning: 16, baseWeight: 3 },
    SG: { critical: 9, warning: 14, baseWeight: 3 },
    SF: { critical: 10, warning: 15, baseWeight: 2 },
    PF: { critical: 8, warning: 13, baseWeight: 2 },
    C: { critical: 8, warning: 12, baseWeight: 2 },
  };

  const positionRiskDetails: Record<Position, string> = {
    PG: 'szervezés és tempó menedzsment',
    SG: 'periméter scoring',
    SF: 'perimétervédekezés és méret',
    PF: 'fizikalitás és lepattanózás',
    C: 'lepattanó és rim defense',
  };

  (Object.keys(roster.positionMinutesShare) as Position[]).forEach(pos => {
    const share = roster.positionMinutesShare[pos];
    const threshold = positionMinuteRiskThresholds[pos];
    if (share < threshold.critical) {
      risks.push({
        label: `${pos === 'C' ? 'Center' : pos} hiány → ${positionRiskDetails[pos]}`,
        weight: threshold.baseWeight + 1,
      });
    } else if (share < threshold.warning) {
      risks.push({
        label: `${pos === 'C' ? 'Center' : pos} szűk rotáció → ${positionRiskDetails[pos]}`,
        weight: threshold.baseWeight,
      });
    }
  });

  const roleRiskDetails: Record<RoleKey, string> = {
    'Primary Ball Handler': 'szervezés limit',
    'Secondary Creator': 'secondary playmaking hiány',
    'Secondary Playmaker': 'másodlagos szervezés hiány',
    'Defensive Guard': 'periméter védekezés limit',
    '3&D Wing': 'kétoldalú wing hiány',
    'Scoring Wing': 'periméter scoring limit',
    'Offensive Hub': 'támadó kapcsolódás limit',
    'Glue Guy': 'kiegészítő szerepek hiánya',
    'Slasher': 'gyűrűtámadás limit',
    'Floor Spacer': 'spacing limit',
    'Stretch 4': 'spacing a magas posztokon',
    'Stretch 5': 'spacing a center poszton',
    'Physical 4': 'fizikalitás hiány',
    'Rim Protector': 'gyűrűvédekezés limit',
    'Roll Man': 'pick-and-roll befejezés limit',
    'Energy Big': 'energia/lepattanó limit',
  };

  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const usageScore = usageScoreOf(roster, benchmarks);

  ROLE_CATALOG.forEach(role => {
    if ((roster.roleCounts[role] ?? 0) === 0) {
      if (role === 'Offensive Hub' && assistScore >= 60 && usageScore <= 35) return;
      if (role === 'Scoring Wing' && threePctScore >= 70) {
        risks.push({
          label: 'Wing self-creation limit → spot-up minőség van, izolációs önteremtés kevésbé',
          weight: threeRateScore <= 40 ? 2 : 1,
        });
        return;
      }
      risks.push({
        label: `${role} hiány → ${roleRiskDetails[role] ?? 'taktikai opció nem elérhető'}`,
        weight: role === 'Offensive Hub' ? 2 : 3,
      });
    }
  });

  const limitationRiskDetails: Record<string, { detail: string; weight: number }> = {
    'Alacsony triplavolumen': { detail: 'spacing limit', weight: 2 },
    'Alacsony 3P%': { detail: 'spacing limit', weight: 2 },
    'Alacsony dobáshatékonyság': { detail: 'pontszerzés ingadozó', weight: 2 },
    'Kevés büntető': { detail: 'könnyű pontok hiánya', weight: 2 },
    'Alacsony 2P-arány': { detail: 'festékjáték limit', weight: 2 },
    'Gyenge támadólepattanózás': { detail: 'második esélyek hiánya', weight: 2 },
    'Magas eladott labda arány': { detail: 'labdabiztonság kockázat', weight: 2 },
    'Alacsony assziszt-arány': { detail: 'támadási flow limit', weight: 2 },
    'Alacsony VAL': { detail: 'összteljesítmény limit', weight: 2 },
    'Rendkívül lassú tempó': { detail: 'matchup-függő tempókényszer kockázat', weight: 1 },
    'Festék sebezhető': { detail: 'rim defense kockázat', weight: 1 },
    'Periméter sebezhető': { detail: 'perimétervédekezés kockázat', weight: 1 },
  };

  limitations.forEach(limitation => {
    const entry = limitationRiskDetails[limitation] ?? { detail: 'kontextusfüggő', weight: 1 };
    risks.push({ label: `${limitation} → ${entry.detail}`, weight: entry.weight });
  });

  const topRisks = risks
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  if (topRisks.length === 0) return [];

  return [
    'Legmagasabb kockázat:',
    ...topRisks.map((risk, index) => `${index + 1}. ${risk.label}`),
  ];
};

const buildSummary = (
  team: NormalizedTeamStats,
  style: TeamStyle,
  roster: RosterSummary,
  rosterInsights: string[],
  riskPriorities: string[],
  benchmarks: TeamBenchmarks,
) => {
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const tempo = getTempoDescriptor(paceScore);
  const offenseSentence = style.offense[0]
    ? `${style.offense[0].toLowerCase()} fókuszú támadást játszik`
    : 'kiegyensúlyozott támadást játszik';
  const shotProfile = getShotProfileDescriptor(team, benchmarks);
  const playmakingProfile = getPlaymakingDescriptor(team, benchmarks, roster);
  const defensiveProfile = buildDefensiveProfile(team, benchmarks, roster);
  const defense = style.defense[0] ?? 'kiegyensúlyozott védekezés';
  const turnoverProfile = performanceAbove(benchmarks, team, 'turnover_rate', 60)
    ? 'A labdabiztonság csapatszinten stabil.'
    : performanceBelow(benchmarks, team, 'turnover_rate', 40)
      ? 'A labdabiztonság csapatszinten sérülékenyebb.'
      : 'A labdabiztonság közepes szinten áll.';

  const rosterNotes: string[] = [];
  if (roster.flags.scorerDependency) rosterNotes.push('magas a top2 usage koncentráció');
  if (roster.flags.lowPlaymakingDepth) rosterNotes.push('kevés a playmaking mélység');
  if (roster.flags.weakReboundingPresence) rosterNotes.push('korlátozott a magas posztok jelenléte');

  const rosterSentence = rosterNotes.length > 0
    ? `Roster szempontból ${rosterNotes.join(', ')}.`
    : riskPriorities.length > 0
      ? 'Roster szempontból vannak kezelendő szerepkockázatok.'
      : 'Roster szempontból nincs kiugró kockázat.';

  const rosterInsightSentence = rosterInsights.length > 0
    ? ` ${rosterInsights.slice(0, 2).join(' ')}`
    : '';

  const defenseNote = defensiveProfile.notes.length > 0 ? ` ${defensiveProfile.notes.join(' ')}` : '';

  const leagueMeta = getLeagueMeta(benchmarks);
  const percentileNotes: string[] = [];
  percentileNotes.push(`A csapat tempója ${percentileLabel(paceScore).toLowerCase()} (${round(paceScore, 0)}. percentilis).`);

  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  percentileNotes.push(`2P arány ${percentileLabel(twoRateScore).toLowerCase()} (${round(twoRateScore, 0)}. percentilis).`);

  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  percentileNotes.push(`3P arány ${percentileLabel(threeRateScore).toLowerCase()} (${round(threeRateScore, 0)}. percentilis).`);

  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  percentileNotes.push(`3P% ${percentileLabel(threePctScore).toLowerCase()} (${round(threePctScore, 0)}. percentilis).`);

  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');
  percentileNotes.push(`FT rate ${percentileLabel(ftRateScore).toLowerCase()} (${round(ftRateScore, 0)}. percentilis).`);

  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  percentileNotes.push(`Assist rate ${percentileLabel(assistScore).toLowerCase()} (${round(assistScore, 0)}. percentilis).`);

  const usageScore = usageScoreOf(roster, benchmarks);
  percentileNotes.push(`Usage koncentráció ${percentileLabel(usageScore).toLowerCase()} (${round(usageScore, 0)}. percentilis).`);

  const frontcourtScore = frontcourtScoreOf(roster, benchmarks);
  percentileNotes.push(`Frontcourt jelenlét ${percentileLabel(frontcourtScore).toLowerCase()} (${round(frontcourtScore, 0)}. percentilis).`);

  const cluster = getClusterLabel({
    paceScore,
    twoRateScore,
    threeRateScore,
    assistScore,
    pressureScore: pressureScoreOf(team, benchmarks),
  });
  const clusterCount = leagueMeta?.clusterCounts?.[cluster] ?? null;
  const clusterNote = clusterCount && leagueMeta?.teamCount
    ? `A csapat a liga '${cluster}' klaszterébe tartozik (${clusterCount}/${leagueMeta.teamCount} csapat).`
    : `A csapat a liga '${cluster}' klaszterébe tartozik.`;

  const netRtgNote = team.ortg > 0 && team.drtg > 0
    ? `Net rating: ${team.netRtg >= 0 ? '+' : ''}${team.netRtg} (ORTG: ${team.ortg}, DRTG: ${team.drtg}).`
    : '';

  return `A csapat ${tempo.label}, ${offenseSentence}. ${tempo.note} ${shotProfile} ${playmakingProfile} ${turnoverProfile} Védekezésben ${defense.toLowerCase()} karakterű, különösen ${defensiveProfile.rimProtection.toLowerCase()} és ${defensiveProfile.perimeterDefense.toLowerCase()} olvasható ki. ${rosterSentence}${rosterInsightSentence} ${netRtgNote} ${percentileNotes.join(' ')} ${clusterNote}${defenseNote}`.trim();
};

const buildLeagueProfile = (
  team: NormalizedTeamStats,
  roster: RosterBase,
  benchmarks: TeamBenchmarks,
): TeamAnalysis['leagueProfile'] => {
  const leagueMeta = getLeagueMeta(benchmarks);
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');
  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  const ortgScore = getPercentileScore(benchmarks, team, 'ortg');
  const drtgPerfScore = getPerformanceScore(benchmarks, team, 'drtg'); // fordított: alacsony DRtg a jó
  const netRtgScore = getPercentileScore(benchmarks, team, 'net_rtg');
  const usageScore = usageScoreOf(roster, benchmarks);
  const frontcourtPresence = (roster.positionMinutesShare.PF + roster.positionMinutesShare.C) / 100;
  const frontcourtScore = frontcourtScoreOf(roster, benchmarks);
  const displayPercentile = (score: number) => clamp(score, 5, 95);

  const clusterLabel = getClusterLabel({
    paceScore,
    twoRateScore,
    threeRateScore,
    assistScore,
    pressureScore: pressureScoreOf(team, benchmarks),
  });

  const clusterPeers = (leagueMeta?.clusterMembers?.[clusterLabel] ?? [])
    .filter(entry => entry.teamId !== team.teamId)
    .map(entry => entry.teamName)
    .slice(0, 4);

  const entry = (key: string, label: string, score: number, value: number) => ({
    key,
    label,
    percentile: round(displayPercentile(score), 0),
    value,
    tier: percentileLabel(score),
  });

  return {
    entries: [
      entry('pace', 'Tempó', paceScore, team.pace),
      entry('two_rate', '2P arány', twoRateScore, team.twoRate),
      entry('three_rate', '3P arány', threeRateScore, team.threeRate),
      entry('three_pct', '3P%', threePctScore, team.threePct),
      entry('ft_rate', 'FT rate', ftRateScore, team.ftRate),
      entry('assist_rate', 'Assist rate', assistScore, team.assistRate),
      entry('usage_concentration', 'Usage koncentráció', usageScore, roster.top2UsageShare),
      entry('frontcourt_presence', 'Frontcourt jelenlét', frontcourtScore, frontcourtPresence),
      entry('ortg', 'Offenzív rating', ortgScore, team.ortg),
      entry('drtg', 'Defenzív rating', drtgPerfScore, team.drtg),
      entry('net_rtg', 'Net rating', netRtgScore, team.netRtg),
    ],
    clusterLabel,
    clusterCount: leagueMeta?.clusterCounts?.[clusterLabel] ?? null,
    teamCount: leagueMeta?.teamCount ?? null,
    clusterPeers,
  };
};

export const analyzeTeamSeason = (raw: TeamSeasonStat, benchmarks: TeamBenchmarks): TeamAnalysis => {
  const normalized = normalizeTeamStats(raw);
  const style = detectTeamStyle(normalized, benchmarks);
  const rosterSummary = withFlags(buildRosterSummary(normalized), benchmarks);
  const strengths = buildStrengths(normalized, benchmarks);
  const limitations = buildLimitations(normalized, benchmarks);
  const leagueProfile = buildLeagueProfile(normalized, rosterSummary, benchmarks);

  // Az ASEStats a klasztert „Liga-klaszter: …” címkeként a támadási stílusok közé is
  // betette, így az összefoglaló első mondatába került; itt a klaszter a `leagueProfile`-ban van.
  const riskPriorities = buildRiskPriorities(normalized, benchmarks, rosterSummary, limitations);
  const insights = buildRosterInsights(normalized, benchmarks, rosterSummary);

  return {
    teamId: raw.teamId,
    teamName: raw.teamName,
    style,
    strengths,
    limitations,
    rosterSummary,
    rosterInsights: insights,
    // Az első elem a „Legmagasabb kockázat:” fejléc; a megjelenítés a számozott sorokat kapja.
    riskPriorities: riskPriorities.slice(1),
    leagueProfile,
    defensiveProfile: buildDefensiveProfile(normalized, benchmarks, rosterSummary),
    summary: buildSummary(normalized, style, rosterSummary, insights, riskPriorities, benchmarks),
  };
};
