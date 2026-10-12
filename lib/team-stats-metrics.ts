// A Csapatstatisztika nézet mutatói és a ligarangsor. A mutatók meccsenkénti
// átlagok (a dobószázalékok az összesített dobásokból, T12) és fejlett,
// 100 birtoklásra vetített értékek. A képletek a lib/stat-formulas.ts-ből jönnek
// (T22); az ASEStats döntései érvényesek: a tempó és mindkét rating közös
// birtoklásszámot használ (saját + ellenfél) / 2 (T14), a TO% Oliver-féle (T14),
// a büntetődobás-mutató FTM / FGA (T17).

import type { OptionalTotal, SideTotals, TeamStageStats } from '@/lib/team-stats-data';
import {
  effectiveFgPct,
  estimatePossessions,
  freeThrowRate,
  offensiveReboundPct,
  ratingPer100,
  shootingPct,
  trueShootingPct,
  turnoverPct,
} from '@/lib/stat-formulas';

const REGULATION_MINUTES = 48;

export type MetricGroup = 'basic' | 'advanced';
/** Megjelenítés: `count` egy tizedes, `pct` egy tizedes százalék, `rate` három tizedes arány, `signed` előjeles. */
export type MetricKind = 'count' | 'pct' | 'rate' | 'signed';
/** Melyik irány a jobb; `neutral`: nincs jó vagy rossz irány (pl. tempó), a rangsor csökkenő. */
export type MetricDirection = 'higher' | 'lower' | 'neutral';

export interface TeamMetric {
  key: string;
  label: string;
  group: MetricGroup;
  kind: MetricKind;
  direction: MetricDirection;
  /** Rövid magyarázat a táblában (a definíció, T13). */
  description: string;
  /** `null`, ha a mutató nem számolható (nincs kísérlet, nincs adat). */
  value: (stats: TeamStageStats) => number | null;
}

const perGame = (stats: TeamStageStats, total: number): number => (stats.games > 0 ? total / stats.games : 0);
const pctOrNull = (attempts: number, pct: number): number | null => (attempts > 0 ? pct : null);
const optionalPerGame = (total: OptionalTotal): number | null => (total.games > 0 ? total.sum / total.games : null);

const possessionsOf = (side: SideTotals): number =>
  estimatePossessions({ fga: side.fga, fta: side.fta, turnovers: side.tov, offensiveRebounds: side.oreb });

// Közös birtoklásszám a szezon-összesítőből: (saját + ellenfél) / 2 (T14).
const sharedPossessions = (stats: TeamStageStats): number =>
  (possessionsOf(stats.own) + possessionsOf(stats.opponent)) / 2;

