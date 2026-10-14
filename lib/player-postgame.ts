// A játékos-szintű meccs utáni elemző motor: az ASEStats `player-postgame` portja.
// Tiszta függvények, a sémát nem ismerik; a bemenetet az adapter
// (lib/adapters/postgame-adapter.ts) állítja elő.
//
// Eltérések az ASEStatstől:
//  - a percküszöbök 48 percre vannak hangolva: az ASEStats 40 perces értékeit ×1,2-vel
//    skáláztuk, és a `MINUTES_SCALE` konstansba emeltük (nehéz terhelés, rotáció,
//    alappillér, MVP és szerepjátékos minimum);
//  - az Impact score osztályküszöbei NBA-adaton újrakalibrálva (lásd `ENGINE_MIN_SCORE`);
//    a „gyenge meccs” kiemelésbe csak rotációs percet kapó játékos kerül;
//  - a dobástérkép-alapú jelzések (`appendShotMapSignals`) kimaradtak: nincs NBA-geometria.

/** A 40 perces FIBA-meccs → 48 perces NBA-meccs percskálája. */
const MINUTES_SCALE = 48 / 40;
const scaleMinutes = (minutes: number) => Math.round(minutes * MINUTES_SCALE);

import type { PlayerGameStat, Position } from '@/lib/postgame-report';
import { trueShootingPct } from '@/lib/stat-formulas';

export type PlayerMinutesBucket = 'micro' | 'rotation' | 'heavy';
export type PlayerUsageTier = 'low' | 'balanced' | 'high';
export type PlayerImpactClass = 'mvp' | 'engine' | 'support' | 'struggling';

export type PlayerPostGameBreakdown = {
  playerId: string;
  name: string;
  position: Position;
  isStarter: boolean;
  minutes: number;
  minutesBucket: PlayerMinutesBucket;
  roles: string[];
  /**
   * Standard, perc-normalizált USG% (0–1): a játékos pályán töltött idejében
   * a csapat-befejezések (FGA + 0,44·FTA + LV) hányadát ő használta. Egy
   * átlagos játékos ~0,20; az értékek összege nem 1. A név történeti.
   */
  usageShare: number;
  usageTier: PlayerUsageTier;
  usageLabel: string;
  val: number;
  valPer36: number;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  stocks: number;
  fouls: number;
  tsPct: number;
  hasShotAttempts: boolean;
  impactScore: number;
  impactClass: PlayerImpactClass;
  impactLabel: string;
  impactTags: string[];
  summaryLine: string;
  strengths: string[];
  issues: string[];
  focus: string[];
  llmContext: PlayerPostGameLLMContext;
};

export type PlayerPostGameLLMContext = {
  isStarter: boolean;
  minutesBucket: PlayerMinutesBucket;
  usageTier: PlayerUsageTier;
  usageSharePct: number;
  tsPct: number;
  val: number;
  valPer36: number;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  impactLabel: string;
  impactTags: string[];
  strengths: string[];
  issues: string[];
  focus: string[];
};

export type PlayerPostGameReport = {
  players: PlayerPostGameBreakdown[];
  highlights: {
    mvp?: PlayerPostGameBreakdown;
    engines: PlayerPostGameBreakdown[];
    sparkPlugs: PlayerPostGameBreakdown[];
    struggling: PlayerPostGameBreakdown[];
  };
};

const round = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const computePlayerUsage = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  return fga + 0.44 * player.fta + player.tov;
};

/** A USG% felső korlátja: pár perces mintánál a képlet irreálisan nagyot adhat. */
const MAX_USG_RATE = 0.6;

/**
 * Standard USG% (0–1): `usage · (csapatperc / 5) / (perc · csapat-usage)`,
 * ahol usage = FGA + 0,44·FTA + LV. Perc vagy csapatadat nélkül 0.
 */
export const computeUsgRate = (
  player: { usage: number; minutes: number },
  team: { usage: number; minutes: number }
) => {
  if (!(player.minutes > 0) || !(team.usage > 0) || !(team.minutes > 0)) return 0;
  return clamp((player.usage * (team.minutes / 5)) / (player.minutes * team.usage), 0, MAX_USG_RATE);
};

/** A meccs keretének USG%-a játékosonként (`playerId` → 0–1). */
export const computeUsageRates = (players: PlayerGameStat[]) => {
  const team = players.reduce(
    (acc, player) => ({ usage: acc.usage + computePlayerUsage(player), minutes: acc.minutes + player.minutes }),
    { usage: 0, minutes: 0 }
  );
  return new Map(
    players.map(player => [
      player.playerId,
      computeUsgRate({ usage: computePlayerUsage(player), minutes: player.minutes }, team),
    ])
  );
};

