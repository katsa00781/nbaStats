// Szituációs elemzés (az ASEStats `situational-analysis` motorjának NBA-portja):
// hazai / vendég, szoros és gálameccsek, hosszabbításos meccsek, forma. A motor tiszta
// függvény, adatbázist nem ismer; a bemenetet a lib/adapters/situational-adapter.ts állítja
// elő. Egyszerre egy szakasz meccseit kapja (a szakaszok nem keverednek).
//
// Ami az ASEStats-változatból kimaradt: a negyedenkénti bontás (negyedek mérlege, félidei
// vezetés, az 1. negyed megnyerése). A `games` táblában nincs linescore, így nincs
// adat hozzá; a séma-bővítés külön döntés (BACKLOG: Negyedenkénti eredmény).
// A fejlett mutatók nem meccsenkénti értékek átlagai, hanem az összesített box
// score-ból jönnek (T12), ugyanazzal a képlettel, mint a Csapatstatisztika (T14, T17).

import type { TeamStageStats } from '@/lib/team-stats-data';
import { TEAM_METRICS } from '@/lib/team-stats-metrics';

/** Szoros meccs: a különbség legfeljebb ennyi pont (az ASEStats-döntés változatlanul). */
export const CLOSE_GAME_MARGIN = 5;
/** Gálameccs: a különbség legalább ennyi pont (az ASEStats-döntés változatlanul). */
export const BLOWOUT_MARGIN = 15;
/** A gördülő győzelmi arány ablaka (meccs). */
export const FORM_WINDOW = 5;

/** Egy lejátszott meccs a vizsgált csapat nézőpontjából. */
export interface SituationGame {
  id: string;
  /** Amerikai keleti parti helyi nap (YYYY-MM-DD). */
  date: string;
  opponent: string;
  isHome: boolean;
  ourScore: number;
  oppScore: number;
  /** Hosszabbítások száma (0 = rendes játékidő). */
  overtimes: number;
}

/** Az összesített box score a teljes, a hazai és a vendég meccsekre; `null`, ha egy meccshez sincs csapatsor. */
export interface SituationMetricStats {
  all: TeamStageStats | null;
  home: TeamStageStats | null;
  away: TeamStageStats | null;
}

export interface SituationResult {
  label: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface FormEntry {
  gameIndex: number;
  date: string;
  opponent: string;
  result: 'W' | 'L';
  ourScore: number;
  oppScore: number;
  margin: number;
  /** Az utolsó `FORM_WINDOW` meccs győzelmi aránya; az első `FORM_WINDOW - 1` meccsnél `null`. */
  rollingWinRate: number | null;
}

/** A mutatók `null`-ok, ha a szűrt meccsekre nem számolhatók. */
export interface MetricsData {
  ortg: number | null;
  efg: number | null;
  tovPct: number | null;
  orbPct: number | null;
  ftRate: number | null;
  homeOrtg: number | null;
  awayOrtg: number | null;
  homeEfg: number | null;
  awayEfg: number | null;
}

export interface SituationalData {
  situations: {
    home: SituationResult;
    away: SituationResult;
    closeGames: SituationResult;
    blowouts: SituationResult;
    overtime: SituationResult;
  };
  form: FormEntry[];
  metrics: MetricsData;
  gamesWithMetricsData: number;
  totalGames: number;
}

function sitResult(label: string, wins: number, total: number): SituationResult {
  return { label, wins, losses: total - wins, total, winRate: total > 0 ? wins / total : 0 };
}

function metricValue(key: string, stats: TeamStageStats | null): number | null {
  if (!stats) return null;
  const metric = TEAM_METRICS.find(m => m.key === key);
  if (!metric) throw new Error(`Ismeretlen csapatmutató: ${key}`);
  return metric.value(stats);
}

export function buildSituationalData(games: SituationGame[], metricStats: SituationMetricStats): SituationalData {
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const tally = { home: [0, 0], away: [0, 0], close: [0, 0], blowout: [0, 0], overtime: [0, 0] };
  const count = (bucket: number[], won: boolean) => {
    bucket[1]++;
    if (won) bucket[0]++;
  };

  const form: FormEntry[] = [];
  const results: boolean[] = [];
  sorted.forEach((game, index) => {
    const margin = game.ourScore - game.oppScore;
    const won = margin > 0;
    const absMargin = Math.abs(margin);
    count(game.isHome ? tally.home : tally.away, won);
    if (absMargin <= CLOSE_GAME_MARGIN) count(tally.close, won);
    if (absMargin >= BLOWOUT_MARGIN) count(tally.blowout, won);
    if (game.overtimes > 0) count(tally.overtime, won);

    results.push(won);
    const window = results.slice(-FORM_WINDOW);
    form.push({
      gameIndex: index + 1,
      date: game.date,
      opponent: game.opponent,
      result: won ? 'W' : 'L',
      ourScore: game.ourScore,
      oppScore: game.oppScore,
      margin,
      rollingWinRate: window.length === FORM_WINDOW ? window.filter(Boolean).length / FORM_WINDOW : null,
    });
  });

  return {
    situations: {
      home: sitResult('Hazai', tally.home[0], tally.home[1]),
      away: sitResult('Vendég', tally.away[0], tally.away[1]),
      closeGames: sitResult(`Szoros (≤${CLOSE_GAME_MARGIN} p)`, tally.close[0], tally.close[1]),
      blowouts: sitResult(`Gálameccs (≥${BLOWOUT_MARGIN} p)`, tally.blowout[0], tally.blowout[1]),
      overtime: sitResult('Hosszabbítás', tally.overtime[0], tally.overtime[1]),
    },
    form,
    metrics: {
      ortg: metricValue('offensiveRating', metricStats.all),
      efg: metricValue('effectiveFgPct', metricStats.all),
      tovPct: metricValue('turnoverPct', metricStats.all),
      orbPct: metricValue('offensiveReboundPct', metricStats.all),
      ftRate: metricValue('freeThrowRate', metricStats.all),
      homeOrtg: metricValue('offensiveRating', metricStats.home),
      awayOrtg: metricValue('offensiveRating', metricStats.away),
      homeEfg: metricValue('effectiveFgPct', metricStats.home),
      awayEfg: metricValue('effectiveFgPct', metricStats.away),
    },
    gamesWithMetricsData: metricStats.all?.games ?? 0,
    totalGames: sorted.length,
  };
}
