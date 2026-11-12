// Szezonon belüli forma egy játékos-elemzés blokkhoz: a meccsenkénti érték, a
// gördülő átlag és a szakasz átlaga, a meccsnapló soraiból (lekérdezés nélkül).
// Tiszta függvények, a sémát nem ismerik.
//
// Minden érték összegekből számolódik (T12): a meccs értéke az egy meccs
// összege, a gördülő átlag az utolsó N meccs összege, a szakasz átlaga az összes
// meccsé. A százalék tehát nem meccsenkénti százalékok átlaga. A darabszámos
// mutatók meccsenkéntiek (nem 36 percre vetítettek): a meccsenkénti per-36 kevés
// perc mellett túl zajos.

import type { PlayerGameLogEntry } from '@/lib/player-game-log-data';
import { effectiveFgPct, shootingPct, trueShootingPct } from '@/lib/stat-formulas';

/** A Játékos-elemzés öt haladó blokkja (a `PlayerAdvancedBlocks` kártyái). */
export type TrendBlockKey = 'shooting' | 'playmaking' | 'defense' | 'scoring' | 'efficiency';

/** A gördülő átlag választható ablakai (meccs). */
export const TREND_WINDOWS = [5, 10] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

/** Egy meccs-halmaz összegei; a közeli / középtávoli dobás csak dobásadattal rendelkező meccsből. */
interface TrendTotals {
  games: number;
  minutes: number;
  points: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  closeMade: number;
  closeAttempted: number;
  midMade: number;
  midAttempted: number;
  defRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  valuation: number;
}

export type TrendUnit = 'pct' | 'count' | 'ratio';
/** Melyik irány a jobb: a több eladott labda rosszabb, a perc vagy a használat semleges. */
export type TrendPolarity = 'higher' | 'lower' | 'neutral';

export interface TrendMetric {
  key: string;
  label: string;
  unit: TrendUnit;
  polarity: TrendPolarity;
  /** `null`, ha az érték nem értelmezhető (pl. nincs dobáskísérlet). */
  compute: (totals: TrendTotals) => number | null;
}

/** Százalék csak kísérlet mellett: 0 kísérletnél nincs érték (nem 0%, T33). */
const pct = (made: number, attempted: number): number | null =>
  attempted > 0 ? shootingPct(made, attempted) : null;
const perGame = (pick: (totals: TrendTotals) => number) => (totals: TrendTotals): number | null =>
  totals.games > 0 ? pick(totals) / totals.games : null;
// A labdabirtoklás közelítése, ahogy a Játékos-elemzésben (nem USG%).
const usageProxy = (totals: TrendTotals): number =>
  totals.fgAttempted + 0.44 * totals.ftAttempted + totals.turnovers;

const TS_PCT: TrendMetric = {
  key: 'tsPct',
  label: 'TS%',
  unit: 'pct',
  polarity: 'higher',
  compute: t => (t.fgAttempted + t.ftAttempted > 0 ? trueShootingPct(t.points, t.fgAttempted, t.ftAttempted) : null),
};
const EFG_PCT: TrendMetric = {
  key: 'efgPct',
  label: 'eFG%',
  unit: 'pct',
  polarity: 'higher',
  compute: t => (t.fgAttempted > 0 ? effectiveFgPct(t.fgMade, t.threeMade, t.fgAttempted) : null),
};
const USAGE: TrendMetric = { key: 'usage', label: 'Használat', unit: 'count', polarity: 'neutral', compute: perGame(usageProxy) };

/** Blokkonként a meccsenként követhető mutatók, a kártya sorrendjében. */
export const TREND_METRICS: Record<TrendBlockKey, TrendMetric[]> = {
  shooting: [
    TS_PCT,
    EFG_PCT,
    { key: 'threePct', label: '3P%', unit: 'pct', polarity: 'higher', compute: t => pct(t.threeMade, t.threeAttempted) },
    { key: 'closePct', label: 'Közeli FG%', unit: 'pct', polarity: 'higher', compute: t => pct(t.closeMade, t.closeAttempted) },
    { key: 'midPct', label: 'Közép FG%', unit: 'pct', polarity: 'higher', compute: t => pct(t.midMade, t.midAttempted) },
    { key: 'ftPct', label: 'FT%', unit: 'pct', polarity: 'higher', compute: t => pct(t.ftMade, t.ftAttempted) },
    { key: 'threeAttempts', label: '3PA', unit: 'count', polarity: 'neutral', compute: perGame(t => t.threeAttempted) },
  ],
  playmaking: [
    { key: 'assists', label: 'AST', unit: 'count', polarity: 'higher', compute: perGame(t => t.assists) },
    { key: 'turnovers', label: 'TOV', unit: 'count', polarity: 'lower', compute: perGame(t => t.turnovers) },
    {
      key: 'astTo',
      label: 'AST / TO',
      unit: 'ratio',
      polarity: 'higher',
      compute: t => (t.turnovers > 0 ? t.assists / t.turnovers : null),
    },
    USAGE,
  ],
  defense: [
    { key: 'steals', label: 'STL', unit: 'count', polarity: 'higher', compute: perGame(t => t.steals) },
    { key: 'blocks', label: 'BLK', unit: 'count', polarity: 'higher', compute: perGame(t => t.blocks) },
    { key: 'defRebounds', label: 'DREB', unit: 'count', polarity: 'higher', compute: perGame(t => t.defRebounds) },
    { key: 'fouls', label: 'PF', unit: 'count', polarity: 'lower', compute: perGame(t => t.fouls) },
  ],
  scoring: [
    { key: 'points', label: 'PTS', unit: 'count', polarity: 'higher', compute: perGame(t => t.points) },
    TS_PCT,
    USAGE,
    { key: 'minutes', label: 'MIN', unit: 'count', polarity: 'neutral', compute: perGame(t => t.minutes) },
  ],
  efficiency: [
    { key: 'valuation', label: 'VAL', unit: 'count', polarity: 'higher', compute: perGame(t => t.valuation) },
    TS_PCT,
    EFG_PCT,
  ],
};

