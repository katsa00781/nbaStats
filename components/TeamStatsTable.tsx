'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { MetricKind, TeamMetricRow } from '@/lib/team-stats-metrics';
import { DataTable } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';

const EMPTY = '–';
// Ennyi csapatnál kisebb rangsorban nincs értelme jó / rossz színezésnek (pl. kis rájátszás-mezőny).
const MIN_RANKED_FOR_TONE = 6;
const RANK_WIDTH = 120;

// Valódi mínuszjel, hogy a mono oszlopban a +/− azonos szélességű legyen.
export function formatSigned(value: number): string {
  const rounded = Math.abs(value).toFixed(1);
  if (Number(rounded) === 0) return '0.0';
  return `${value > 0 ? '+' : '−'}${rounded}`;
}

/** Egy mutató értéke a fajtája szerint; `null` esetén gondolatjel. */
export function formatMetricValue(kind: MetricKind, value: number | null): string {
  if (value === null) return EMPTY;
  switch (kind) {
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'rate':
      return value.toFixed(3);
    case 'signed':
      return formatSigned(value);
    case 'count':
      return value.toFixed(1);
  }
}

/** Helyezés felirata: „5. / 30”. */
export const formatRank = (rank: number | null, of: number): string => (rank === null ? EMPTY : `${rank}. / ${of}`);

type RankTone = 'positive' | 'negative' | null;

/** A rangsor felső harmada zöld, alsó harmada piros; a jó irány nélküli mutatónál (tempó) nincs szín. */
export function rankTone(row: Pick<TeamMetricRow, 'rank' | 'of' | 'metric'>): RankTone {
  if (row.rank === null || row.metric.direction === 'neutral' || row.of < MIN_RANKED_FOR_TONE) return null;
  const third = Math.ceil(row.of / 3);
  if (row.rank <= third) return 'positive';
  if (row.rank > row.of - third) return 'negative';
  return null;
}

const COLUMNS: ColumnDef<TeamMetricRow>[] = [
  {
    key: 'label',
    label: 'Mutató',
    sortAccessor: row => row.metric.label,
    render: row => (
      <span className="flex flex-col">
        <span>{row.metric.label}</span>
        <span className="text-xs text-muted">{row.metric.description}</span>
      </span>
    ),
  },
  {
    key: 'value',
    label: 'Csapat',
    numeric: true,
    sortAccessor: row => row.value ?? Number.NEGATIVE_INFINITY,
    render: row => formatMetricValue(row.metric.kind, row.value),
  },
  {
    key: 'leagueAverage',
    label: 'Liga átlag',
    numeric: true,
    sortAccessor: row => row.leagueAverage ?? Number.NEGATIVE_INFINITY,
    render: row => <span className="dt-num--muted">{formatMetricValue(row.metric.kind, row.leagueAverage)}</span>,
  },
  {
    key: 'rank',
    label: 'Helyezés',
    numeric: true,
    width: RANK_WIDTH,
    // A legjobb helyezés elöl: a csökkenő rendezés az 1. helyet teszi felülre.
    sortAccessor: row => (row.rank === null ? Number.NEGATIVE_INFINITY : -row.rank),
    render: row => {
      const tone = rankTone(row);
      return (
        <span className={cn(tone === 'positive' && 'dt-num--pos', tone === 'negative' && 'dt-num--neg')}>
          {formatRank(row.rank, row.of)}
        </span>
      );
    },
  },
];

interface TeamStatsTableProps {
  rows: TeamMetricRow[];
}

/** Egy mutatócsoport a csapatra: érték, liga átlag és helyezés. A tábla sorrendje a mutatók sorrendje. */
export function TeamStatsTable({ rows }: TeamStatsTableProps) {
  return <DataTable columns={COLUMNS} rows={rows} getRowId={row => row.metric.key} />;
}
