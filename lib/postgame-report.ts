// A meccs utáni csapatriport motorja: az ASEStats `postgame-report` portja. Tiszta
// függvények, a sémát nem ismerik; a bemenetet az adapter (lib/adapters/postgame-adapter.ts)
// állítja elő. A riport a választott csapat nézőpontjából készül: referenciához mért
// mutatók (szezonátlag vagy kis mintánál liga medián), döntő tényezők, játékos-hatás,
// erősségek, problémák, következő fókusz, X-faktor visszacsatolás.
//
// Eltérések az ASEStatstől:
//  - a Kosarstat-függő rész (negyedek, clutch, pontforrások, `buildKosarstatPostgameContext`,
//    összefűzés) kimaradt; a `buildPostgameAutoFocus` csak a riport saját fókuszait adja;
//  - a dobástérkép (zóna-összevetés, lefedettség) és a lineup-elemzés kimaradt: az ASEStats
//    FIBA-geometriája NBA-ban nem érvényes, és nincs lineup-adat; a festékre ezért nem
//    hivatkozik a szöveg, csak a box score 2P-arányára;
//  - a „limitált hatás” lista legalább 8 (48 percre skálázva 10) perces mintát kér;
//  - a játékos-hatás percküszöbei ×1,2-vel 48 percre skálázva (a per-meccs VAL-küszöbök
//    változatlanok, lásd a progress-tracker nyitott kérdéseit);
//  - a mutatók a Csapatstatisztika definícióit követik (T14, T17): közös birtoklásszám,
//    Oliver-féle TO%, FT-mutató = FTM / FGA (az ASEStats postgame ezt már így számolta).

import type { PreGameXFactorContext } from '@/lib/pregame-scouting';
import type { PlayerPostGameReport } from '@/lib/player-postgame';
import type { Position } from '@/lib/positions';
import { USG_HIGH_MIN, USG_LOW_MAX, buildPlayerPostGameReport, computeUsageRates, isInefficientHighUsage } from '@/lib/player-postgame';

export type { Position };

export type TeamGameStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
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
  actualPointsFor?: number;
  actualPointsAgainst?: number;
  result?: 'win' | 'loss';
};

export type PlayerGameStat = {
  playerId: string;
  name: string;
  position: Position;
  isStarter?: boolean;
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

export type TeamSeasonStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
  games: number;
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
  /**
   * Az ellenfelek védő lepattanói a szezonban. Ezzel az OREB% ugyanazt a
   * definíciót követi, mint a meccsérték (T-lep / (T-lep + ellenfél V-lep));
   * hiányában a saját lepattanókból számolt közelítés marad.
   */
  oppDreb?: number;
  /**
   * Az ellenfelek birtoklásbecslése a szezonban. Megadva a tempó és az
   * ORtg / DRtg a két csapat átlagolt birtoklásszámából számol, mint a meccsen.
   */
  oppPossessions?: number;
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

/**
 * A meccsértékek referenciája. Kis szezonmintánál (kevesebb mint
 * `MIN_SEASON_BASELINE_GAMES` meccs) a szezonátlag gyakorlatilag maga a meccs,
 * ezért ilyenkor a liga medián (P50) a viszonyítási alap.
 */
export type PostgameBaseline = {
  kind: 'season' | 'league';
  seasonGames: number;
  smallSample: boolean;
  /**
   * Van-e értelmes viszonyítási alap. Kis mintánál liga benchmark nélkül a
   * szezonátlag maga a meccs – ilyenkor a szöveg nem hivatkozik referenciára.
   */
  comparable: boolean;
  /** Oszlopfejléc / címke, pl. „Szezon átl.” vagy „Liga medián (kis minta)”. */
  label: string;
  /** Szövegbe illeszthető főnév: „szezonátlag” vagy „ligamedián”. */
  noun: string;
};

/** Pont / 100 birtoklás – a birtoklás a `metrics.pace` közös (két csapat átlaga) becslése. */
export type PostgameRatings = {
  possessions: number;
  ortg: number;
  drtg: number;
  net: number;
  refPossessions: number | null;
  refOrtg: number | null;
  refDrtg: number | null;
  refNet: number | null;
  /** Melyik oldal tért el jobban a referenciától a végeredmény irányába. */
  primaryCause: 'offense' | 'defense' | 'balanced' | 'unknown';
};

/**
 * Nyers box score alapsor: dobott / kísérlet, százalék, lepattanók és a
 * számláló statisztikák. A 2P / 3P bontás és az AST / LV / St / Bl mezők régi
 * (mentett) riportobjektumban hiányoznak.
 */
export type PostgameBoxScoreLine = {
  fgm: number;
  fga: number;
  fgPct: number;
  fgm2?: number;
  fga2?: number;
  twoPct?: number;
  fgm3?: number;
  fga3?: number;
  threePct?: number;
  ftm: number;
  fta: number;
  ftPct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast?: number;
  tov?: number;
  stl?: number;
  blk?: number;
};

export type PostgameOpponentShooting = {
  efg: number;
  fgm3: number;
  fga3: number;
  threePct: number;
  ftRate: number;
  orebRate: number;
  turnoverRate: number;
};

export type PostGameReport = {
  teamId: string;
  teamName: string;
  opponentName: string;
  league: string;
  season: string;
  result: 'win' | 'loss';
  /** Opcionális a korábban mentett / régi riportobjektumok miatt. */
  baseline?: PostgameBaseline;
  metrics: {
    pointsFor: number;
    pointsAgainst: number;
    margin: number;
    pace: number;
    efg: number;
    /** `season`: a referencia értéke (szezonátlag vagy kis mintánál liga medián). */
    keyStats: PostGameMetric[];
    ratings?: PostgameRatings | null;
    opponent?: PostgameOpponentShooting | null;
    /** Box score alapmutatók (FG, FT, lepattanó); régi riportobjektumban hiányzik. */
    boxScore?: { own: PostgameBoxScoreLine; opponent: PostgameBoxScoreLine | null };
  };
  charts: {
    efficiency: PostGameChartDatum[];
    shotProfile: PostGameShotProfileDatum[];
  };
  context: {
    paceDelta: 'Higher' | 'Lower' | 'Similar';
    offenseEfficiencyDelta: 'Higher' | 'Lower' | 'Similar';
    defenseEfficiencyDelta: 'Higher' | 'Lower' | 'Similar';
    /**
     * A védekezés viszonyítása a liga mediánhoz: az ellenfél meccs-eFG%-a, a
     * kikényszerített labdavesztés (az ellenfél TO rate-je, %) és a DRtg. A
     * `defenseEfficiencyDelta` a DRtg-re épül, ha van liga-referenciája;
     * különben az eFG és a TO együttesére. `null`, ha nincs ellenfél-adat vagy
     * liga benchmark. A TO / DRtg mezők régi riportobjektumban hiányoznak.
     */
    defense?: {
      opponentEfg: number;
      leagueEfg: number;
      opponentTurnoverRate?: number;
      leagueTurnoverRate?: number | null;
      drtg?: number | null;
      leagueDrtg?: number | null;
    } | null;
  };
  dataNotes: string[];
  decisiveFactors: {
    offense: string[];
    defense: string[];
  };
  decisiveFactorAnnotations: {
    offense: string[];
    defense: string[];
  };
  decisiveFactorMeta: FactorMeta[];
  playerImpact: {
    positive: string[];
    negative: string[];
    overperformers: string[];
    underperformers: string[];
  };
  playerReport: PlayerPostGameReport;
  strengths: string[];
  problems: string[];
  nextFocus: string[];
  reflection: {
    xFactor: string;
    risk: string;
  };
  /**
   * Az összefoglaló kiegészítésektől független sorai (eredmény, tempó,
   * ratingek, ellenfél profil). A végső szöveget a `composePostgameSummary`
   * állítja össze a kész riportobjektumból, így az a fő szekciókkal egyezik.
   * Régi (mentett) riportobjektumban hiányzik.
   */
  summaryParts?: { overview: string[]; opponentProfile: string[] };
  summary: string;
};

export type PostGameInterpretation = {
  gameContext: string;
  decisiveFactors: string;
  playerImpact: string;
  strengths: string;
  problems: string;
  nextFocus: string;
  summary: string;
};

export type PostGameMetric = {
  key: string;
  label: string;
  game: number;
  season: number;
  delta: number;
  unit: 'pct' | 'count';
  leagueMedian?: number;
};

export type PostGameChartDatum = {
  label: string;
  game: number;
  season: number;
  league?: number;
};

export type PostGameShotProfileDatum = {
  label: string;
  game: number;
  season: number;
};


type FactorType = 'Hatékonyság' | 'Volumen' | 'Kontroll';

type DecisiveSeverity = 'major' | 'minor';

type FactorMeta = {
  label: string;
  annotated: string;
  type: FactorType;
  axis: 'offense' | 'defense';
  /** Explicit előjel; opcionális a korábban mentett riportok miatt. */
  tone?: 'positive' | 'negative';
  /** `opponent`: meccs-párharc; `reference`: liga medián / szezonátlag. */
  source?: 'opponent' | 'reference';
  /** `minor`: a döntő küszöb alatti, „enyhe” tényező – fókuszt nem vezet. Hiányában `major`. */
  severity?: DecisiveSeverity;
};

type MechanismStatus = {
  icon: '✓' | '↺' | '✗';
  text: string;
};

type MechanismSignal = {
  realized: boolean;
  reason?: string;
};

const REGULATION_MINUTES = 48;

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const toPct = (value: number, digits = 1) => round(value * 100, digits);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);


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

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number;
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  /** FTM / FGA (értékesített büntető / mezőnykísérlet). */
  ftRate: number;
  efg: number;
  valPerGame: number;
  /** Pont / 100 saját birtoklás; 0, ha nincs adat. */
  ortg: number;
  /** Kapott pont / 100 saját birtoklás; 0, ha nincs adat. */
  drtg: number;
};

export type NormalizedGameStats = TeamGameStat & {
  fga: number;
  fgm: number;
  pace: number;
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
};

/**
 * Közös birtoklásszám: a két csapat becslésének átlaga. Egy meccsen a két
 * csapat birtoklása ±1 lehet csak, ezért mindkét rating ugyanazzal a
 * nevezővel számol (így a DRtg = az ellenfél ORtg-je).
 */
const sharedPossessions = (own: number, opponent: number) => (own + opponent) / 2;

const normalizeTeamSeason = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const tovDenominator = fga + 0.44 * raw.fta + raw.tov;
  const ownPossessions = Math.max(tovDenominator - raw.oreb, 0);
  const totalPossessions = typeof raw.oppPossessions === 'number' && raw.oppPossessions > 0
    ? sharedPossessions(ownPossessions, raw.oppPossessions)
    : ownPossessions;
  const pace = totalPossessions / games;
  const ortg = totalPossessions > 0 ? (raw.pointsFor / totalPossessions) * 100 : 0;
  const drtg = totalPossessions > 0 ? (raw.pointsAgainst / totalPossessions) * 100 : 0;
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  const turnoverRate = tovDenominator > 0 ? raw.tov / tovDenominator : 0;
  const orebDenominator = typeof raw.oppDreb === 'number' && raw.oppDreb > 0
    ? raw.oreb + raw.oppDreb
    : raw.oreb + raw.dreb;
  const orebRate = orebDenominator > 0 ? raw.oreb / orebDenominator : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.ftm / fga : 0;
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
    ortg: round(ortg, 1),
    drtg: round(drtg, 1),
  };
};

const normalizeTeamGame = (raw: TeamGameStat, opponent: TeamGameStat): NormalizedGameStats => {
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const tovDenominator = fga + 0.44 * raw.fta + raw.tov;
  const pace = Math.max(tovDenominator - raw.oreb, 0);
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  const turnoverRate = tovDenominator > 0 ? raw.tov / tovDenominator : 0;
  const orebRate = (raw.oreb + opponent.dreb) > 0 ? raw.oreb / (raw.oreb + opponent.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.ftm / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;

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
  'ortg',
  'drtg',
];

/** A ratingeknél a 0 „nincs adat” (pl. hiányzó kapott pontok), nem valós érték. */
const POSITIVE_ONLY_STAT_KEYS = new Set(['ortg', 'drtg']);

/** Ennél kevesebb szezonmeccsnél a szezonátlag helyett a liga medián a referencia. */
export const MIN_SEASON_BASELINE_GAMES = 3;

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): LeagueTeamBenchmarks => {
  const normalized = teams.map(normalizeTeamSeason);
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
          .map(team => getTeamStatValue(team, stat))
          .filter(v => Number.isFinite(v) && (!POSITIVE_ONLY_STAT_KEYS.has(stat) || v > 0))
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

const getTeamStatValue = (team: NormalizedTeamStats, stat: string) => {
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
    case 'ortg':
      return team.ortg;
    case 'drtg':
      return team.drtg;
    default:
      return 0;
  }
};

const getBenchmarkThreshold = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  pct: keyof BenchmarkPercentiles
) => {
  return benchmarks[team.league]?.[team.season]?.[stat]?.[pct] ?? 0;
};