/** Percsávok (ASEStats: 26 / 12 perc). */
const HEAVY_MINUTES = scaleMinutes(26);
const ROTATION_MINUTES = scaleMinutes(12);

const classifyMinutesBucket = (minutes: number): PlayerMinutesBucket => {
  if (minutes >= HEAVY_MINUTES) return 'heavy';
  if (minutes >= ROTATION_MINUTES) return 'rotation';
  return 'micro';
};

/** USG% küszöbök (felhasználói döntés, 2026-09-28): alacsony ≤ 15%, magas ≥ 25%. */
export const USG_LOW_MAX = 0.15;
export const USG_HIGH_MIN = 0.25;

const classifyUsageTier = (usgRate: number): PlayerUsageTier => {
  if (usgRate >= USG_HIGH_MIN) return 'high';
  if (usgRate > USG_LOW_MAX) return 'balanced';
  return 'low';
};

const mapUsageLabel = (usageTier: PlayerUsageTier) => {
  switch (usageTier) {
    case 'high':
      return 'Magas usage';
    case 'balanced':
      return 'Kiegyensúlyozott usage';
    default:
      return 'Limitált usage';
  }
};

const mapImpactLabel = (impactClass: PlayerImpactClass) => {
  switch (impactClass) {
    case 'mvp':
      return 'Elsődleges motor';
    case 'engine':
      return 'Stabil alappillér';
    case 'support':
      return 'Rotációs hozzájárulás';
    default:
      return 'Limitált hatás';
  }
};

/**
 * Az „alappillér” (`engine`) és a „rotációs hozzájárulás” (`support`) osztály Impact score
 * küszöbe. NBA-kalibráció (2025/26, 5 csapat × 40 meccs, 1615 játékos-meccs ≥ 15 percből):
 * az ASEStats 52 / 38 küszöbe a pontszámok P78 / P50 értékére esett, így a legalább 15 percet
 * játszók fele „Limitált hatás” lett (a 30+ percet játszóknak is 37%-a). A küszöbök az
 * eloszlás P70 / P25 értékéhez kerültek (47 / 25).
 */
export const ENGINE_MIN_SCORE = 47;
export const SUPPORT_MIN_SCORE = 25;

/** Elég játékidő az `engine` osztályhoz: 16 perc, kezdőnél 12. */
export const ENGINE_MINUTES = scaleMinutes(16);
export const ENGINE_STARTER_MINUTES = scaleMinutes(12);
const hasEngineMinutes = (minutes: number, isStarter: boolean) =>
  minutes >= ENGINE_MINUTES || (isStarter && minutes >= ENGINE_STARTER_MINUTES);

/** A „Hatékony szerepjátékos” küszöbei: VAL/36, TS% és játékidő alacsony usage mellett. */
export const ROLE_PLAYER_MIN_VAL_PER36 = 18;
export const ROLE_PLAYER_MIN_TS_PCT = 55;
export const ROLE_PLAYER_MIN_MINUTES = scaleMinutes(12);

/**
 * Hatékony szerepjátékos: alacsony usage (≤ 15%) mellett erős és hatékony
 * termelés. Az Impact score-ban a usage 20%-ot ér, ezért az ilyen játékos
 * pontszáma a „Limitált hatás” sávba csúszhat, miközben a meccsszintű
 * kiemelések közt „Kiugró teljesítmény” – a két szabály ne mondjon ellent.
 */
const isEfficientRolePlayer = (context: DerivedPlayerContext, minutes: number) =>
  context.usageTier === 'low' &&
  minutes >= ROLE_PLAYER_MIN_MINUTES &&
  context.valPer36 >= ROLE_PLAYER_MIN_VAL_PER36 &&
  context.tsPct >= ROLE_PLAYER_MIN_TS_PCT;

/**
 * A címke rangja mindig az impact osztályt követi; a szerep és a játékidő csak
 * jelző. Kivétel a „Hatékony szerepjátékos”: az szerepet nevez meg (alacsony
 * usage melletti hatékony termelés), nem rangot. (A korábbi szabály a padról jövő `engine`-t „Rotációs
 * hozzájárulás”-ra, a sokat játszó kezdő `support`-ot „Stabil alappillér”-re
 * írta át, így a magasabb Impact score alacsonyabb rangú címkét kaphatott.)
 * Ha valaki az alappillér-szintű pontszámot kevés percben éri el, a címke ezt
 * kimondja – különben a sorrendben fölötte álló, de alacsonyabb címkéjű sor
 * megmagyarázatlan ellentmondásnak látszik.
 */