export const TEAM_METRICS: readonly TeamMetric[] = [
  {
    key: 'points',
    label: 'Pont',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Szerzett pont meccsenként',
    value: s => perGame(s, s.own.points),
  },
  {
    key: 'opponentPoints',
    label: 'Kapott pont',
    group: 'basic',
    kind: 'count',
    direction: 'lower',
    description: 'Az ellenfelek pontja meccsenként',
    value: s => perGame(s, s.opponent.points),
  },
  {
    key: 'fgPct',
    label: 'FG%',
    group: 'basic',
    kind: 'pct',
    direction: 'higher',
    description: 'Mezőnyszázalék',
    value: s => pctOrNull(s.own.fga, shootingPct(s.own.fgm, s.own.fga)),
  },
  {
    key: 'threePct',
    label: '3P%',
    group: 'basic',
    kind: 'pct',
    direction: 'higher',
    description: 'Hárompontos-százalék',
    value: s => pctOrNull(s.own.fg3a, shootingPct(s.own.fg3m, s.own.fg3a)),
  },
  {
    key: 'ftPct',
    label: 'FT%',
    group: 'basic',
    kind: 'pct',
    direction: 'higher',
    description: 'Büntetődobás-százalék',
    value: s => pctOrNull(s.own.fta, shootingPct(s.own.ftm, s.own.fta)),
  },
  {
    key: 'trueShootingPct',
    label: 'TS%',
    group: 'basic',
    kind: 'pct',
    direction: 'higher',
    description: 'True shooting: pont / (2 × (FGA + 0,44 × FTA))',
    value: s => pctOrNull(s.own.fga + s.own.fta, trueShootingPct(s.own.points, s.own.fga, s.own.fta)),
  },
  {
    key: 'effectiveFgPct',
    label: 'eFG%',
    group: 'basic',
    kind: 'pct',
    direction: 'higher',
    description: 'Effektív mezőnyszázalék: (FGM + 0,5 × 3PM) / FGA',
    value: s => pctOrNull(s.own.fga, effectiveFgPct(s.own.fgm, s.own.fg3m, s.own.fga)),
  },
  {
    key: 'rebounds',
    label: 'Lepattanó',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Lepattanó meccsenként',
    value: s => perGame(s, s.own.reb),
  },
  {
    key: 'offensiveRebounds',
    label: 'Támadó lepattanó',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Támadó lepattanó meccsenként',
    value: s => perGame(s, s.own.oreb),
  },
  {
    key: 'assists',
    label: 'Gólpassz',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Gólpassz meccsenként',
    value: s => perGame(s, s.own.ast),
  },
  {
    key: 'steals',
    label: 'Szerzett labda',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Szerzett labda meccsenként',
    value: s => perGame(s, s.own.stl),
  },
  {
    key: 'blocks',
    label: 'Blokk',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Blokk meccsenként',
    value: s => perGame(s, s.own.blk),
  },
  {
    key: 'turnovers',
    label: 'Eladott labda',
    group: 'basic',
    kind: 'count',
    direction: 'lower',
    description: 'Eladott labda meccsenként (a csapatszintűekkel együtt)',
    value: s => perGame(s, s.own.tov),
  },
  {
    key: 'fouls',
    label: 'Személyi hiba',
    group: 'basic',
    kind: 'count',
    direction: 'lower',
    description: 'Személyi hiba meccsenként',
    value: s => perGame(s, s.own.pf),
  },
  {
    key: 'pointsInPaint',
    label: 'Pont a festékben',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Festékben szerzett pont meccsenként (azokból a meccsekből, ahol az ESPN megadja)',
    value: s => optionalPerGame(s.pointsInPaint),
  },
  {
    key: 'fastBreakPoints',
    label: 'Gyorsindítás pont',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Gyors indításból szerzett pont meccsenként (azokból a meccsekből, ahol az ESPN megadja)',
    value: s => optionalPerGame(s.fastBreakPoints),
  },
  {
    key: 'pointsOffTurnovers',
    label: 'Pont eladott labdából',
    group: 'basic',
    kind: 'count',
    direction: 'higher',
    description: 'Az ellenfél eladott labdáiból szerzett pont meccsenként (azokból a meccsekből, ahol az ESPN megadja)',
    value: s => optionalPerGame(s.pointsOffTurnovers),
  },
  {
    key: 'pace',
    label: 'Tempó',
    group: 'advanced',
    kind: 'count',
    direction: 'neutral',
    description: 'Közös birtoklásszám 48 percre vetítve: ((saját + ellenfél) / 2)',
    value: s => (s.gameMinutes > 0 ? (sharedPossessions(s) / s.gameMinutes) * REGULATION_MINUTES : null),
  },
  {
    key: 'offensiveRating',
    label: 'ORtg',
    group: 'advanced',
    kind: 'count',
    direction: 'higher',
    description: 'Szerzett pont 100 közös birtoklásra',
    value: s => (sharedPossessions(s) > 0 ? ratingPer100(s.own.points, sharedPossessions(s)) : null),
  },
  {
    key: 'defensiveRating',
    label: 'DRtg',
    group: 'advanced',
    kind: 'count',
    direction: 'lower',
    description: 'Kapott pont 100 közös birtoklásra',
    value: s => (sharedPossessions(s) > 0 ? ratingPer100(s.opponent.points, sharedPossessions(s)) : null),
  },
  {
    key: 'netRating',
    label: 'NetRtg',
    group: 'advanced',
    kind: 'signed',
    direction: 'higher',
    description: 'ORtg − DRtg',
    value: s =>
      sharedPossessions(s) > 0
        ? ratingPer100(s.own.points, sharedPossessions(s)) - ratingPer100(s.opponent.points, sharedPossessions(s))
        : null,
  },
  {
    key: 'turnoverPct',
    label: 'TO%',
    group: 'advanced',
    kind: 'pct',
    direction: 'lower',
    description: 'Eladott labda % (Oliver): TOV / (FGA + 0,44 × FTA + TOV)',
    value: s => pctOrNull(s.own.fga + s.own.fta + s.own.tov, turnoverPct(s.own.tov, s.own.fga, s.own.fta)),
  },
  {
    key: 'offensiveReboundPct',
    label: 'OREB%',
    group: 'advanced',
    kind: 'pct',
    direction: 'higher',
    description: 'Támadó lepattanó %: OREB / (OREB + az ellenfél DREB-je)',
    value: s =>
      pctOrNull(s.own.oreb + s.opponent.dreb, offensiveReboundPct(s.own.oreb, s.opponent.dreb)),
  },
  {
    key: 'freeThrowRate',
    label: 'FT-mutató',
    group: 'advanced',
    kind: 'rate',
    direction: 'higher',
    description: 'Büntetődobás-mutató: FTM / FGA',
    value: s => pctOrNull(s.own.fga, freeThrowRate(s.own.ftm, s.own.fga)),
  },
];

/** Egy mutató értéke a csapatra, a liga átlaga és a csapat helyezése. */
export interface TeamMetricRow {
  metric: TeamMetric;
  /** `null`, ha a mutató a csapatra nem számolható. */
  value: number | null;
  /** A rangsorban szereplő csapatok mutatóinak súlyozatlan átlaga; `null`, ha egy csapatra sem számolható. */
  leagueAverage: number | null;
  /** 1 = a legjobb; holtversenynél azonos helyezés. `null`, ha a csapat értéke nincs. */
  rank: number | null;
  /** Hány csapat szerepel a rangsorban (a szakaszban játszott csapatok, érték nélküli mutatóknál kevesebb). */
  of: number;
}

/**
 * A kiválasztott csapat mutatói a liga többi csapatához mérve. A `stageStats` egyetlen
 * szakasz csapatonkénti összesítője: a szakaszok nem keverednek, a rangsor azonos
 * szakaszon belül készül (a rájátszásban csak a bejutott csapatok szerepelnek).
 */
export function buildTeamMetricRows(stageStats: readonly TeamStageStats[], teamId: string): TeamMetricRow[] {
  const own = stageStats.find(stats => stats.teamId === teamId);
  return TEAM_METRICS.map(metric => {
    const values = stageStats.map(stats => metric.value(stats)).filter((value): value is number => value !== null);
    const value = own ? metric.value(own) : null;
    const leagueAverage = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    const better = (other: number, mine: number): boolean => (metric.direction === 'lower' ? other < mine : other > mine);
    const rank = value === null ? null : values.filter(other => better(other, value)).length + 1;
    return { metric, value, leagueAverage, rank, of: values.length };
  });
}