/** A liga medián (P50) értéke, vagy null, ha nincs értelmezhető benchmark. */
const getLeagueMedian = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string
): number | null => {
  const value = benchmarks[team.league]?.[team.season]?.[stat]?.P50;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * A referencia kiválasztása (egyetlen belépési pont). Elég szezonmintánál a
 * saját szezonátlag; kis mintánál (ahol a szezonátlag ≈ a meccs, minden delta
 * 0) a liga medián. Ha liga benchmark sincs, a baseline `comparable: false`:
 * a szöveg ekkor nem hivatkozik referenciára.
 */
const resolveBaseline = (
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): { reference: NormalizedTeamStats; baseline: PostgameBaseline } => {
  const seasonGames = season.games;
  const smallSample = seasonGames < MIN_SEASON_BASELINE_GAMES;
  const leagueEfg = getLeagueMedian(benchmarks, season, 'efg');

  if (!smallSample) {
    return {
      reference: season,
      baseline: { kind: 'season', seasonGames, smallSample, comparable: true, label: 'Szezon átl.', noun: 'szezonátlag' },
    };
  }

  if (leagueEfg === null) {
    return {
      reference: season,
      baseline: {
        kind: 'season',
        seasonGames,
        smallSample,
        comparable: false,
        label: 'Nincs referencia (kis minta)',
        noun: 'referencia',
      },
    };
  }

  const pick = (stat: string, fallback: number) => getLeagueMedian(benchmarks, season, stat) ?? fallback;

  return {
    reference: {
      ...season,
      pace: pick('pace', season.pace),
      assistRate: pick('assist_rate', season.assistRate),
      turnoverRate: pick('turnover_rate', season.turnoverRate),
      orebRate: pick('oreb_rate', season.orebRate),
      twoRate: pick('two_rate', season.twoRate),
      threeRate: pick('three_rate', season.threeRate),
      threePct: pick('three_pct', season.threePct),
      ftRate: pick('ft_rate', season.ftRate),
      efg: leagueEfg,
      valPerGame: pick('val_per_game', season.valPerGame),
      ortg: pick('ortg', season.ortg),
      drtg: pick('drtg', season.drtg),
    },
    baseline: {
      kind: 'league',
      seasonGames,
      smallSample,
      comparable: true,
      label: 'Liga medián (kis minta)',
      noun: 'ligamedián',
    },
  };
};

/**
 * Adatminőségi megjegyzés a referencia állapotából (a webes nézet és az MD export közös szövege),
 * vagy `null`, ha nincs mit jelezni. `hasLeagueBenchmark`: volt-e a szakaszban elég csapat a
 * liga-benchmarkhoz.
 */
export const describePostgameBaselineNote = (
  baseline: PostgameBaseline | undefined,
  hasLeagueBenchmark: boolean
): string | null => {
  if (baseline && !baseline.comparable) {
    return `Kis minta (a csapatnak ${baseline.seasonGames} másik meccse van a szakaszban) és nincs liga-benchmark: a riport nem mér szezon- vagy ligareferenciához. Az értékelés az ellenfél-párharcra és az „NBA-átlag becslés”-sel jelölt sorokra épül.`;
  }
  if (baseline?.kind === 'league' || hasLeagueBenchmark) return null;
  return 'Ebben a szakaszban kevés csapat játszott elég meccset, ezért nincs liga-összevetés: a riport csak a szezonátlaghoz mér.';
};

/** Van-e értelmezhető szezonátlag-referencia (nem liga medián, és nem kis minta nélkül). */
const hasSeasonReference = (baseline: PostgameBaseline) => baseline.kind === 'season' && baseline.comparable;

const getPercentileScore = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number
) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const scoreAbove = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  score: number
) => getPercentileScore(benchmarks, team, stat, value) >= score;

const scoreBelow = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  score: number
) => getPercentileScore(benchmarks, team, stat, value) <= score;

/** Ennyi százalékpont alatt a liga mediántól való eltérés zaj, nem erősség / probléma. */
const LEAGUE_GAP_MIN_PP = 2;

/**
 * Tartalék TO-referencia (Oliver-féle TO rate, törtként) arra az esetre, ha a riportnak
 * sem szezon-, sem ligareferenciája nincs (kis minta, liga benchmark nélkül). A 2025/26-os
 * alapszakasz 30 csapatának TO rate mediánja (nba.team_game_stats, 2462 csapat-meccs, 2026-10-24;
 * csapatonként 11,1–14,6%). Becslés, nem kalibrált benchmark: csak a probléma- és fókuszsor
 * használja, és a szövegben „NBA-átlag becslés”-ként szerepel.
 */
export const NBA_FALLBACK_TURNOVER_RATE = 0.128;

/** Az NBA-átlag becslés szerinti TO-probléma sora; referencia nélkül ez az egyetlen TO-összevetés. */
const FALLBACK_TURNOVER_PROBLEM_PREFIX = 'TO arány az NBA-átlag becslés felett';

/**
 * „A liga felett / alatt” sor: a percentilis-helyzet mellett a liga mediántól
 * mért távolságnak is érdeminek kell lennie (különben pl. +0,5 pp is
 * erősségnek látszana), és a sor a számokat is kiírja. `null`, ha nem áll.
 */
const leagueLine = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  multiplier: number,
  direction: 'above' | 'below',
  label: string,
  metricLabel: string
): string | null => {
  const median = getLeagueMedian(benchmarks, team, stat);
  if (median === null) return null;
  const gap = round((value - median) * multiplier, 1);
  const hit = direction === 'above'
    ? scoreAbove(benchmarks, team, stat, value, 60) && gap >= LEAGUE_GAP_MIN_PP
    : scoreBelow(benchmarks, team, stat, value, 40) && gap <= -LEAGUE_GAP_MIN_PP;
  if (!hit) return null;
  return `${label} (${metricLabel} ${fixed1(value * multiplier)}% vs liga medián ${fixed1(median * multiplier)}%, ${signedPp(gap)})`;
};

const classifyDelta = (delta: number, threshold: number) => {
  if (delta >= threshold) return 'Higher';
  if (delta <= -threshold) return 'Lower';
  return 'Similar';
};

/**
 * Egy döntő tényező jelöltje. A `tone` explicit előjel (a szövegből nem kell
 * kikövetkeztetni); a `source` mutatja, hogy az állítás a meccs-párharcból
 * (saját vs. ellenfél ugyanazon a meccsen) vagy a referenciából (liga medián /
 * szezonátlag) származik.
 */
type DecisiveFactorCandidate = {
  label: string;
  axis: 'offense' | 'defense';
  type: FactorType;
  tone: 'positive' | 'negative';
  source: 'opponent' | 'reference';
  /** `minor`: a döntő küszöb alatti, „enyhe” párharc-tényező. */
  severity: DecisiveSeverity;
  topic: string;
  /** |eltérés| / döntő küszöb – a rangsoroláshoz. */
  strength: number;
};

const signedPp = (value: number) => `${value >= 0 ? '+' : ''}${round(value, 1)} pp`;
/** Egy tizedesre kerekítve, a kulcsmutató-táblával azonos kerekítéssel. */
const fixed1 = (value: number) => round(value, 1).toFixed(1);

/**
 * A párharc-tényező (saját vs. ellenfél) mindkét csapat értékét mutatja, így
 * lefedi az azonos témájú ellenfél-oldali sort is.
 */
const OPPONENT_TOPIC_COVERS: Record<string, string[]> = {
  efg: ['efg', 'opp-efg'],
  to: ['to', 'opp-to'],
  oreb: ['oreb', 'opp-oreb'],
  ft: ['ft'],
};

/**
 * Döntő tényezők. Elsődleges forrás a meccs-párharc (négy faktor: eFG, TO,
 * OREB, FT rate a két csapat között) és a védekezésnél az ellenfél értéke a
 * liga mediánhoz mérve; a saját referenciához (liga medián / szezonátlag)
 * mért delta másodlagos, és azonos témában nem ismétli a párharc-tényezőt.
 * Kis minta + referencia nélkül a referencia-delta sorok kimaradnak.
 */
const buildDecisiveFactors = (
  game: NormalizedGameStats,
  opponent: NormalizedGameStats | null,
  season: NormalizedTeamStats,
  baseline: PostgameBaseline,
  benchmarks: LeagueTeamBenchmarks
): { offense: string[]; defense: string[]; meta: FactorMeta[] } => {
  const candidates: DecisiveFactorCandidate[] = [];
  const add = (candidate: Omit<DecisiveFactorCandidate, 'severity'> & { severity?: DecisiveSeverity }) =>
    candidates.push({ severity: 'major', ...candidate });

  // 1) Meccs-párharc: saját vs. ellenfél ugyanazon a meccsen. Két sáv: a döntő küszöb fölött
  //    `major`, az „enyhe” küszöb és a döntő között `minor` (kis mintán és szoros meccsen is
  //    látszik a négy faktor iránya, de enyhe jelzéssel, és fókuszt nem vezet).
  if (opponent) {
    const duel = (
      diff: number,
      major: number,
      minor: number,
      build: (severity: DecisiveSeverity) => Omit<DecisiveFactorCandidate, 'severity' | 'strength' | 'source'>
    ) => {
      const severity: DecisiveSeverity | null =
        Math.abs(diff) >= major ? 'major' : Math.abs(diff) >= minor ? 'minor' : null;
      if (!severity) return;
      add({ ...build(severity), source: 'opponent', severity, strength: Math.abs(diff) / major });
    };
    const soft = (severity: DecisiveSeverity) => (severity === 'minor' ? 'Enyhe ' : '');
    const lead = (severity: DecisiveSeverity, text: string) =>
      severity === 'minor' ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;

    const efgDiff = round(game.efg - opponent.efg, 1);
    duel(efgDiff, 5, 2, severity => ({
      label: `${soft(severity)}${lead(severity, `Dobáshatékonysági ${efgDiff > 0 ? 'előny' : 'hátrány'}`)} az ellenféllel szemben (eFG ${game.efg.toFixed(1)}% vs ${opponent.efg.toFixed(1)}%, ${signedPp(efgDiff)})`,
      axis: 'offense', type: 'Hatékonyság', tone: efgDiff > 0 ? 'positive' : 'negative', topic: 'efg',
    }));
    const toDiff = toPct(game.turnoverRate - opponent.turnoverRate, 1);
    duel(toDiff, 4, 2, severity => ({
      label: `${soft(severity)}${lead(severity, `Labdabiztonsági ${toDiff < 0 ? 'előny' : 'hátrány'}`)} (TO rate ${toPct(game.turnoverRate, 1)}% vs ${toPct(opponent.turnoverRate, 1)}%, ${signedPp(toDiff)})`,
      axis: 'offense', type: 'Kontroll', tone: toDiff < 0 ? 'positive' : 'negative', topic: 'to',
    }));
    const orebDiff = toPct(game.orebRate - opponent.orebRate, 1);
    duel(orebDiff, 10, 1.5, severity => ({
      label: `${soft(severity)}${lead(severity, `Lepattanó-${orebDiff > 0 ? 'fölény' : 'hátrány'}`)} (OREB% ${toPct(game.orebRate, 1)}% vs ${toPct(opponent.orebRate, 1)}%, ${signedPp(orebDiff)})`,
      axis: 'offense', type: 'Volumen', tone: orebDiff > 0 ? 'positive' : 'negative', topic: 'oreb',
    }));
    const ftDiff = toPct(game.ftRate - opponent.ftRate, 1);
    duel(ftDiff, 7, 3, severity => ({
      // Az első érték a sajátunk: a „Kevesebb … az ellenfélnél” forma az
      // ellenfél hátrányaként olvasható, ezért az irány a címkében áll.
      label: `${soft(severity)}${lead(severity, `Büntető-${ftDiff > 0 ? 'előny' : 'hátrány'}`)} az ellenféllel szemben (FTM rate ${toPct(game.ftRate, 1)}% vs ${toPct(opponent.ftRate, 1)}%, ${signedPp(ftDiff)})`,
      axis: 'offense', type: 'Volumen', tone: ftDiff > 0 ? 'positive' : 'negative', topic: 'ft',
    }));
  }

  // 2) Referencia-delta (liga medián / szezonátlag) – másodlagos.
  if (baseline.comparable) {
    const noun = baseline.noun;
    const reference = (
      topic: string,
      delta: number,
      threshold: number,
      type: FactorType,
      positiveLabel: string,
      negativeLabel: string,
      higherIsBetter = true
    ) => {
      if (Math.abs(delta) < threshold) return;
      const better = higherIsBetter ? delta > 0 : delta < 0;
      add({
        label: `${better ? positiveLabel : negativeLabel} (${signedPp(delta)})`,
        axis: 'offense', type, tone: better ? 'positive' : 'negative',
        source: 'reference', topic, strength: Math.abs(delta) / threshold,
      });
    };

    reference('three', round(game.threePct - season.threePct, 1), 4, 'Hatékonyság',
      `3P% a ${noun} felett`, `3P% a ${noun} alatt`);
    // Festékre vonatkozó állítás dobástérkép nélkül nem tehető: a box score
    // 2P-aránya a középtávot is tartalmazza, ezért a saját nevén szerepel.
    const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);
    if (twoRateDelta >= 6) {
      reference('paint', twoRateDelta, 6, 'Volumen', `Több 2P-kísérlet a ${noun}nál (2P-arány)`, '');
    }
    reference('ft', toPct(game.ftRate - season.ftRate, 1), 5, 'Volumen',
      `Több büntetőpont a ${noun}nál (FTM rate)`, `Kevés büntetőpont a ${noun}hoz képest (FTM rate)`);
    reference('assist', toPct(game.assistRate - season.assistRate, 1), 5, 'Hatékonyság',
      `Jobb labdajáratás a ${noun}nál`, `Labdajáratás akadozott a ${noun}hoz képest`);
    reference('to', toPct(game.turnoverRate - season.turnoverRate, 1), 5, 'Kontroll',
      `Kevesebb labdaeladás a ${noun}nál (TO rate)`, `Támadás szétesett a ${noun}hoz képest (TO rate)`, false);
    reference('oreb', toPct(game.orebRate - season.orebRate, 1), 6, 'Volumen',
      `Második esély a ${noun} felett (OREB)`, `Második esély a ${noun} alatt (OREB)`);
  }

  // 3) Védekezés: az ellenfél meccsértéke a liga mediánhoz mérve. Liga
  //    benchmark nélkül nincs megbízható viszonyítás – a sor kimarad.
  if (opponent) {
    const leagueEfg = getLeagueMedian(benchmarks, season, 'efg');
    if (leagueEfg !== null) {
      const delta = round(opponent.efg - leagueEfg, 1);
      if (Math.abs(delta) >= 3) {
        add({
          label: delta < 0
            ? `Ellenfél dobáshatékonysága limitálva (eFG ${fixed1(opponent.efg)}% vs liga medián ${fixed1(leagueEfg)}%)`
            : `Ellenfél hatékonyan dobott (eFG ${fixed1(opponent.efg)}% vs liga medián ${fixed1(leagueEfg)}%)`,
          axis: 'defense', type: 'Hatékonyság', tone: delta < 0 ? 'positive' : 'negative',
          source: 'reference', topic: 'opp-efg', strength: Math.abs(delta) / 3,
        });
      }
    }

    const leagueThree = getLeagueMedian(benchmarks, season, 'three_pct');
    if (leagueThree !== null && opponent.fga3 >= 16) {
      // Az állítás mellé mindig odakerül a bizonyíték (ellenfél 3P dobás/kísérlet).
      const evidence = `ellenfél 3P ${opponent.fgm3}/${opponent.fga3}, ${fixed1(opponent.threePct)}% vs liga medián ${fixed1(leagueThree)}%`;
      const delta = round(opponent.threePct - leagueThree, 1);
      if (delta >= 6) {
        add({
          label: `Perimétervédekezési probléma (${evidence})`,
          axis: 'defense', type: 'Hatékonyság', tone: 'negative',
          source: 'reference', topic: 'opp-three', strength: delta / 3,
        });
      } else if (delta >= 3) {
        add({
          label: `Periméter-kockázat (${evidence})`,
          axis: 'defense', type: 'Hatékonyság', tone: 'negative',
          source: 'reference', topic: 'opp-three', strength: delta / 3,
        });
      } else if (delta <= -5) {
        add({
          label: `Periméter kontroll (${evidence})`,
          axis: 'defense', type: 'Hatékonyság', tone: 'positive',
          source: 'reference', topic: 'opp-three', strength: Math.abs(delta) / 3,
        });
      }
    }

    const leagueOreb = getLeagueMedian(benchmarks, season, 'oreb_rate');
    if (leagueOreb !== null) {
      const delta = toPct(opponent.orebRate - leagueOreb, 1);
      if (Math.abs(delta) >= 6) {
        add({
          label: `${delta > 0 ? 'Védőlepattanózás gyenge' : 'Védőlepattanó kontroll'} (ellenfél OREB ${toPct(opponent.orebRate, 1)}% vs liga medián ${toPct(leagueOreb, 1)}%)`,
          axis: 'defense', type: 'Volumen', tone: delta > 0 ? 'negative' : 'positive',
          source: 'reference', topic: 'opp-oreb', strength: Math.abs(delta) / 6,
        });
      }
    }

    const leagueTo = getLeagueMedian(benchmarks, season, 'turnover_rate');
    if (leagueTo !== null) {
      const delta = toPct(opponent.turnoverRate - leagueTo, 1);
      if (Math.abs(delta) >= 5) {
        add({
          label: `${delta > 0 ? 'Kikényszerített labdavesztések' : 'Kevés kikényszerített labdavesztés'} (ellenfél TO rate ${toPct(opponent.turnoverRate, 1)}% vs liga medián ${toPct(leagueTo, 1)}%)`,
          axis: 'defense', type: 'Kontroll', tone: delta > 0 ? 'positive' : 'negative',
          source: 'reference', topic: 'opp-to', strength: Math.abs(delta) / 5,
        });
      }
    }
  }

  // Azonos témában a döntő párharc-tényező nyer a referencia-sor fölött. Az enyhe (`minor`)
  // párharc-tényező csak a hézagot tölti ki: ha a témát már lefedi döntő vagy referencia-sor,
  // elmarad (különben kiszorítaná, vagy ellentmondana a referencia-alapú tényezőnek).
  const coveredBy = (candidate: DecisiveFactorCandidate) => OPPONENT_TOPIC_COVERS[candidate.topic] ?? [candidate.topic];
  const majorOpponentTopics = new Set(
    candidates.filter(c => c.source === 'opponent' && c.severity === 'major').flatMap(coveredBy)
  );
  const referenceTopics = new Set(candidates.filter(c => c.source === 'reference').map(c => c.topic));
  const selected = candidates
    .filter(c => {
      if (c.source === 'reference') return !majorOpponentTopics.has(c.topic);
      if (c.severity === 'minor') return !coveredBy(c).some(topic => referenceTopics.has(topic) || majorOpponentTopics.has(topic));
      return true;
    })
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'opponent' ? -1 : 1;
      // A döntő tényezők megelőzik az enyheket (azonos forráson belül).
      if (a.severity !== b.severity) return a.severity === 'major' ? -1 : 1;
      return b.strength - a.strength;
    });

  const meta = selected.map<FactorMeta>(c => ({
    label: c.label,
    annotated: `${c.label} • ${c.type}-alapú`,
    type: c.type,
    axis: c.axis,
    tone: c.tone,
    source: c.source,
    severity: c.severity,
  }));

  return {
    offense: meta.filter(item => item.axis === 'offense').map(item => item.label),
    defense: meta.filter(item => item.axis === 'defense').map(item => item.label),
    meta: [...meta.filter(item => item.axis === 'offense'), ...meta.filter(item => item.axis === 'defense')],
  };
};

