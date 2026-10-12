'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { FormEntry, MetricsData, SituationResult } from '@/lib/situational-analysis';
import type { MetricKind } from '@/lib/team-stats-metrics';
import { formatMetricValue, formatSigned } from '@/components/TeamStatsTable';
import { formatWinPct } from '@/components/StandingsTable';
import { DataTable } from '@/components/ui/data-table';
import { formatGameDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';

const EMPTY = '–';

const SITUATION_COLUMNS: ColumnDef<SituationResult>[] = [
  { key: 'label', label: 'Szituáció', sortAccessor: row => row.label, render: row => row.label },
  {
    key: 'record',
    label: 'Mérleg',
    numeric: true,
    sortAccessor: row => row.wins,
    render: row => (row.total > 0 ? `${row.wins}–${row.losses}` : EMPTY),
  },
  { key: 'total', label: 'Meccs', numeric: true, sortAccessor: row => row.total, render: row => row.total },
  {
    key: 'winRate',
    label: 'GY%',
    numeric: true,
    // Meccs nélküli sor a végére kerül, nem 0%-ként.
    sortAccessor: row => (row.total > 0 ? row.winRate : Number.NEGATIVE_INFINITY),
    render: row => (row.total > 0 ? formatWinPct(row.winRate) : EMPTY),
  },
];

/** A szituációk mérlege: hazai / vendég, szoros, gála, hosszabbítás. */
export function SituationsTable({ rows }: { rows: SituationResult[] }) {
  return <DataTable columns={SITUATION_COLUMNS} rows={rows} getRowId={row => row.label} />;
}

export interface SituationMetricRow {
  key: string;
  label: string;
  kind: MetricKind;
  all: number | null;
  home: number | null;
  away: number | null;
}

/** A motor mutatóiból a tábla sorai; a hazai / vendég bontás csak az ORtg-nél és az eFG%-nál van. */
export function toMetricRows(metrics: MetricsData): SituationMetricRow[] {
  return [
    { key: 'ortg', label: 'ORtg', kind: 'count', all: metrics.ortg, home: metrics.homeOrtg, away: metrics.awayOrtg },
    { key: 'efg', label: 'eFG%', kind: 'pct', all: metrics.efg, home: metrics.homeEfg, away: metrics.awayEfg },
    { key: 'tov', label: 'TO%', kind: 'pct', all: metrics.tovPct, home: null, away: null },
    { key: 'orb', label: 'OREB%', kind: 'pct', all: metrics.orbPct, home: null, away: null },
    { key: 'ftr', label: 'FT-mutató', kind: 'rate', all: metrics.ftRate, home: null, away: null },
  ];
}

const metricColumn = (key: 'all' | 'home' | 'away', label: string): ColumnDef<SituationMetricRow> => ({
  key,
  label,
  numeric: true,
  sortAccessor: row => row[key] ?? Number.NEGATIVE_INFINITY,
  render: row => formatMetricValue(row.kind, row[key]),
});

const METRIC_COLUMNS: ColumnDef<SituationMetricRow>[] = [
  { key: 'label', label: 'Mutató', sortAccessor: row => row.label, render: row => row.label },
  metricColumn('all', 'Összes'),
  metricColumn('home', 'Hazai'),
  metricColumn('away', 'Vendég'),
];

/** Fejlett mutatók az összes, a hazai és a vendég meccsre (összesített box score-ból, T12). */
export function SituationMetricsTable({ rows }: { rows: SituationMetricRow[] }) {
  return <DataTable columns={METRIC_COLUMNS} rows={rows} getRowId={row => row.key} />;
}

const FORM_COLUMNS: ColumnDef<FormEntry>[] = [
  { key: 'date', label: 'Dátum', sortAccessor: row => row.date, render: row => formatGameDate(row.date) },
  { key: 'opponent', label: 'Ellenfél', sortAccessor: row => row.opponent, render: row => row.opponent },
  {
    key: 'result',
    label: 'Kimenetel',
    center: true,
    sortAccessor: row => row.result,
    render: row => (
      <span className={cn('dt-badge', row.result === 'W' ? 'dt-badge--win' : 'dt-badge--loss')}>
        {row.result === 'W' ? 'GY' : 'V'}
      </span>
    ),
  },
  {
    key: 'score',
    label: 'Eredmény',
    numeric: true,
    sortAccessor: row => row.ourScore,
    render: row => `${row.ourScore}–${row.oppScore}`,
  },
  {
    key: 'margin',
    label: 'Különbség',
    numeric: true,
    sortAccessor: row => row.margin,
    render: row => <span className={row.margin > 0 ? 'dt-num--pos' : 'dt-num--neg'}>{formatSigned(row.margin)}</span>,
  },
  {
    key: 'rolling',
    label: 'Utolsó 5 GY%',
    numeric: true,
    sortAccessor: row => row.rollingWinRate ?? Number.NEGATIVE_INFINITY,
    render: row => <span className="dt-num--muted">{formatWinPct(row.rollingWinRate)}</span>,
  },
];

/** A csapat formája meccsenként; a legfrissebb meccs elöl. */
export function FormTable({ rows }: { rows: FormEntry[] }) {
  return (
    <DataTable
      columns={FORM_COLUMNS}
      rows={rows}
      getRowId={row => row.gameIndex}
      initialSort={{ key: 'date', dir: 'desc' }}
    />
  );
}