const mapContextualImpactLabel = (
  impactClass: PlayerImpactClass,
  context: DerivedPlayerContext,
  impactScore: number,
  minutes: number
) => {
  if (impactClass === 'mvp' && context.usageTier === 'low') {
    return 'Hatékony szerepjátékos';
  }
  if (impactClass === 'support' && isEfficientRolePlayer(context, minutes)) {
    return 'Hatékony szerepjátékos';
  }
  if (impactClass === 'engine' && !context.isStarter) {
    return 'Stabil alappillér (padról)';
  }
  if (impactClass === 'support' && impactScore >= ENGINE_MIN_SCORE && !hasEngineMinutes(minutes, context.isStarter)) {
    return 'Rotációs hozzájárulás (rövid percben)';
  }
  return mapImpactLabel(impactClass);
};

const getFouls = (player: PlayerGameStat) => {
  const candidate = (player as PlayerGameStat & { fouls?: number }).fouls;
  return typeof candidate === 'number' ? candidate : 0;
};

const buildStrengths = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const strengths: string[] = [];
  if (player.points >= 18 || context.tsPct >= 60) strengths.push('Stabil pontszerzés és dobáshatékonyság');
  if (context.usageTier === 'high' && context.tsPct >= 55) strengths.push('Magas usage mellett hatékony befejezések');
  if (player.ast >= 5 || context.assistShare >= 0.3) strengths.push('Playmaking és labdajáratás stabilizálása');
  if (context.reboundShare >= 0.24 || player.oreb >= 4) strengths.push('Lepattanó fölény, második esélyek');
  if (player.stl + player.blk >= 4) strengths.push('Védekezési playmaker (lopások/blokkok)');
  if (context.valPer36 >= 18) strengths.push('VAL/36 dominancia, meccsszintű impact');
  if (!context.isStarter && context.minutesBucket !== 'heavy' && context.valPer36 >= 16) {
    strengths.push('Padlóról érkező szikra rövid idő alatt');
  }
  return strengths;
};

const buildIssues = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const issues: string[] = [];
  if (context.tsPct <= 47 && context.usageTier !== 'low') issues.push('Dobáshatékonysági ingadozás a terheléshez képest');
  if (context.turnoverShare >= 0.25 || player.tov >= 4) issues.push('Labdavesztés-limitáció');
  if (getFouls(player) >= 4) issues.push('Fault-terhelés kontroll');
  if (context.minutesBucket === 'heavy' && context.valPer36 < 11) issues.push('Hosszú játékidő mellett alacsony VAL');
  return issues;
};

const focusMap: Record<string, string> = {
  'Dobáshatékonysági ingadozás a terheléshez képest': 'Dobásminőség és ritmus stabilizálása, több festékből érkező befejezés',
  'Labdavesztés-limitáció': 'Egyszerűsített döntéshozatal és első passz biztosítása',
  'Fault-terhelés kontroll': 'Védekezési pozíció, függőleges védekezés, kontaktus menedzsment',
  'Hosszú játékidő mellett alacsony VAL': 'Energia menedzsment, kevesebb erőltetett helyzet magas usage mellett',
};

const buildFocus = (issues: string[]) => {
  const mapped = issues.map(issue => focusMap[issue]).filter(Boolean);
  if (mapped.length === 0) return ['Fenntartandó energia és fegyelem'];
  return Array.from(new Set(mapped));
};

type DerivedPlayerContext = {
  isStarter: boolean;
  minutesBucket: PlayerMinutesBucket;
  usageTier: PlayerUsageTier;
  usageShare: number;
  tsPct: number;
  valPer36: number;
  reboundShare: number;
  assistShare: number;
  turnoverShare: number;
};

const buildImpactTags = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const tags: string[] = [];
  if (player.points >= 16 || context.tsPct >= 58) tags.push('shotmaking');
  if (player.ast >= 5 || context.assistShare >= 0.3) tags.push('playmaking');
  if (player.oreb + player.dreb >= 8 || context.reboundShare >= 0.25) tags.push('rebounding');
  if (player.stl + player.blk >= 4) tags.push('defense');
  if (player.tov >= 4 || context.turnoverShare >= 0.25) tags.push('sloppy');
  if (getFouls(player) >= 4) tags.push('foul_trouble');
  if (!context.isStarter && context.minutesBucket !== 'heavy' && context.valPer36 >= 16) tags.push('spark');
  return tags;
};