function sumEntries(entries: readonly PlayerGameLogEntry[]): TrendTotals {
  const totals: TrendTotals = {
    games: 0,
    minutes: 0,
    points: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    closeMade: 0,
    closeAttempted: 0,
    midMade: 0,
    midAttempted: 0,
    defRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    valuation: 0,
  };
  for (const entry of entries) {
    totals.games += 1;
    totals.minutes += entry.minutes;
    totals.points += entry.points;
    totals.fgMade += entry.fgMade;
    totals.fgAttempted += entry.fgAttempted;
    totals.threeMade += entry.threeMade;
    totals.threeAttempted += entry.threeAttempted;
    totals.ftMade += entry.ftMade;
    totals.ftAttempted += entry.ftAttempted;
    // Dobásadat nélküli meccs nem számít bele a zóna-arányba.
    totals.closeMade += entry.closeMade ?? 0;
    totals.closeAttempted += entry.closeAttempted ?? 0;
    totals.midMade += entry.midMade ?? 0;
    totals.midAttempted += entry.midAttempted ?? 0;
    totals.defRebounds += entry.defRebounds;
    totals.assists += entry.assists;
    totals.steals += entry.steals;
    totals.blocks += entry.blocks;
    totals.turnovers += entry.turnovers;
    totals.fouls += entry.fouls;
    totals.valuation += entry.valuation;
  }
  return totals;
}

export interface TrendPoint {
  gameId: string;
  /** 1-től számozva, időrendben. */
  index: number;
  gameDate: string;
  opponentTeamId: string;
  isHome: boolean;
  /** A meccs értéke; `null`, ha nem értelmezhető (pl. nem dobott hármast). */
  value: number | null;
  /** Az utolsó `window` meccs összegéből; `null`, amíg nincs meg a teljes ablak. */
  rolling: number | null;
}

export interface TrendSeries {
  points: TrendPoint[];
  /** A szakasz átlaga (az összes meccs összegéből); `null`, ha nem értelmezhető. */
  average: number | null;
  /** Az utolsó teljes ablak és a szakasz átlagának különbsége; `null`, ha bármelyik hiányzik. */
  lastRollingDelta: number | null;
}

/**
 * A mutató meccsenkénti sora. A bejegyzések bármilyen sorrendben jöhetnek, a
 * kimenet időrendi. A gördülő átlag csak teljes ablakkal indul: a szakasz első
 * meccseinél a kevés meccs átlaga félrevezető lenne.
 */
export function buildTrendSeries(
  entries: readonly PlayerGameLogEntry[],
  metric: TrendMetric,
  window: TrendWindow,
): TrendSeries {
  const ordered = [...entries].sort(
    (a, b) =>
      a.game.gameDate.localeCompare(b.game.gameDate) ||
      (a.game.startTime ?? '').localeCompare(b.game.startTime ?? ''),
  );
  const points = ordered.map((entry, i): TrendPoint => ({
    gameId: entry.game.id,
    index: i + 1,
    gameDate: entry.game.gameDate,
    opponentTeamId: entry.game.opponentTeamId,
    isHome: entry.game.isHome,
    value: metric.compute(sumEntries([entry])),
    rolling: i + 1 >= window ? metric.compute(sumEntries(ordered.slice(i + 1 - window, i + 1))) : null,
  }));
  const average = metric.compute(sumEntries(ordered));
  const lastRolling = points.at(-1)?.rolling ?? null;
  return {
    points,
    average,
    lastRollingDelta: lastRolling !== null && average !== null ? lastRolling - average : null,
  };
}

/** Megjelenítés: százalék és darabszám 1 tizedessel, arány 2 tizedessel. */
export function formatTrendValue(value: number, unit: TrendUnit): string {
  if (unit === 'pct') return `${value.toFixed(1)}%`;
  if (unit === 'ratio') return value.toFixed(2);
  return value.toFixed(1);
}