const X_FACTOR_LABELS: Record<string, string> = {
  perimeter: 'Periméter kontroll',
  turnover: 'Labdaszerzés / extra támadások',
  rebound: 'Lepattanó kontroll',
  tempo: 'Tempó kontroll',
  paint: 'Festék kontroll',
};

const getMechanismSignal = (
  key: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  opponent: NormalizedGameStats | null
): MechanismSignal => {
  switch (key) {
    case 'perimeter': {
      if (opponent && opponent.fga3 > 0) {
        const oppThree = round((opponent.fgm3 / opponent.fga3) * 100, 1);
        if (oppThree <= 32) return { realized: true, reason: `védekezés: ellenfél 3P ${oppThree}%` };
      }
      const delta = round(game.threePct - season.threePct, 1);
      if (delta >= 4) {
        return { realized: true, reason: `támadás: saját 3P +${delta} pp (bónusz)` };
      }
      break;
    }
    case 'turnover': {
      const delta = toPct(season.turnoverRate - game.turnoverRate, 1);
      if (delta >= 3) return { realized: true, reason: `TO rate -${delta} pp` };
      break;
    }
    case 'rebound': {
      const delta = toPct(game.orebRate - season.orebRate, 1);
      if (delta >= 5) return { realized: true, reason: `OREB +${delta} pp` };
      break;
    }
    case 'tempo': {
      const delta = round(game.pace - season.pace, 1);
      if (Math.abs(delta) >= 4) {
        const direction = delta > 0 ? '+' : '';
        return { realized: true, reason: `tempó ${direction}${delta}` };
      }
      break;
    }
    case 'paint': {
      const twoDelta = toPct(game.twoRate - season.twoRate, 1);
      const ftDelta = toPct(game.ftRate - season.ftRate, 1);
      const gameTwoPct = game.fga2 > 0 ? (game.fgm2 / game.fga2) * 100 : 0;
      const seasonTwoPct = season.fga2 > 0 ? (season.fgm2 / season.fga2) * 100 : 0;
      const twoPctDelta = round(gameTwoPct - seasonTwoPct, 1);
      if (twoDelta >= 5) return { realized: true, reason: `2P fókusz +${twoDelta} pp` };
      if (ftDelta >= 6) return { realized: true, reason: `FTM rate +${ftDelta} pp` };
      if (twoPctDelta >= 6) return { realized: true, reason: `2P% +${twoPctDelta} pp` };
      break;
    }
    default: {
      // A `season.pointsFor` szezonösszeg – meccsátlaggal kell összevetni.
      const valDelta = round(game.pointsFor - season.pointsFor / Math.max(season.games, 1), 1);
      if (valDelta >= 5) return { realized: true, reason: `Ponttermelés +${valDelta}` };
    }
  }
  return { realized: false };
};

const formatMechanismStatus = (
  key: string,
  label: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  opponent: NormalizedGameStats | null,
  fallback: FactorMeta | undefined
): MechanismStatus => {
  const signal = getMechanismSignal(key, game, season, opponent);
  if (signal.realized) {
    return { icon: '✓', text: `${label} (${signal.reason})` };
  }
  if (fallback) {
    return {
      icon: '↺',
      text: `${label} → ${fallback.type.toLowerCase()} (${fallback.label})`,
    };
  }
  return { icon: '✗', text: `${label} nem volt meghatározó` };
};

const evaluateRiskFlag = (
  flag: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats
) => {
  const lower = flag.toLowerCase();
  if (lower.includes('ft')) {
    const delta = toPct(game.ftRate - season.ftRate, 1);
    return delta >= 4
      ? `✓ ${flag} (FTM rate +${delta} pp)`
      : `✗ ${flag}`;
  }
  if (lower.includes('oreb')) {
    const delta = toPct(game.orebRate - season.orebRate, 1);
    return delta >= 5 ? `✓ ${flag} (+${delta} pp)` : `✗ ${flag}`;
  }
  if (lower.includes('labda') || lower.includes('to') || lower.includes('turnover')) {
    const delta = toPct(game.turnoverRate - season.turnoverRate, 1);
    return delta >= 3 ? `✓ ${flag} (+${delta} pp)` : `✗ ${flag}`;
  }
  return `${flag}`;
};

const buildXFactorReflection = (
  preGame: PreGameXFactorContext | undefined,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  opponent: NormalizedGameStats | null,
  decisiveMeta: FactorMeta[]
) => {
  if (!preGame) return { line: '', riskLine: '' };
  const fallback = decisiveMeta[0];
  const secondaryFallback = decisiveMeta[1] || fallback;

  const lines: string[] = [];
  const riskLines: string[] = [];

  const primaryLabel = preGame.primaryLabel || X_FACTOR_LABELS[preGame.primaryKey] || preGame.primaryKey;
  const primaryStatus = formatMechanismStatus(
    preGame.primaryKey,
    primaryLabel,
    game,
    season,
    opponent,
    fallback
  );
  lines.push(`${primaryStatus.icon} ${primaryStatus.text}`);

  if (preGame.secondaryKey) {
    const secondaryLabel = preGame.secondaryLabel || X_FACTOR_LABELS[preGame.secondaryKey] || preGame.secondaryKey;
    const secondaryStatus = formatMechanismStatus(
      preGame.secondaryKey,
      secondaryLabel,
      game,
      season,
      opponent,
      secondaryFallback
    );
    lines.push(`${secondaryStatus.icon} ${secondaryStatus.text}`);
  }

  if (preGame.riskFlags && preGame.riskFlags.length > 0) {
    preGame.riskFlags.forEach(flag => {
      riskLines.push(evaluateRiskFlag(flag, game, season));
    });
  }

  return {
    line: lines.length ? `X-faktor visszacsatolás: ${lines.join(' • ')}` : '',
    riskLine: riskLines.length ? `Kockázati helyzet: ${riskLines.join(' • ')}` : '',
  };
};

const computePlayerTrueShooting = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  const denominator = 2 * (fga + 0.44 * player.fta);
  if (denominator === 0) return 0;
  return player.points / denominator;
};

const formatPositiveContributorLabel = (player: PlayerGameStat) => {
  const ts = computePlayerTrueShooting(player);
  const limitedScoringPlaymaker = player.ast >= 7 && ts <= 0.4 && player.points <= 6;
  if (limitedScoringPlaymaker) {
    return `${player.name} (${player.ast} assziszt, playmaker szerep – dobóhatékonyság fejlesztendő)`;
  }
  return player.name;
};

/** A 40 perces FIBA-meccs → 48 perces NBA-meccs percskálája (ASEStats-küszöbök ×1,2). */
const scaleMinutes = (minutes: number) => Math.round(minutes * (REGULATION_MINUTES / 40));
const RELIABLE_SAMPLE_MINUTES = scaleMinutes(8);

const analyzePlayerImpact = (players: PlayerGameStat[]) => {
  const positive: string[] = [];
  const negative: string[] = [];
  const overperformers: Array<{ name: string; score: number }> = [];
  const underperformers: Array<{ name: string; score: number }> = [];

  // Standard, perc-normalizált USG% (0–1), ugyanaz, mint a játékosbontásban.
  const usageRates = computeUsageRates(players);

  players.forEach(player => {
    const usageShare = usageRates.get(player.playerId) ?? 0;
    const ts = computePlayerTrueShooting(player);
    const valPer36 = player.minutes > 0 ? (player.val / player.minutes) * 36 : 0;
    const hasReliableSample = player.minutes >= RELIABLE_SAMPLE_MINUTES;

    // Pár perces mintán a USG% és a VAL zaj (T15): a „limitált hatás” csak megbízható mintán áll.
    const inefficientStar = isInefficientHighUsage({
      isStarter: player.isStarter === true,
      usageShare,
      minutes: player.minutes,
      tsPct: ts * 100,
    });
    if (hasReliableSample && usageShare >= USG_HIGH_MIN && (player.val <= 5 || inefficientStar)) negative.push(player.name);
    if (hasReliableSample && usageShare <= USG_LOW_MAX && (player.val >= 10 || (player.minutes >= scaleMinutes(12) && valPer36 >= 18))) {
      positive.push(formatPositiveContributorLabel(player));
    }

    // Also include high-efficiency starters who played fewer minutes (e.g. foul trouble,
    // tactical substitution) but dominated their time (valPer36 ≥ 35, ts ≥ 0.65).
    const qualifiesOverperformer =
      (player.minutes >= scaleMinutes(18) || (player.minutes >= scaleMinutes(12) && valPer36 >= 35 && ts >= 0.65))
      && (player.val >= 18 || valPer36 >= 20)
      && (ts >= 0.55 || usageShare >= 0.2);

    if (qualifiesOverperformer) {
      const score =
        player.val * 0.45
        + valPer36 * 0.2
        + player.points * 0.2
        + ts * 100 * 0.1
        + usageShare * 100 * 0.05;
      overperformers.push({ name: player.name, score });
    }

    const qualifiesUnderperformer =
      player.minutes >= scaleMinutes(14)
      && player.val <= 3
      && (ts <= 0.47 || usageShare >= 0.18);

    if (qualifiesUnderperformer) {
      const score = (4 - player.val) * 2 + Math.max((0.5 - ts) * 100, 0) + usageShare * 100;
      underperformers.push({ name: player.name, score });
    }
  });

  return {
    positive: positive.slice(0, 3),
    negative: negative.slice(0, 3),
    overperformers: overperformers
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(entry => entry.name),
    underperformers: underperformers
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(entry => entry.name),
  };
};