const computeImpactScore = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  // Wider normalization ranges so elite games (53 VAL/36, 107% TS) score
  // clearly higher than solid ones (39 VAL/36, 89% TS) instead of both
  // being clamped to 1.0.
  const normalizedVal = clamp(context.valPer36 / 45, 0, 1);
  const normalizedTs = clamp((context.tsPct - 45) / 75, 0, 1);
  // USG% 10–35% között skálázva (átlagos játékos ~20% → 0,4).
  const normalizedUsage = clamp((context.usageShare - 0.1) / 0.25, 0, 1);
  const normalizedStocks = clamp((player.stl + player.blk) / 4, 0, 1);
  return round((normalizedVal * 0.45 + normalizedTs * 0.25 + normalizedUsage * 0.2 + normalizedStocks * 0.1) * 100, 1);
};

/** Az MVP / társvezető minimális játékideje (ASEStats: 22 / 18 perc). */
const MVP_MINUTES = scaleMinutes(22);
const TOP_PERFORMER_MINUTES = scaleMinutes(18);

/** A meccs legjobb impact score-jához képest ezen belül „társvezető” a játékos. */
const TOP_PERFORMER_BAND = 0.9;

const classifyImpact = (
  score: number,
  context: DerivedPlayerContext,
  minutes: number,
  maxScoreInGame: number
): PlayerImpactClass => {
  if (context.minutesBucket === 'micro') {
    if (score >= 55) return 'support';
    return 'struggling';
  }

  // Top performer in this game with sufficient minutes → MVP regardless of
  // starter status, so a dominant bench scorer isn't capped at 'engine'.
  // A 60-as küszöb a meccs legjobbjára vonatkozik; a sávon belüli társvezetők
  // ugyanazt a címkét kapják (különben pl. 61 vs 57,7 score más címkét adna).
  const isTopPerformer = maxScoreInGame >= 60 && score >= maxScoreInGame * TOP_PERFORMER_BAND && minutes >= TOP_PERFORMER_MINUTES;
  if (isTopPerformer) return 'mvp';

  const eligibleForMvp = minutes >= MVP_MINUTES && (context.isStarter || context.minutesBucket === 'heavy');
  if (eligibleForMvp && score >= 68) return 'mvp';

  if (hasEngineMinutes(minutes, context.isStarter) && score >= ENGINE_MIN_SCORE) return 'engine';

  if (score >= SUPPORT_MIN_SCORE) return 'support';
  // Alacsony usage melletti hatékony termelés nem „Limitált hatás”.
  if (isEfficientRolePlayer(context, minutes)) return 'support';
  return 'struggling';
};

const computeTrueShooting = (player: PlayerGameStat) =>
  trueShootingPct(player.points, player.fga2 + player.fga3, player.fta);

const buildSummaryLine = (player: PlayerGameStat, context: DerivedPlayerContext, usageShare: number) => {
  const rebounds = player.oreb + player.dreb;
  const parts = [
    `${round(player.minutes, 1)} perc`,
    `${player.points} pont`,
    `${rebounds} lep`,
    `${player.ast} ast`,
  ];
  const hasShotAttempts = player.fga2 + player.fga3 + player.fta > 0;
  const tsDisplay = hasShotAttempts ? `${round(context.tsPct, 1)}%` : '–';
  return `${parts.join(' • ')} | TS ${tsDisplay} • Usage ${(usageShare * 100).toFixed(1)}%`;
};