/**
 * A meccsszintű kiemelések és a játékostábla címkéi két külön szabályból
 * jönnek; itt egyeztetjük őket, hogy ne mondjanak ellent: „Limitált hatás”
 * osztályú játékos nem lehet „Kiugró teljesítmény”, és vezető / alappillér
 * osztályú nem kerülhet a gyenge vagy limitált listára.
 */
const reconcilePlayerImpact = (
  impact: PostGameReport['playerImpact'],
  playerReport: PlayerPostGameReport
): PostGameReport['playerImpact'] => {
  // A „pozitív” lista eleme zárójeles kiegészítést is kaphat a név után.
  const classOf = (entry: string) =>
    playerReport.players.find(player => entry === player.name || entry.startsWith(`${player.name} (`))?.impactClass;
  const isLeading = (entry: string) => {
    const impactClass = classOf(entry);
    return impactClass === 'mvp' || impactClass === 'engine';
  };
  return {
    positive: impact.positive,
    overperformers: impact.overperformers.filter(entry => classOf(entry) !== 'struggling'),
    negative: impact.negative.filter(entry => !isLeading(entry)),
    underperformers: impact.underperformers.filter(entry => !isLeading(entry)),
  };
};

/**
 * A következő meccsre kitűzött cél legnagyobb lépése (százalékpont, a
 * megjelenített mértékegységben). Egy meccsről a teljes liga-mediánig tartó
 * ugrás (pl. FT rate 23,7% → 42,1%) nem reális cél.
 */
const GOAL_MAX_STEP_PP: Record<string, number> = {
  turnover_rate: 3,
  efg: 4,
  three_pct: 5,
  assist_rate: 6,
  oreb_rate: 5,
  ft_rate: 6,
};

/** A védekezési döntő tényezőből képzett erősség- / problémasor előtagja. */
const DEFENSE_LINE_PREFIX = 'Védekezés:';

/** Előtag-alapú keresés: a listaelemek zárójeles számot is tartalmaznak. */
const hasItemStartingWith = (items: string[], ...prefixes: string[]) =>
  items.some(item => prefixes.some(prefix => item.startsWith(prefix)));

/** Ennyi százalékpontos elmozdulás számít érdeminek a belső dobásarányban. */
const INTERIOR_SHIFT_PP = 6;

/**
 * A belső dobásvolumen elmozdulása a szezonhoz képest. Dobástérkép nélkül csak a
 * box score 2P-kísérletaránya ismert – az a középtávot is tartalmazza és a
 * tripla-arány tükre, ezért a sor a tényleges mutatót nevezi meg, festékre nem hivatkozik.
 */
const describeInteriorShift = (twoRateDelta: number, direction: 'up' | 'down'): string | null => {
  if (direction === 'down') {
    return twoRateDelta <= -INTERIOR_SHIFT_PP
      ? `2P-kísérletek aránya visszaesett (${twoRateDelta} százalékpont; dobástérkép nélkül a festék-volumen nem ítélhető meg)`
      : null;
  }
  return twoRateDelta >= INTERIOR_SHIFT_PP ? `2P-kísérletek aránya nőtt (+${twoRateDelta} százalékpont)` : null;
};

const buildStrengths = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  baseline: PostgameBaseline
) => {
  const strengths: string[] = [];
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);

  // Liga-referenciánál a szezon-delta sorok értelmetlenek; a lenti
  // liga-percentilis sorok adják az összevetést. Referencia nélkül (`comparable: false`)
  // a „szezonátlag” csak a másik 1–2 meccs, nem viszonyítási alap.
  if (hasSeasonReference(baseline)) {
    if (efgDelta >= 3) strengths.push(`Dobáshatékonyság a szezonátlag felett (+${efgDelta} százalékpont)`);
    if (assistRateDelta >= 5) strengths.push(`Labdajáratás javult (+${assistRateDelta} százalékpont)`);
    if (orebRateDelta >= 5) strengths.push(`Támadólepattanózás erős (+${orebRateDelta} százalékpont)`);
    if (threePctDelta >= 4) strengths.push(`Erős 3P-hatékonyság (+${threePctDelta} százalékpont)`);
    const interior = describeInteriorShift(twoRateDelta, 'up');
    if (interior) strengths.push(interior);
  }

  const pushLeague = (line: string | null) => {
    if (line) strengths.push(line);
  };
  if (!hasItemStartingWith(strengths, 'Dobáshatékonyság a szezonátlag felett')) {
    pushLeague(leagueLine(benchmarks, season, 'efg', game.efg, 1, 'above', 'Dobáshatékonyság a liga felett', 'eFG'));
  }
  pushLeague(leagueLine(benchmarks, season, 'assist_rate', game.assistRate, 100, 'above', 'Labdajáratás a liga felett', 'Assist%'));
  pushLeague(leagueLine(benchmarks, season, 'three_pct', game.threePct, 1, 'above', 'Periméter-hatékonyság a liga felett', '3P%'));

  return strengths.slice(0, 3);
};

const buildProblems = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  baseline: PostgameBaseline
) => {
  const problems: string[] = [];
  const turnoverRateDelta = toPct(game.turnoverRate - season.turnoverRate, 1);
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);
  const ftRateDelta = toPct(game.ftRate - season.ftRate, 1);

  // A „visszaesett” jellegű sorok szezonbeli bázist feltételeznek.
  if (hasSeasonReference(baseline)) {
    if (turnoverRateDelta >= 5) problems.push(`Sok labdaeladás (+${turnoverRateDelta} százalékpont TO rate)`);
    if (efgDelta <= -3) problems.push(`Dobáshatékonyság visszaesett (${efgDelta} százalékpont)`);
    if (assistRateDelta <= -5) problems.push(`Labdajáratás akadozott (${assistRateDelta} százalékpont)`);
    if (threePctDelta <= -4) problems.push(`Gyenge 3P-hatékonyság (${threePctDelta} százalékpont)`);
    const interior = describeInteriorShift(twoRateDelta, 'down');
    if (interior) problems.push(interior);
    if (orebRateDelta <= -6) problems.push(`Második esély volumen visszaesett (${orebRateDelta} százalékpont OREB)`);
    if (ftRateDelta <= -6) problems.push(`Alacsony FTM rate (${ftRateDelta} százalékpont)`);
  }

  const pushLeague = (line: string | null) => {
    if (line) problems.push(line);
  };
  // Referencia nélkül (sem szezonátlag, sem liga medián) a rögzített NBA-átlag becslés az egyetlen
  // viszonyítás – csak a labdavesztésre, és csak ha a liga mediánja tényleg hiányzik.
  if (!baseline.comparable && getLeagueMedian(benchmarks, season, 'turnover_rate') === null) {
    const gap = round((game.turnoverRate - NBA_FALLBACK_TURNOVER_RATE) * 100, 1);
    if (gap >= LEAGUE_GAP_MIN_PP) {
      problems.push(
        `${FALLBACK_TURNOVER_PROBLEM_PREFIX} (TO rate ${fixed1(game.turnoverRate * 100)}% vs ~${fixed1(NBA_FALLBACK_TURNOVER_RATE * 100)}%, ${signedPp(gap)})`
      );
    }
  }
  pushLeague(leagueLine(benchmarks, season, 'turnover_rate', game.turnoverRate, 100, 'above', 'TO arány a liga felett', 'TO rate'));
  pushLeague(leagueLine(benchmarks, season, 'efg', game.efg, 1, 'below', 'Dobáshatékonyság a liga alatt', 'eFG'));
  pushLeague(leagueLine(benchmarks, season, 'three_pct', game.threePct, 1, 'below', 'Periméter-hatékonyság a liga alatt', '3P%'));
  pushLeague(leagueLine(benchmarks, season, 'oreb_rate', game.orebRate, 100, 'below', 'OREB volumen a liga alatt', 'OREB%'));
  pushLeague(leagueLine(benchmarks, season, 'ft_rate', game.ftRate, 100, 'below', 'FTM rate a liga alatt', 'FTM rate'));

  return problems.slice(0, 3);
};

const buildNextFocus = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  problems: string[],
  strengths: string[],
  benchmarks: LeagueTeamBenchmarks,
  baseline: PostgameBaseline
) => {
  const focus: string[] = [];

  const topicKey = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('ftm rate') || lower.includes('ft rate') || lower.includes('büntető')) return 'ft';
    if (lower.includes('to-rate') || lower.includes('to ') || lower.includes('turnover') || lower.includes('labda')) return 'to';
    if (lower.includes('oreb') || lower.includes('második esély') || lower.includes('lepattanó')) return 'oreb';
    if (lower.includes('periméter') || lower.includes('3p')) return 'perimeter';
    if (lower.includes('assist') || lower.includes('playmaking')) return 'playmaking';
    if (lower.includes('festék')) return 'paint';
    if (lower.includes('efg') || lower.includes('dobás')) return 'shooting';
    return lower;
  };

  const topicPriority = (message: string) => {
    switch (topicKey(message)) {
      case 'ft':
        return 1;
      case 'to':
        return 2;
      case 'shooting':
        return 3;
      case 'playmaking':
        return 4;
      case 'perimeter':
        return 5;
      case 'paint':
        return 6;
      case 'oreb':
        return 7;
      default:
        return 9;
    }
  };

  const addFocus = (message: string) => {
    const key = topicKey(message);
    if (focus.some(item => topicKey(item) === key)) return;
    focus.push(message);
  };

  /** Referencia nélkül a „szezonátlag” csak a másik 1–2 meccs: nem lehet célérték alapja. */
  const seasonRef = (value: number): number | null => (baseline.comparable ? value : null);

  const formatFocusPlan = (title: string, goal: string, how: string) =>
    `${title}: Cél ${goal}. Hogyan: ${how}.`;

  /**
   * Célérték: a jelenlegi érték és a jobbik referencia (referencia / liga
   * medián) közötti sávban, meccsenként reális lépéskorláttal
   * (`GOAL_MAX_STEP_PP`). Ha a korlát vág, a teljes referencia zárójelben
   * látszik. Ha egyik referencia sem jobb a meccsértéknél, nincs önmagára
   * mutató cél, csak irány.
   */
  const formatGoal = (
    label: string,
    gameValue: number,
    referenceValue: number | null,
    stat: string,
    multiplier: number,
    direction: 'higher' | 'lower',
    referenceName = 'referencia'
  ) => {
    const gameShown = round(gameValue * multiplier, 1);
    const league = getLeagueMedian(benchmarks, season, stat);
    const candidates = [referenceValue, league]
      .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
      .map(value => round(value * multiplier, 1));
    const reference = candidates.length === 0
      ? null
      : direction === 'lower' ? Math.min(...candidates) : Math.max(...candidates);
    const improves = reference !== null && (direction === 'lower' ? reference < gameShown : reference > gameShown);
    if (!improves || reference === null) {
      return `${label} ${gameShown.toFixed(1)}% ${direction === 'lower' ? 'csökkentése' : 'növelése'}`;
    }
    const maxStep = GOAL_MAX_STEP_PP[stat] ?? Number.POSITIVE_INFINITY;
    const gap = Math.abs(reference - gameShown);
    if (gap <= maxStep) return `${label} ${gameShown.toFixed(1)}% → ${reference.toFixed(1)}%`;
    const target = round(direction === 'lower' ? gameShown - maxStep : gameShown + maxStep, 1);
    return `${label} ${gameShown.toFixed(1)}% → ${target.toFixed(1)}% (${referenceName} ${reference.toFixed(1)}%)`;
  };

  /**
   * Adatvezérelt tartalék-fókusz, ha egyik szabály sem aktiválódott: a
   * referenciához képest leggyengébb mutató javítása, ennek hiányában a
   * legerősebb megtartása – számokkal, generikus szöveg helyett.
   */
  const buildFallbackFocus = () => {
    const referenceFor = (stat: string, seasonValue: number) =>
      baseline.comparable ? seasonValue : getLeagueMedian(benchmarks, season, stat);
    const candidates = [
      { stat: 'efg', label: 'eFG', game: game.efg, ref: referenceFor('efg', season.efg), multiplier: 1, direction: 'higher' as const, scale: 3, how: 'több festékből érkező befejezés és extra pass' },
      { stat: 'turnover_rate', label: 'TO rate', game: game.turnoverRate, ref: referenceFor('turnover_rate', season.turnoverRate), multiplier: 100, direction: 'lower' as const, scale: 3, how: 'egyszerűsített első passzok és korai döntések' },
      { stat: 'oreb_rate', label: 'OREB%', game: game.orebRate, ref: referenceFor('oreb_rate', season.orebRate), multiplier: 100, direction: 'higher' as const, scale: 5, how: '4-5-ös posztok agresszívabb weakside crash-e' },
      { stat: 'ft_rate', label: 'FTM rate', game: game.ftRate, ref: referenceFor('ft_rate', season.ftRate), multiplier: 100, direction: 'higher' as const, scale: 5, how: 'több kontaktkeresés az 1-3-asoktól és wedge setek' },
      { stat: 'assist_rate', label: 'Assist-rate', game: game.assistRate, ref: referenceFor('assist_rate', season.assistRate), multiplier: 100, direction: 'higher' as const, scale: 5, how: 'short roll és skip-pass visszahozása' },
    ]
      .filter((item): item is typeof item & { ref: number } => item.ref !== null && Number.isFinite(item.ref) && item.ref > 0)
      .map(item => {
        const delta = (item.game - item.ref) * item.multiplier;
        return { ...item, score: (item.direction === 'higher' ? delta : -delta) / item.scale };
      })
      .sort((a, b) => a.score - b.score);

    if (candidates.length === 0) {
      return 'Nincs viszonyítási alap a fókuszhoz (kis minta, liga benchmark nélkül) – a következő meccsek után értékelhető.';
    }
    const weakest = candidates[0];
    if (weakest.score < 0) {
      return formatFocusPlan(
        `${weakest.label} javítása`,
        formatGoal(weakest.label, weakest.game, weakest.ref, weakest.stat, weakest.multiplier, weakest.direction),
        weakest.how
      );
    }
    const strongest = candidates[candidates.length - 1];
    return `${strongest.label} szintjének megtartása: ${round(strongest.game * strongest.multiplier, 1).toFixed(1)}% (referencia ${round(strongest.ref * strongest.multiplier, 1).toFixed(1)}%) – minden fő mutató a referencia szintjén vagy felette.`;
  };

  if (hasItemStartingWith(problems, 'Sok labdaeladás', 'TO arány a liga felett', FALLBACK_TURNOVER_PROBLEM_PREFIX)) {
    addFocus(
      formatFocusPlan(
        'Labdabiztonság stabilizálása',
        formatGoal(
          'TO-rate',
          game.turnoverRate,
          seasonRef(season.turnoverRate) ?? NBA_FALLBACK_TURNOVER_RATE,
          'turnover_rate',
          100,
          'lower',
          baseline.comparable ? undefined : 'NBA-átlag becslés'
        ),
        'egyszerűsített első passzok és korai döntések'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Dobáshatékonyság visszaesett', 'Dobáshatékonyság a liga alatt')) {
    addFocus(
      formatFocusPlan(
        'Dobásminőség újrakalibrálása',
        formatGoal('eFG', game.efg, seasonRef(season.efg), 'efg', 1, 'higher'),
        'több festékből érkező befejezés és extra pass'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Labdajáratás akadozott')) {
    addFocus(
      formatFocusPlan(
        'Playmaking ritmus',
        formatGoal('Assist-rate', game.assistRate, seasonRef(season.assistRate), 'assist_rate', 100, 'higher'),
        'short roll és skip-pass visszahozása'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Gyenge 3P-hatékonyság', 'Periméter-hatékonyság a liga alatt')) {
    addFocus(
      formatFocusPlan(
        'Periméter fegyelem',
        formatGoal('3P%', game.threePct, seasonRef(season.threePct), 'three_pct', 1, 'higher'),
        'saroktriplák kialakítása, kevesebb erőltetett pull-up'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Festékbefejezések visszaestek')) {
    addFocus(
      formatFocusPlan(
        'Festék kontroll',
        'deep catch és rim run volumen visszaépítése',
        'nagyobb hangsúly a deep catch befejezéseken és rim run-okon'
      )
    );
  }

  const hasOrebProblem = problems.some(item => item.includes('második esély') || item.includes('OREB'));
  if (hasOrebProblem) {
    addFocus(
      formatFocusPlan(
        'Második esélyek visszaépítése',
        formatGoal('OREB%', game.orebRate, seasonRef(season.orebRate), 'oreb_rate', 100, 'higher'),
        '4-5-ös posztok agresszívabb weakside crash-e'
      )
    );
  }

  const hasFtProblem = problems.some(item => item.includes('FTM rate') || item.includes('büntető'));
  if (hasFtProblem) {
    addFocus(
      formatFocusPlan(
        'Büntetők növelése',
        formatGoal('FTM rate', game.ftRate, seasonRef(season.ftRate), 'ft_rate', 100, 'higher'),
        'több kontaktkeresés az 1-3-asoktól és wedge setek'
      )
    );
  }

  if (hasItemStartingWith(strengths, 'Támadólepattanózás erős')) {
    addFocus(
      formatFocusPlan(
        'OREB agresszivitás fenntartása',
        `jelenlegi OREB% ${toPct(game.orebRate, 1)}%`,
        'azonos intenzitás a támadóüvegen'
      )
    );
  }

  const margin = game.pointsFor - game.pointsAgainst;
  if (margin >= 20 && focus.length < 2) {
    addFocus(
      `Domináns minták konzerválása (+${round(margin, 0)} pont): a legerősebb rotációs és spacing-sémák tudatos korai visszahívása a következő meccsen.`
    );
  }

  if (focus.length === 0) {
    addFocus(buildFallbackFocus());
  }

  return [...focus]
    .sort((a, b) => topicPriority(a) - topicPriority(b))
    .slice(0, 2);
};

/** Ennyi százalékpontnyi elmaradás alatt a mutató a referencia szintjén van. */
const REFERENCE_GAP_MIN_PP = 1;

const buildOpponentProfileSection = (
  opponentName: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  baseline: PostgameBaseline,
  opponent: NormalizedGameStats | null,
  preGame?: PreGameXFactorContext
) => {
  const keyLabel = (key: string, fallback?: string) => fallback || X_FACTOR_LABELS[key] || key;
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${round(value, 1)}`;
  const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${toPct(value, 1)}%`;

  const evaluateOpponentMechanism = (key: string, label: string) => {
    switch (key) {
      case 'perimeter': {
        const delta = game.threePct - season.threePct;
        const realized = delta <= -4;
        return {
          label,
          realized,
          expectation: `${label}: a saját 3P-hatékonyságunk visszanyomása volt várható.`,
          actual: `${label}: 3P% ${season.threePct.toFixed(1)}% → ${game.threePct.toFixed(1)}% (${signed(delta)} pp).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'turnover': {
        const delta = game.turnoverRate - season.turnoverRate;
        const realized = delta >= 0.03;
        return {
          label,
          realized,
          expectation: `${label}: magasabb labdanyomás és több eladott labda volt várható.`,
          actual: `${label}: TO-rate ${toPct(season.turnoverRate, 1)}% → ${toPct(game.turnoverRate, 1)}% (${signedPct(delta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'rebound': {
        const delta = game.orebRate - season.orebRate;
        const realized = delta <= -0.06;
        return {
          label,
          realized,
          expectation: `${label}: a támadólepattanóink visszaszorítása volt várható.`,
          actual: `${label}: OREB% ${toPct(season.orebRate, 1)}% → ${toPct(game.orebRate, 1)}% (${signedPct(delta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'tempo': {
        const delta = game.pace - season.pace;
        const realized = delta <= -4;
        return {
          label,
          realized,
          expectation: `${label}: lassabb ritmus és kevesebb nyílt pályás helyzet volt várható.`,
          actual: `${label}: tempó ${season.pace.toFixed(1)} → ${game.pace.toFixed(1)} (${signed(delta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'paint': {
        const twoDelta = game.twoRate - season.twoRate;
        const ftDelta = game.ftRate - season.ftRate;
        const gameTwoPct = game.fga2 > 0 ? (game.fgm2 / game.fga2) * 100 : 0;
        const seasonTwoPct = season.fga2 > 0 ? (season.fgm2 / season.fga2) * 100 : 0;
        const twoPctDelta = gameTwoPct - seasonTwoPct;
        const volumeSuppressed = twoDelta <= -0.05 || ftDelta <= -0.05;
        const efficiencyResisted = twoPctDelta <= 2;
        const realized = volumeSuppressed && efficiencyResisted;
        return {
          label,
          realized,
          expectation: `${label}: festékbe jutás és fault-kiharcolás csökkenése volt várható.`,
          actual: `${label}: 2P arány ${toPct(season.twoRate, 1)}% → ${toPct(game.twoRate, 1)}% (${signedPct(twoDelta)}), 2P% ${seasonTwoPct.toFixed(1)}% → ${gameTwoPct.toFixed(1)}% (${signed(twoPctDelta)} pp), FTM rate ${toPct(season.ftRate, 1)}% → ${toPct(game.ftRate, 1)}% (${signedPct(ftDelta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      default: {
        const delta = game.efg - season.efg;
        const realized = delta <= -3;
        return {
          label,
          realized,
          expectation: `${label}: a támadóhatékonyságunk csökkentése volt várható.`,
          actual: `${label}: eFG% ${season.efg.toFixed(1)}% → ${game.efg.toFixed(1)}% (${signed(delta)} pp).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
    }
  };

  const lines = ['**Ellenfél profil**'];
  // Mért ellenfél-adat: az ellenfél saját box score mutatói ezen a meccsen.
  if (opponent) {
    const oppThree = opponent.fga3 > 0 ? ` (${fixed1(opponent.threePct)}%)` : '';
    lines.push(
      `• ${opponentName} mért mutatói: eFG ${fixed1(opponent.efg)}%, 3P ${opponent.fgm3}/${opponent.fga3}${oppThree}, ` +
        `FTM rate ${fixed1(toPct(opponent.ftRate, 1))}%, OREB% ${fixed1(toPct(opponent.orebRate, 1))}%, TO rate ${fixed1(toPct(opponent.turnoverRate, 1))}%.`
    );
  }
  const preGameEvaluations: Array<{
    label: string;
    realized: boolean;
    expectation: string;
    actual: string;
    verdict: string;
  }> = [];
  if (preGame) {
    const labels = [
      keyLabel(preGame.primaryKey, preGame.primaryLabel),
      preGame.secondaryKey
        ? keyLabel(preGame.secondaryKey, preGame.secondaryLabel)
        : null,
    ].filter(Boolean) as string[];
    if (labels.length > 0) {
      lines.push(`• Pre-game fókusz: ${labels.join(' + ')}.`);
      lines.push('• Meccs előtt várható hatás:');
      const primaryEval = evaluateOpponentMechanism(
        preGame.primaryKey,
        keyLabel(preGame.primaryKey, preGame.primaryLabel)
      );
      preGameEvaluations.push(primaryEval);
      lines.push(`• ${primaryEval.expectation}`);

      if (preGame.secondaryKey) {
        const secondaryEval = evaluateOpponentMechanism(
          preGame.secondaryKey,
          keyLabel(preGame.secondaryKey, preGame.secondaryLabel)
        );
        preGameEvaluations.push(secondaryEval);
        lines.push(`• ${secondaryEval.expectation}`);
      }

      lines.push('• Meccs után (realizáció):');
      preGameEvaluations.forEach(item => {
        lines.push(`• ${item.actual} Értékelés: ${item.verdict}.`);
      });

      const realizedCount = preGameEvaluations.filter(item => item.realized).length;
      const total = preGameEvaluations.length;
      const conclusion = realizedCount === total
        ? `${opponentName} védekező profilja teljes mértékben realizálódott, érdemben szűkítette a támadásunkat.`
        : realizedCount > 0
          ? `${opponentName} védekező profilja részben realizálódott (${realizedCount}/${total}), de több kulcsterületet nem tudott stabilan kontrollálni.`
          : `${opponentName} védekező profilja ezen a meccsen nem realizálódott; a saját támadóidentitásunk maradt domináns.`;
      lines.push(`• Következtetés: ${conclusion}`);
      return lines;
    }
  }

  // Referencia nélkül (kis minta, liga benchmark nélkül) nincs mihez mérni.
  // A leírók a SAJÁT támadómutatóink a referenciához mérve – nem az ellenfél
  // mért adatai, ezért a szöveg sem tulajdonítja őket az ellenfélnek.
  const margin = game.pointsFor - game.pointsAgainst;
  const refNoun = baseline.noun;
  if (!baseline.comparable) {
    lines.push(`• ${opponentName} védekező hatása referencia nélkül nem értékelhető (kis szezonminta, liga benchmark nélkül).`);
    return lines;
  }

  // Minden fő támadómutató eltérése a referenciától; `worse` > 0: rosszabb a
  // referenciánál (a TO rate-nél a magasabb érték a rosszabb).
  const gap = (label: string, gameShown: number, refShown: number, significantPp: number, lowerIsBetter = false) => {
    const delta = round(gameShown - refShown, 1);
    return {
      text: `${label} ${fixed1(gameShown)}% vs ${refNoun} ${fixed1(refShown)}% (${signedPp(delta)})`,
      worse: lowerIsBetter ? delta : -delta,
      significantPp,
    };
  };
  const gaps = [
    gap('eFG', game.efg, season.efg, 3),
    gap('3P%', game.threePct, season.threePct, 4),
    gap('Assist%', toPct(game.assistRate, 1), toPct(season.assistRate, 1), 5),
    gap('TO rate', toPct(game.turnoverRate, 1), toPct(season.turnoverRate, 1), 5, true),
    gap('OREB%', toPct(game.orebRate, 1), toPct(season.orebRate, 1), 6),
    gap('FTM rate', toPct(game.ftRate, 1), toPct(season.ftRate, 1), 5),
  ];
  const significant = gaps.filter(item => item.worse >= item.significantPp);
  const minor = gaps.filter(item => item.worse >= REFERENCE_GAP_MIN_PP && item.worse < item.significantPp);
  const minorText = minor.map(item => item.text).join('; ');

  // Ugyanarra az adatra egyetlen, egymást ki nem záró állítás: a konkrét
  // limitált terület és a nagy különbség oka együtt jelenik meg. „Egyik sem
  // esett alá” csak akkor állítható, ha tényleg egyik mutató sem rosszabb.
  if (significant.length === 0) {
    const marginText = margin >= 20 ? ` A +${round(margin, 0)} pontos különbséget a saját végrehajtás hozta.` : '';
    lines.push(
      minor.length === 0
        ? `• ${opponentName} ellen minden fő saját támadómutatónk a ${refNoun} szintjén vagy felette volt.${marginText}`
        : `• ${opponentName} ellen érdemi visszaesés egyik fő saját támadómutatóban sem volt; kisebb elmaradás a ${refNoun}tól: ${minorText}.${marginText}`
    );
  } else {
    lines.push(`• Saját támadómutatók a ${refNoun} alatt ${opponentName} ellen: ${significant.map(item => item.text).join('; ')}.`);
    if (minor.length > 0) lines.push(`• Kisebb elmaradás a ${refNoun}tól: ${minorText}.`);
    lines.push(`• Értelmezés: a visszaesés mögött ${opponentName} védekezése is állhat, de ez a saját mutatóinkból levont következtetés, nem mért ellenfél-adat.`);
    if (margin >= 20) {
      lines.push(`• A limitált terület(ek) ellenére a +${round(margin, 0)} pontos különbséget a többi mutatóban mutatott saját végrehajtás döntötte el.`);
    }
  }
  return lines;
};

/** A védekezés liga-szintje körüli sáv: DRtg (pont / 100 birtoklás), eFG és TO rate (pp). */
const DEFENSE_DRTG_BAND = 4;
const DEFENSE_EFG_BAND = 2.5;
const DEFENSE_TO_BAND = 3;

/**
 * A védekezés verdiktje a liga mediánhoz mérve, három jelzésből: DRtg (kapott
 * pont / 100 birtoklás), az ellenfél eFG%-a és a kikényszerített TO rate.
 * Mindegyik a saját sávján kívül „jobb” vagy „gyengébb” szavazat; a verdikt a
 * szavazatok előjele. Így az átlagos dobásengedés önmagában nem minősít
 * „ligaszintűnek” egy sok labdát szerző, kevés pontot engedő védekezést – és
 * fordítva. Hiányzó liga-referenciánál az adott jelzés nem szavaz.
 */
const classifyDefense = (defense: NonNullable<PostGameReport['context']['defense']>) => {
  const votes = [
    classifyDelta(defense.leagueEfg - defense.opponentEfg, DEFENSE_EFG_BAND),
    typeof defense.opponentTurnoverRate === 'number' && typeof defense.leagueTurnoverRate === 'number'
      ? classifyDelta(defense.opponentTurnoverRate - defense.leagueTurnoverRate, DEFENSE_TO_BAND)
      : 'Similar',
    typeof defense.drtg === 'number' && typeof defense.leagueDrtg === 'number'
      ? classifyDelta(defense.leagueDrtg - defense.drtg, DEFENSE_DRTG_BAND)
      : 'Similar',
  ];
  const total = votes.reduce((sum, vote) => sum + (vote === 'Higher' ? 1 : vote === 'Lower' ? -1 : 0), 0);
  return total > 0 ? 'Higher' : total < 0 ? 'Lower' : 'Similar';
};

/**
 * Védekezési mondat a viszonyítási alappal együtt: a verdikt mellett a DRtg, az
 * ellenfél eFG%-a és a kikényszerített TO rate a liga mediánhoz mérve.
 */
const describeDefense = (context: PostGameReport['context']) => {
  const defense = context.defense;
  if (!defense) return 'nincs viszonyítási alap (ellenfél-adat vagy liga benchmark hiányzik)';
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  const evidence: string[] = [];
  if (typeof defense.drtg === 'number' && typeof defense.leagueDrtg === 'number') {
    evidence.push(`DRtg ${defense.drtg.toFixed(1)} vs liga medián ${defense.leagueDrtg.toFixed(1)}`);
  } else if (typeof defense.drtg === 'number') {
    evidence.push(`DRtg ${defense.drtg.toFixed(1)}`);
  }
  evidence.push(
    `ellenfél eFG ${defense.opponentEfg.toFixed(1)}% vs liga medián ${defense.leagueEfg.toFixed(1)}%, ${signed(round(defense.opponentEfg - defense.leagueEfg, 1))} pp`
  );
  if (typeof defense.opponentTurnoverRate === 'number' && typeof defense.leagueTurnoverRate === 'number') {
    evidence.push(
      `kikényszerített TO rate ${defense.opponentTurnoverRate.toFixed(1)}% vs liga medián ${defense.leagueTurnoverRate.toFixed(1)}%, ${signed(round(defense.opponentTurnoverRate - defense.leagueTurnoverRate, 1))} pp`
    );
  }
  const verdict = context.defenseEfficiencyDelta === 'Higher'
    ? 'a liga szintjénél jobb volt'
    : context.defenseEfficiencyDelta === 'Lower'
      ? 'a liga szintjénél gyengébb volt'
      : 'ligaszintű volt';
  return `${verdict} (${evidence.join('; ')})`;
};

/**
 * Az összefoglaló meccsfüggő, a kiegészítésektől (fókuszlista)
 * független sorai. A döntő tényezők, a játékos-kiemelések és a fókusz nem itt
 * dőlnek el: azokat a `composePostgameSummary` a kész riportobjektumból veszi.
 */
const buildSummaryParts = (
  teamName: string,
  opponentName: string,
  result: 'win' | 'loss',
  context: PostGameReport['context'],
  dataNotes: string[],
  metrics: Pick<PostGameReport['metrics'], 'pointsFor' | 'pointsAgainst' | 'margin' | 'pace' | 'efg'>,
  season: NormalizedTeamStats,
  game: NormalizedGameStats,
  opponent: NormalizedGameStats | null,
  baseline: PostgameBaseline,
  ratings: PostgameRatings | null,
  preGame?: PreGameXFactorContext
): NonNullable<PostGameReport['summaryParts']> => {
  const refNoun = baseline.noun;
  const tempoText = !baseline.comparable
    ? 'viszonyítási alap nélkül'
    : context.paceDelta === 'Higher'
      ? 'gyorsabb'
      : context.paceDelta === 'Lower'
        ? 'lassabb'
        : `${refNoun} körüli`;

  const offenseText = !baseline.comparable
    ? 'viszonyítási alap nélkül'
    : context.offenseEfficiencyDelta === 'Higher'
      ? `a ${refNoun}nál hatékonyabb volt`
      : context.offenseEfficiencyDelta === 'Lower'
        ? `a ${refNoun}hoz képest visszaesett`
        : `${refNoun} körül teljesített`;

  const defenseSummaryText = describeDefense(context);

  const marginAbs = Math.abs(metrics.margin);
  const marginLabel = marginAbs >= 12
    ? 'nagy különbség'
    : marginAbs >= 5
      ? 'közepes különbség'
      : marginAbs >= 1
        ? 'szoros végjáték'
        : 'minimális különbség';
  const efgDelta = round(metrics.efg - season.efg, 1);
  const efgLine = baseline.comparable
    ? `eFG ${metrics.efg.toFixed(1)}% vs ${refNoun} ${season.efg.toFixed(1)}%, ${efgDelta >= 0 ? '+' : ''}${efgDelta} pp`
    : `${metrics.efg.toFixed(1)}% eFG`;

  const signedOne = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  const ratingsLine = (() => {
    if (!ratings) return '';
    const refPart = ratings.refOrtg !== null && ratings.refDrtg !== null && ratings.refNet !== null
      ? ` – ${refNoun}: ORtg ${ratings.refOrtg.toFixed(1)}, DRtg ${ratings.refDrtg.toFixed(1)}, Net ${signedOne(ratings.refNet)}`
      : '';
    return `• Ratingek (pont/100 birtoklás): ORtg ${ratings.ortg.toFixed(1)}, DRtg ${ratings.drtg.toFixed(1)}, Net ${signedOne(ratings.net)}${refPart}.`;
  })();
  const causeLine = (() => {
    if (!ratings) return '';
    const direction = metrics.margin >= 0 ? 'az előnyt' : 'a hátrányt';
    switch (ratings.primaryCause) {
      case 'offense':
        return `• Fő ok: ${direction} elsősorban a támadás (ORtg) alakította.`;
      case 'defense':
        return `• Fő ok: ${direction} elsősorban a védekezés (DRtg) alakította.`;
      case 'balanced':
        return `• Fő ok: ${direction} a támadás és a védekezés együtt alakította.`;
      default:
        return '';
    }
  })();
  const sampleLine = baseline.smallSample
    ? `• Minta: ${baseline.seasonGames} szezonmeccs – kis minta, a referencia: ${baseline.label}.`
    : '';

  const opponentProfile = dataNotes.some(note => note.includes('Ellenfél statisztikák nem elérhetők'))
    ? []
    : buildOpponentProfileSection(opponentName, game, season, baseline, opponent, preGame);

  return {
    overview: [
      '**Mérkőzés összefoglalója**',
      `• Eredmény: ${teamName} ${result === 'win' ? 'győzött' : 'vereséget szenvedett'} ${opponentName} ellen (${metrics.pointsFor}-${metrics.pointsAgainst}).`,
      `• Tempó: ${tempoText} (${metrics.pace.toFixed(1)} támadás).`,
      `• Hatékonyság: támadásban ${offenseText} (${efgLine}); védekezésben ${defenseSummaryText}.`,
      ratingsLine,
      `• Margin: ${metrics.margin > 0 ? '+' : ''}${metrics.margin.toFixed(1)} (${marginLabel}).`,
      causeLine,
      sampleLine,
    ].filter(Boolean),
    opponentProfile,
  };
};

/**
 * Az összefoglaló szövege a kész riportobjektumból. A döntő tényezők, a
 * játékos-kiemelések és a fókuszlista ugyanabból az objektumból jönnek, mint a
 * fő szekciók, ezért a kiegészítések után újra kell
 * hívni. `focus`: a megjelenített fókuszlista; hiányában a riportból áll elő.
 * Az adatminőségi megjegyzések nem részei az összefoglalónak (a
 * `report.dataNotes` külön szakaszban jelenik meg). `summaryParts` nélküli
 * (régi) riportobjektumnál a tárolt szöveg tér vissza.
 */
export const composePostgameSummary = (report: PostGameReport, focus?: string[]): string => {
  const parts = report.summaryParts;
  if (!parts) return report.summary;

  const { decisiveFactors: decisive, playerImpact, playerReport } = report;
  // A kulcsmomentumok közé az enyhe (`minor`) párharc-tényező nem kerül.
  const minorLabels = new Set(report.decisiveFactorMeta.filter(item => item.severity === 'minor').map(item => item.label));
  const decisiveText = [...decisive.offense, ...decisive.defense]
    .filter(label => !minorLabels.has(label))
    .slice(0, 3)
    .join('; ');

  const normalizePlayerName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
  const playerLookup = new Map(
    playerReport.players.map(player => [normalizePlayerName(player.name), player])
  );

  const formatPlayerContext = (name: string, mode: 'positive' | 'over' | 'negative' | 'under') => {
    const player = playerLookup.get(normalizePlayerName(name));
    if (!player) return name;
    if (mode === 'over') {
      return `${player.name} (${player.points} pont, TS ${player.tsPct.toFixed(1)}%, VAL/36 ${player.valPer36.toFixed(1)})`;
    }
    if (mode === 'positive') {
      return `${player.name} (VAL/36 ${player.valPer36.toFixed(1)}, usage ${toPct(player.usageShare, 1)}%)`;
    }
    if (mode === 'negative') {
      return `${player.name} (VAL ${player.val}, usage ${toPct(player.usageShare, 1)}%)`;
    }
    return `${player.name} (TS ${player.tsPct.toFixed(1)}%, VAL ${player.val})`;
  };

  const playerHighlightLines = ['**Játékos kiemelések**'];
  if (
    playerImpact.positive.length === 0 &&
    playerImpact.overperformers.length === 0 &&
    playerImpact.negative.length === 0 &&
    playerImpact.underperformers.length === 0
  ) {
    playerHighlightLines.push('• Pozitív hatás: nincs kiemelt szereplő.');
  }
  if (playerImpact.positive.length > 0) {
    playerHighlightLines.push(`• Pozitív hatás: ${playerImpact.positive.map(name => formatPlayerContext(name, 'positive')).join(', ')}.`);
  }
  if (playerImpact.overperformers.length > 0) {
    playerHighlightLines.push(`• Kiugró teljesítmény: ${playerImpact.overperformers.map(name => formatPlayerContext(name, 'over')).join(', ')}.`);
  }
  if (playerImpact.negative.length > 0) {
    playerHighlightLines.push(`• Limitált hatás: ${playerImpact.negative.map(name => formatPlayerContext(name, 'negative')).join(', ')}.`);
  }
  if (playerImpact.underperformers.length > 0) {
    playerHighlightLines.push(`• Gyenge meccs: ${playerImpact.underperformers.map(name => formatPlayerContext(name, 'under')).join(', ')}.`);
  }

  const focusList = focus ?? buildPostgameAutoFocus(report);
  const focusLines = focusList.length > 0
    ? ['**Következő fókusz**', ...focusList.map(item => `• ${item}`)]
    : ['**Következő fókusz**', '• Nincs kiemelt fókusz.'];

  // Saját szakasz: a fókuszblokk alá fűzve a fókusz utolsó pontjának látszana.
  const reflectionItems = [report.reflection.xFactor, report.reflection.risk].filter(Boolean);
  const reflectionLines = reflectionItems.length > 0
    ? ['**Reflexió**', ...reflectionItems.map(item => `• ${item}`)]
    : [];

  return [
    ...parts.overview,
    decisiveText ? `• Kulcsmomentumok: ${decisiveText}.` : '',
    ...playerHighlightLines,
    ...parts.opponentProfile,
    ...focusLines,
    ...reflectionLines,
  ].filter(Boolean).join('\n');
};

export type PostgameSummarySection = {
  /** A szakasz szerepe a megjelenítéshez; `text`: cím nélküli vagy ismeretlen című rész. */
  key: 'overview' | 'players' | 'opponent' | 'focus' | 'reflection' | 'text';
  title: string;
  items: string[];
};

const SUMMARY_SECTION_KEYS: Record<string, PostgameSummarySection['key']> = {
  'Mérkőzés összefoglalója': 'overview',
  'Játékos kiemelések': 'players',
  'Ellenfél profil': 'opponent',
  'Következő fókusz': 'focus',
  Reflexió: 'reflection',
};

/**
 * Az összefoglaló szövege szakaszokra bontva a megjelenítéshez. A szöveg
 * soronként tagolt: a `**Cím**` sor szakaszt nyit, a többi sor (a vezető „•”
 * nélkül) a szakasz egy pontja. A cím előtti sorok cím nélküli szakaszba
 * kerülnek, így tagolatlan (régi) szövegre is használható.
 */
export const parsePostgameSummary = (summary: string): PostgameSummarySection[] => {
  const sections: PostgameSummarySection[] = [];
  summary.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    const heading = /^\*\*(.+)\*\*$/.exec(line);
    if (heading) {
      const title = heading[1].trim();
      sections.push({ key: SUMMARY_SECTION_KEYS[title] ?? 'text', title, items: [] });
      return;
    }
    if (sections.length === 0) sections.push({ key: 'text', title: '', items: [] });
    sections[sections.length - 1].items.push(line.replace(/^•\s*/, ''));
  });
  return sections.filter(section => section.items.length > 0);
};

/** `refNoun === null`: nincs viszonyítási alap, a szöveg nem hivatkozik referenciára. */
const interpretGameContext = (context: PostGameReport['context'], refNoun: string | null) => {
  if (refNoun === null) {
    return `Kis szezonminta és liga benchmark hiányában a tempó és a hatékonyság nem vethető össze referenciával. Védekezésben ${describeDefense(context)}.`;
  }
  const tempoText = context.paceDelta === 'Higher'
    ? `A csapat a ${refNoun}nál gyorsabb tempót diktált`
    : context.paceDelta === 'Lower'
      ? `A mérkőzés tempója a ${refNoun}nál lassabb volt`
      : `A tempó a ${refNoun} körül mozgott`;

  const offenseText = context.offenseEfficiencyDelta === 'Higher'
    ? `támadásban a ${refNoun}nál hatékonyabb megoldásokat talált`
    : context.offenseEfficiencyDelta === 'Lower'
      ? `támadásban a ${refNoun}hoz képest visszaesett a hatékonyság`
      : `támadásban a ${refNoun} körüli hatékonyság érvényesült`;

  const defenseText = `Védekezésben ${describeDefense(context)}`;

  return `${tempoText}, miközben ${offenseText}. ${defenseText}.`;
};

const interpretDecisiveFactors = (
  decisive: PostGameReport['decisiveFactors'],
  meta: PostGameReport['decisiveFactorMeta']
) => {
  // Az „ki döntött” megítélés és a tengely-összegzés csak a döntő (`major`) tényezőkből áll.
  const majorMeta = meta.filter(item => item.severity !== 'minor');
  const minorLabels = new Set(meta.filter(item => item.severity === 'minor').map(item => item.label));
  const majorOffense = decisive.offense.filter(label => !minorLabels.has(label));
  const majorDefense = decisive.defense.filter(label => !minorLabels.has(label));
  const offense = majorOffense.slice(0, 2);
  const defense = majorDefense.slice(0, 2);
  const offenseCount = majorOffense.length;
  const defenseCount = majorDefense.length;

  const dominance = offenseCount > defenseCount
    ? 'A támadás döntött.'
    : defenseCount > offenseCount
      ? 'A védekezés döntött.'
      : 'Komplex mérkőzéskép alakult ki.';

  const highlights = [
    offense.length > 0 ? `Támadás: ${offense.join('; ')}.` : '',
    defense.length > 0 ? `Védekezés: ${defense.join('; ')}.` : '',
  ].filter(Boolean).join(' ');

  const typeCounts = majorMeta.reduce<Record<FactorType, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<FactorType, number>);
  const orderedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const typeSummary = orderedTypes.length > 0
    ? `Domináns tengely: ${orderedTypes.slice(0, 2).map(([type, count]) => `${type} (${count})`).join(', ')}.`
    : '';

  return `${dominance} ${highlights} ${typeSummary}`.trim();
};

const interpretPlayerImpact = (impact: PostGameReport['playerImpact']) => {
  const positiveText = impact.positive.length > 0
    ? `Pozitív hatás: ${impact.positive.join(', ')} (alacsonyabb usage mellett értékes VAL hozzájárulás).`
    : 'Pozitív hatás: nincs egyértelmű kiemelés.';
  const negativeText = impact.negative.length > 0
    ? `Negatív hatás: ${impact.negative.join(', ')} (magas usage mellett alacsony VAL).`
    : 'Negatív hatás: nincs egyértelmű kiemelés.';
  const overText = impact.overperformers.length > 0
    ? `Meccs-szintű kiugrás: ${impact.overperformers.join(', ')}.`
    : '';
  const underText = impact.underperformers.length > 0
    ? `Gyenge meccs: ${impact.underperformers.join(', ')}.`
    : '';

  return [positiveText, negativeText, overText, underText].filter(Boolean).join(' ');
};

const interpretStrengths = (strengths: string[]) => {
  const filtered = strengths.filter(item => item.includes('szezonátlag felett') || item.includes('liga felett'));
  if (filtered.length === 0) return 'Erősségek: nem volt stabil, szezon- vagy liga feletti mutató.';
  return `Erősségek: ${filtered.join('; ')}.`;
};

const interpretProblems = (problems: string[]) => {
  if (problems.length === 0) return 'Problémák: nem volt kiemelt strukturális limitáció.';
  const mapped = problems.map(item => {
    if (item.startsWith(DEFENSE_LINE_PREFIX)) return 'védekezési limitáció';
    if (item.startsWith('Együttállás:')) return 'rotációs / együttállás-szintű limitáció';
    if (item.includes('labdaeladás') || item.includes('TO')) return 'döntéshozatali és labdabiztonsági limitáció';
    if (item.includes('dobáshatékonyság')) return 'shot quality és befejezési hatékonyság ingadozás';
    if (item.includes('3P')) return 'spacing és periméter-hatékonysági limitáció';
    if (item.includes('Festék')) return 'festékből érkező befejezések minősége';
    if (item.includes('assziszt')) return 'labdajáratás folyamatossága';
    if (item.includes('második esély') || item.includes('OREB')) return 'második esély volumen és lepattanó kontroll';
    if (item.includes('FTM rate') || item.includes('büntető')) return 'büntető kiharcolási volumen és kontaktusmenedzsment';
    return 'strukturális végrehajtási limitáció';
  });
  const unique = Array.from(new Set(mapped)).slice(0, 2);
  return `Problémák: ${unique.join('; ')}.`;
};

const interpretNextFocus = (nextFocus: string[]) => {
  if (nextFocus.length === 0) return 'Következő fókusz: nincs kiemelt azonnali beavatkozás.';
  const items = nextFocus.slice(0, 2).map(item => item.replace(/\0/g, '').trim());
  return `Következő fókusz: ${items.join(' • ')}.`;
};

const interpretExecutiveSummary = (
  report: PostGameReport,
  decisiveText: string,
  nextFocusText: string
) => {
  const refNoun = report.baseline?.noun ?? 'szezonátlag';
  const comparable = report.baseline?.comparable ?? true;
  const tempoText = !comparable
    ? 'referencia nélkül értékelhető tempó'
    : report.context.paceDelta === 'Higher'
      ? 'gyorsabb tempó'
      : report.context.paceDelta === 'Lower'
        ? 'lassabb tempó'
        : `${refNoun} körüli tempó`;
  const decisiveCore = decisiveText.split('.').shift()?.trim() || 'Komplex mérkőzéskép';
  const focusCore = nextFocusText.replace('Következő fókusz: ', '').replace(/\0/g, '');
  const reflectionFragment = [report.reflection?.xFactor, report.reflection?.risk].filter(Boolean).join(' ');
  const reflectionText = reflectionFragment ? ` ${reflectionFragment}` : '';
  return `${report.teamName} ${report.result === 'win' ? 'győzött' : 'vereséget szenvedett'} ${report.opponentName} ellen ${tempoText} mellett. ${decisiveCore}. ${focusCore}${reflectionText}`.trim();
};

export const interpretPostGameReport = (report: PostGameReport): PostGameInterpretation => {
  const gameContext = interpretGameContext(
    report.context,
    report.baseline && !report.baseline.comparable ? null : report.baseline?.noun ?? 'szezonátlag'
  );
  const decisiveFactors = interpretDecisiveFactors(report.decisiveFactors, report.decisiveFactorMeta);
  const playerImpact = interpretPlayerImpact(report.playerImpact);
  const strengths = interpretStrengths(report.strengths);
  const problems = interpretProblems(report.problems);
  const nextFocus = interpretNextFocus(buildPostgameAutoFocus(report));
  const summary = interpretExecutiveSummary(report, decisiveFactors, nextFocus);

  return {
    gameContext,
    decisiveFactors,
    playerImpact,
    strengths,
    problems,
    nextFocus,
    summary,
  };
};

/**
 * ORtg / DRtg / Net a meccs közös birtoklásszámából (`game.pace`, a két csapat
 * becslésének átlaga), így a tempó és mindkét rating egy nevezőn áll, és a
 * DRtg megegyezik az ellenfél ORtg-jével.
 */
const buildRatings = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  baseline: PostgameBaseline
): PostgameRatings | null => {
  const possessions = game.pace;
  if (!(possessions > 0)) return null;

  const ortg = round((game.pointsFor / possessions) * 100, 1);
  const drtg = round((game.pointsAgainst / possessions) * 100, 1);
  const net = round(ortg - drtg, 1);
  // Viszonyítási alap nélkül a referencia maga a meccs – nem mutatunk eltérést.
  const refOrtg = baseline.comparable && season.ortg > 0 ? round(season.ortg, 1) : null;
  const refDrtg = baseline.comparable && season.drtg > 0 ? round(season.drtg, 1) : null;
  const refNet = refOrtg !== null && refDrtg !== null ? round(refOrtg - refDrtg, 1) : null;

  // Pozitív eltérés = a referenciánál jobb (támadásban több, védekezésben kevesebb pont).
  let primaryCause: PostgameRatings['primaryCause'] = 'unknown';
  if (refOrtg !== null && refDrtg !== null) {
    const offenseDev = ortg - refOrtg;
    const defenseDev = refDrtg - drtg;
    if (Math.abs(offenseDev - defenseDev) < 5) {
      primaryCause = 'balanced';
    } else if (net >= 0) {
      primaryCause = offenseDev > defenseDev ? 'offense' : 'defense';
    } else {
      primaryCause = offenseDev < defenseDev ? 'offense' : 'defense';
    }
  }

  return {
    possessions: round(possessions, 1),
    ortg,
    drtg,
    net,
    refPossessions: baseline.comparable && season.pace > 0 ? round(season.pace, 1) : null,
    refOrtg,
    refDrtg,
    refNet,
    primaryCause,
  };
};

const buildOpponentShooting = (opponent: NormalizedGameStats | null): PostgameOpponentShooting | null => {
  if (!opponent) return null;
  return {
    efg: round(opponent.efg, 1),
    fgm3: opponent.fgm3,
    fga3: opponent.fga3,
    threePct: round(opponent.threePct, 1),
    ftRate: toPct(opponent.ftRate, 1),
    orebRate: toPct(opponent.orebRate, 1),
    turnoverRate: toPct(opponent.turnoverRate, 1),
  };
};

const buildBoxScoreLine = (team: NormalizedGameStats): PostgameBoxScoreLine => ({
  fgm: team.fgm,
  fga: team.fga,
  fgPct: team.fga > 0 ? round((team.fgm / team.fga) * 100, 1) : 0,
  fgm2: team.fgm2,
  fga2: team.fga2,
  twoPct: team.fga2 > 0 ? round((team.fgm2 / team.fga2) * 100, 1) : 0,
  fgm3: team.fgm3,
  fga3: team.fga3,
  threePct: team.fga3 > 0 ? round((team.fgm3 / team.fga3) * 100, 1) : 0,
  ftm: team.ftm,
  fta: team.fta,
  ftPct: team.fta > 0 ? round((team.ftm / team.fta) * 100, 1) : 0,
  oreb: team.oreb,
  dreb: team.dreb,
  reb: team.oreb + team.dreb,
  ast: team.ast,
  tov: team.tov,
  stl: team.stl,
  blk: team.blk,
});

const buildPostgameMetrics = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const metric = (key: string, label: string, gameValue: number, seasonValue: number, unit: 'pct' | 'count', multiplier = 1) => {
    // Benchmark nélkül nincs liga medián (a 0 nem érték, hanem hiány): az oszlop elmarad.
    const leagueMedian = getLeagueMedian(benchmarks, season, key);
    return {
      key,
      label,
      game: round(gameValue * multiplier, 1),
      season: round(seasonValue * multiplier, 1),
      delta: round((gameValue - seasonValue) * multiplier, 1),
      unit,
      leagueMedian: leagueMedian !== null ? round(leagueMedian * multiplier, 1) : undefined,
    };
  };

  const keyStats: PostGameMetric[] = [
    metric('efg', 'eFG%', game.efg, season.efg, 'pct', 1),
    metric('three_pct', '3P%', game.threePct, season.threePct, 'pct', 1),
    metric('assist_rate', 'Assist%', game.assistRate, season.assistRate, 'pct', 100),
    metric('turnover_rate', 'TO rate (Oliver)', game.turnoverRate, season.turnoverRate, 'pct', 100),
    metric('oreb_rate', 'OREB%', game.orebRate, season.orebRate, 'pct', 100),
    metric('ft_rate', 'FTM rate', game.ftRate, season.ftRate, 'pct', 100),
  ];

  const efficiency: PostGameChartDatum[] = keyStats.map(item => ({
    label: item.label,
    game: item.game,
    season: item.season,
    league: item.leagueMedian,
  }));

  const shotProfile: PostGameShotProfileDatum[] = [
    {
      label: '2P arány',
      game: toPct(game.twoRate, 1),
      season: toPct(season.twoRate, 1),
    },
    {
      label: '3P arány',
      game: toPct(game.threeRate, 1),
      season: toPct(season.threeRate, 1),
    },
    {
      label: 'FTM arány',
      game: toPct(game.ftRate, 1),
      season: toPct(season.ftRate, 1),
    },
  ];

  return {
    pointsFor: game.pointsFor,
    pointsAgainst: game.pointsAgainst,
    margin: round(game.pointsFor - game.pointsAgainst, 1),
    pace: game.pace,
    efg: game.efg,
    keyStats,
    charts: {
      efficiency,
      shotProfile,
    },
  };
};

export const analyzePostGameReport = (
  teamGame: TeamGameStat,
  opponentGame: TeamGameStat | null,
  teamSeason: TeamSeasonStat,
  leagueBenchmarks: LeagueTeamBenchmarks,
  players: PlayerGameStat[],
  preGameContext?: PreGameXFactorContext
): PostGameReport => {
  const actualPointsFor = teamGame.actualPointsFor ?? teamGame.pointsFor;
  const actualPointsAgainst = teamGame.actualPointsAgainst ?? teamGame.pointsAgainst;

  const opponentFallback: TeamGameStat = opponentGame || {
    teamId: 'opponent',
    teamName: 'Ellenfél',
    league: teamGame.league,
    season: teamGame.season,
    pointsFor: actualPointsAgainst,
    pointsAgainst: actualPointsFor,
    fga2: 0,
    fgm2: 0,
    fga3: 0,
    fgm3: 0,
    fta: 0,
    ftm: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    tov: 0,
    stl: 0,
    blk: 0,
    fouls: 0,
    val: 0,
  };

  const calibratedTeamGame: TeamGameStat = {
    ...teamGame,
    pointsFor: actualPointsFor,
    pointsAgainst: actualPointsAgainst,
  };
  const calibratedOpponent: TeamGameStat = {
    ...opponentFallback,
    pointsFor: actualPointsAgainst,
    pointsAgainst: actualPointsFor,
  };

  const ownGame = normalizeTeamGame(calibratedTeamGame, calibratedOpponent);
  const opponentRaw = opponentGame ? normalizeTeamGame(calibratedOpponent, calibratedTeamGame) : null;
  // Közös birtoklásszám mindkét oldalon: a tempó és mindkét rating nevezője.
  const sharedPace = opponentRaw ? round(sharedPossessions(ownGame.pace, opponentRaw.pace), 2) : ownGame.pace;
  const game: NormalizedGameStats = { ...ownGame, pace: sharedPace };
  const opponent: NormalizedGameStats | null = opponentRaw ? { ...opponentRaw, pace: sharedPace } : null;
  // A `season` innentől a referencia: szezonátlag, vagy kis mintánál liga medián.
  const { reference: season, baseline } = resolveBaseline(normalizeTeamSeason(teamSeason), leagueBenchmarks);

  const paceDelta = classifyDelta(game.pace - season.pace, 2.5);
  const offenseDelta = classifyDelta(game.efg - season.efg, 2.5);
  // A védekezés referenciája a liga medián eFG%. A saját (támadó) eFG nem
  // viszonyítási alap az ellenfél dobáshatékonyságához, ezért nincs fallback.
  const leagueMedianEfg = getLeagueMedian(leagueBenchmarks, season, 'efg');
  const leagueMedianTo = getLeagueMedian(leagueBenchmarks, season, 'turnover_rate');
  const leagueMedianDrtg = getLeagueMedian(leagueBenchmarks, season, 'drtg');
  const ratings = buildRatings(game, season, baseline);
  const defenseContext: PostGameReport['context']['defense'] = opponent && leagueMedianEfg !== null
    ? {
        opponentEfg: round(opponent.efg, 1),
        leagueEfg: round(leagueMedianEfg, 1),
        opponentTurnoverRate: toPct(opponent.turnoverRate, 1),
        leagueTurnoverRate: leagueMedianTo !== null ? toPct(leagueMedianTo, 1) : null,
        drtg: ratings?.drtg ?? null,
        leagueDrtg: leagueMedianDrtg !== null ? round(leagueMedianDrtg, 1) : null,
      }
    : null;
  const defenseDelta = defenseContext ? classifyDefense(defenseContext) : 'Similar';

  const decisiveResult = buildDecisiveFactors(game, opponent, season, baseline, leagueBenchmarks);
  const decisive = { offense: decisiveResult.offense, defense: decisiveResult.defense };
  const decisiveAnnotations = {
    annotated: {
      offense: decisiveResult.meta.filter(item => item.axis === 'offense').map(item => item.annotated),
      defense: decisiveResult.meta.filter(item => item.axis === 'defense').map(item => item.annotated),
    },
    meta: decisiveResult.meta,
  };
  const playerReport = buildPlayerPostGameReport(players);
  const playerImpact = reconcilePlayerImpact(analyzePlayerImpact(players), playerReport);
  const ownStrengths = buildStrengths(game, season, leagueBenchmarks, baseline);
  const ownProblems = buildProblems(game, season, leagueBenchmarks, baseline);
  // A fókusz-szabályok a saját (támadó) sorok szövegére illesztenek.
  const nextFocus = buildNextFocus(game, season, ownProblems, ownStrengths, leagueBenchmarks, baseline);
  // A védekezési döntő tényezők az erősségek / problémák közé is bekerülnek –
  // különben pl. a periméter-védekezés a fókuszban szerepel, a problémák közt nem.
  const defenseLines = (tone: 'positive' | 'negative') =>
    decisiveResult.meta
      .filter(item => item.axis === 'defense' && item.tone === tone)
      .slice(0, 2)
      .map(item => `${DEFENSE_LINE_PREFIX} ${item.label}`);
  const strengths = [...ownStrengths, ...defenseLines('positive')];
  const problems = [...ownProblems, ...defenseLines('negative')];
  const xFactorReflection = buildXFactorReflection(preGameContext, game, season, opponent, decisiveAnnotations.meta);

  const metricsSummary = buildPostgameMetrics(game, season, leagueBenchmarks);
  const opponentShooting = buildOpponentShooting(opponent);

  const result: 'win' | 'loss' =
    teamGame.result ?? (actualPointsFor >= actualPointsAgainst ? 'win' : 'loss');

  const dataNotes = [
    ...(opponent ? [] : ['Ellenfél statisztikák nem elérhetők, a védekező értékelés korlátozott.']),
  ];

  const context: PostGameReport['context'] = {
    paceDelta,
    offenseEfficiencyDelta: offenseDelta,
    defenseEfficiencyDelta: defenseDelta,
    defense: defenseContext,
  };
  const opponentName = opponentGame?.teamName || opponentFallback.teamName;

  const report: PostGameReport = {
    teamId: teamGame.teamId,
    teamName: teamGame.teamName,
    opponentName,
    league: teamGame.league,
    season: teamGame.season,
    result,
    baseline,
    metrics: {
      pointsFor: metricsSummary.pointsFor,
      pointsAgainst: metricsSummary.pointsAgainst,
      margin: metricsSummary.margin,
      pace: metricsSummary.pace,
      efg: metricsSummary.efg,
      keyStats: metricsSummary.keyStats,
      ratings,
      opponent: opponentShooting,
      boxScore: { own: buildBoxScoreLine(game), opponent: opponent ? buildBoxScoreLine(opponent) : null },
    },
    charts: metricsSummary.charts,
    context,
    dataNotes,
    decisiveFactors: decisive,
    decisiveFactorAnnotations: decisiveAnnotations.annotated,
    decisiveFactorMeta: decisiveAnnotations.meta,
    playerImpact,
    playerReport,
    strengths,
    problems,
    nextFocus,
    reflection: {
      xFactor: xFactorReflection.line,
      risk: xFactorReflection.riskLine,
    },
    summaryParts: buildSummaryParts(
      teamGame.teamName,
      opponentName,
      result,
      context,
      dataNotes,
      metricsSummary,
      season,
      game,
      opponent,
      baseline,
      ratings,
      preGameContext
    ),
    summary: '',
  };

  // Az összefoglaló a kész objektumból áll össze – ugyanabból, mint a fő szekciók.
  return { ...report, summary: composePostgameSummary(report) };
};

//
// A „Következő fókusz” megjelenített listája: az ellenfélhez kötött döntő
// tényező és a riport fókuszai, majd a legfontosabb
// javítandó pont. A webes nézet és az Export MD ugyanezt a függvényt használja,
// így a két lista nem térhet el.
// ---------------------------------------------------------------------------

/** Tartalék előjel-becslés a címkéből, `tone` nélküli (régi) faktorhoz. */
export const isNegativeDecisiveLabel = (label: string, axis: 'offense' | 'defense') => {
  const lower = label.toLowerCase();
  const hasNegativeDelta = /-\d+(?:[.,]\d+)?\s*pp/.test(lower);
  const hasPositiveDelta = /\+\d+(?:[.,]\d+)?\s*pp/.test(lower);

  if (axis === 'defense') {
    if (/limit[aá]lt|kontroll|megfog|zavar/.test(lower)) return false;
    if (/probl[eé]ma|gyenge|romlott|engedett|visszaesett|hi[aá]ny/.test(lower)) return true;
    if (hasNegativeDelta && !hasPositiveDelta) return true;
    return false;
  }

  if (/hi[aá]ny|gyenge|vissza|akadozott|sz[eé]tesett|alacsony|probl[eé]ma/.test(lower)) return true;
  if (hasNegativeDelta && !hasPositiveDelta) return true;
  return false;
};

const isNegativeFactor = (item: PostGameReport['decisiveFactorMeta'][number]) =>
  item.tone ? item.tone === 'negative' : isNegativeDecisiveLabel(item.label, item.axis);

export type PostgameOpponentLinkedRow = {
  title: string;
  detail: string;
  linkedFactor?: string;
  /** `control`: saját védekezési siker – ebből nem lesz fókuszpont. */
  kind: 'opponentStrength' | 'control' | 'ownIssue';
};

/** A döntő tényezők ellenfélhez kötött bontása: védekezési faktorok, majd a saját javítandók. */
export const buildOpponentLinkedBreakdown = (report: PostGameReport): PostgameOpponentLinkedRow[] => {
  // Az enyhe (`minor`) tényező tájékoztató: sem ellenfél-erősséget, sem javítandó pontot nem vezet.
  const majorFactors = report.decisiveFactorMeta.filter(item => item.severity !== 'minor');
  const defenseFactors = majorFactors.filter(item => item.axis === 'defense');
  const offenseIssues = majorFactors
    .filter(item => item.axis === 'offense')
    .filter(isNegativeFactor);

  const rows: PostgameOpponentLinkedRow[] = [];
  defenseFactors.slice(0, 2).forEach(item => {
    // Negatív védekezési faktor = az ellenfél erőssége; pozitív = saját kontroll.
    const negative = isNegativeFactor(item);
    rows.push({
      title: negative ? `${report.opponentName} erősség` : `${report.teamName} védekezési kontroll`,
      detail: item.label,
      linkedFactor: item.label,
      kind: negative ? 'opponentStrength' : 'control',
    });
  });
  offenseIssues.slice(0, 2).forEach(item => {
    rows.push({
      title: `${report.teamName} javítandó`,
      detail: item.label,
      linkedFactor: item.label,
      kind: 'ownIssue',
    });
  });
  return rows;
};

/** Ennyi fókuszpont jelenik meg a nézetben és az exportban. */
export const POSTGAME_AUTO_FOCUS_LIMIT = 3;

const focusTopic = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('ft rate') || lower.includes('büntető')) return 'ft';
  if (
    lower.includes('to ') || lower.includes('to-rate') || lower.includes('turnover') ||
    lower.includes('labdaeladás') || lower.includes('labdabiztonság')
  ) return 'to';
  if (lower.includes('oreb') || lower.includes('második esély') || lower.includes('lepattanó')) return 'oreb';
  if (lower.includes('3p') || lower.includes('periméter')) return 'perimeter';
  return lower.replace(/\s+/g, ' ').trim();
};

const focusTopicPriority = (text: string) => {
  switch (focusTopic(text)) {
    case 'to': return 1;
    case 'ft': return 2;
    case 'perimeter': return 3;
    case 'oreb': return 4;
    default: return 9;
  }
};

/**
 * A megjelenített „Következő fókusz” lista (legfeljebb
 * `POSTGAME_AUTO_FOCUS_LIMIT` elem), témánként egy tétellel.
 */
export const buildPostgameAutoFocus = (report: PostGameReport): string[] => {
  const focus: string[] = [];
  const pushUniqueByTopic = (candidate: string) => {
    const topic = focusTopic(candidate);
    if (focus.some(item => focusTopic(item) === topic)) return;
    focus.push(candidate);
  };

  report.nextFocus.forEach(pushUniqueByTopic);

  // Fókusz csak javítandó pontból lesz, saját védekezési sikerből nem.
  const factorHint = buildOpponentLinkedBreakdown(report).find(row => row.kind !== 'control')?.detail;
  if (factorHint) focus.unshift(`Ellenfél-specifikus fókusz: ${factorHint}.`);

  if (report.problems.length > 0) pushUniqueByTopic(`Mérkőzés utáni javítás: ${report.problems[0]}.`);

  return focus
    .sort((a, b) => focusTopicPriority(a) - focusTopicPriority(b))
    .slice(0, POSTGAME_AUTO_FOCUS_LIMIT);
};