export const buildPlayerPostGameReport = (players: PlayerGameStat[]): PlayerPostGameReport => {
  const hasExplicitStarterInfo = players.some(player => typeof player.isStarter === 'boolean');

  const starterIds = new Set(
    [...players]
      .filter(player => player.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .map(player => player.playerId)
  );

  const usageRates = computeUsageRates(players);
  const totals = players.reduce(
    (acc, player) => {
      acc.val += player.val;
      acc.rebounds += player.oreb + player.dreb;
      acc.assists += player.ast;
      acc.turnovers += player.tov;
      return acc;
    },
    { val: 0, rebounds: 0, assists: 0, turnovers: 0 }
  );

  // Pass 1: derive contexts and compute raw impact scores so we can find the
  // game-best score before classifying anyone (needed for relative MVP logic).
  type PlayerDraft = {
    player: PlayerGameStat;
    isStarter: boolean;
    minutesBucket: PlayerMinutesBucket;
    usage: number;
    usageShare: number;
    context: DerivedPlayerContext;
    impactScore: number;
  };

  const drafts: PlayerDraft[] = players.map(player => {
    const isStarter = hasExplicitStarterInfo
      ? player.isStarter === true
      : starterIds.has(player.playerId);
    const minutesBucket = classifyMinutesBucket(player.minutes);
    const usage = computePlayerUsage(player);
    const usageShare = usageRates.get(player.playerId) ?? 0;
    const usageTier = classifyUsageTier(usageShare);
    const tsPct = computeTrueShooting(player);
    const valPer36 = player.minutes > 0 ? (player.val / player.minutes) * 36 : player.val;
    const reboundShare = totals.rebounds > 0 ? (player.oreb + player.dreb) / totals.rebounds : 0;
    const assistShare = totals.assists > 0 ? player.ast / totals.assists : 0;
    const turnoverShare = totals.turnovers > 0 ? player.tov / totals.turnovers : 0;

    const context: DerivedPlayerContext = {
      isStarter,
      minutesBucket,
      usageTier,
      usageShare,
      tsPct,
      valPer36,
      reboundShare,
      assistShare,
      turnoverShare,
    };

    return { player, isStarter, minutesBucket, usage, usageShare, context, impactScore: computeImpactScore(player, context) };
  });

  const maxScoreInGame = drafts.reduce((max, d) => Math.max(max, d.impactScore), 0);

  // Pass 2: classify and build full breakdowns now that maxScoreInGame is known.
  const breakdowns: PlayerPostGameBreakdown[] = drafts.map(({ player, isStarter, minutesBucket, usageShare, context, impactScore }) => {
    const strengths = buildStrengths(player, context);
    const issues = buildIssues(player, context);
    const focus = buildFocus(issues);
    const impactTags = buildImpactTags(player, context);
    const impactClass = classifyImpact(impactScore, context, player.minutes, maxScoreInGame);
    const impactLabel = mapContextualImpactLabel(impactClass, context, impactScore, player.minutes);

    return {
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      isStarter,
      minutes: player.minutes,
      minutesBucket,
      roles: player.roles,
      usageShare,
      usageTier: context.usageTier,
      usageLabel: mapUsageLabel(context.usageTier),
      val: player.val,
      valPer36: round(context.valPer36, 1),
      points: player.points,
      rebounds: player.oreb + player.dreb,
      assists: player.ast,
      turnovers: player.tov,
      stocks: player.stl + player.blk,
      fouls: getFouls(player),
      tsPct: round(context.tsPct, 1),
      hasShotAttempts: player.fga2 + player.fga3 + player.fta > 0,
      impactScore,
      impactClass,
      impactLabel,
      impactTags,
      summaryLine: buildSummaryLine(player, context, usageShare),
      strengths,
      issues,
      focus,
      llmContext: {
        isStarter,
        minutesBucket,
        usageTier: context.usageTier,
        usageSharePct: round(usageShare * 100, 1),
        tsPct: round(context.tsPct, 1),
        val: player.val,
        valPer36: round(context.valPer36, 1),
        points: player.points,
        rebounds: player.oreb + player.dreb,
        assists: player.ast,
        turnovers: player.tov,
        steals: player.stl,
        blocks: player.blk,
        fouls: getFouls(player),
        impactLabel,
        impactTags,
        strengths,
        issues,
        focus,
      },
    };
  });

  const sortedBreakdowns = breakdowns.sort((a, b) => b.impactScore - a.impactScore);

  const claimed = new Set<string>();
  const mvp = sortedBreakdowns.find(player => player.impactClass === 'mvp');
  if (mvp) claimed.add(mvp.playerId);

  const engines = sortedBreakdowns
    .filter(player => player.impactClass === 'engine' && !claimed.has(player.playerId))
    .slice(0, 2);
  engines.forEach(player => claimed.add(player.playerId));

  const sparkPlugs = sortedBreakdowns
    .filter(player => !player.isStarter && player.minutesBucket !== 'heavy' && player.impactScore >= 60 && !claimed.has(player.playerId))
    .slice(0, 2);
  sparkPlugs.forEach(player => claimed.add(player.playerId));

  const struggling = sortedBreakdowns
    .filter(
      player =>
        player.impactClass === 'struggling' && player.minutes >= ROTATION_MINUTES && !claimed.has(player.playerId),
    )
    .slice(0, 2);

  const highlights = {
    mvp,
    engines,
    sparkPlugs,
    struggling,
  };

  return {
    players: sortedBreakdowns,
    highlights,
  };
};
