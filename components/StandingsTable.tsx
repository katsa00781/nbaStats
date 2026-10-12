'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { Team } from '@/lib/master-data';
import type { StandingRow } from '@/lib/standings-data';
import { OpponentCell } from '@/components/GamesTables';
import { formatSigned } from '@/components/TeamStatsTable';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { CLINCHER_LABELS } from '@/lib/standings-data';
import { cn } from '@/lib/utils';

const EMPTY = '–';
// A rangsorban a kiemelés nélküli sor (nem fordul elő, de a séma megengedi) a végére kerül.
const NO_SEED = 99;

/** Győzelmi arány NBA-módra: „.646”, a 100%-nál „1.000”. */
export function formatWinPct(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toFixed(3).replace(/^0/, '');
}

/** Lemaradás a vezetőtől: a vezetőnél gondolatjel, egész értéknél tizedes nélkül. */
export function formatGamesBehind(value: number): string {
  if (value === 0) return EMPTY;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Az ESPN sorozatjelölése magyarul: `W3` → „GY3”, `L2` → „V2”. */
export function formatStreak(streak: string | null): string {
  if (!streak) return EMPTY;
  return streak.replace(/^W/, 'GY').replace(/^L/, 'V');
}

// Rendezéshez: a győzelmi sorozat pozitív, a vereségi negatív szám.
function streakValue(streak: string | null): number {
  const match = streak?.match(/^([WL])(\d+)$/);
  if (!match) return 0;
  return match[1] === 'W' ? Number(match[2]) : -Number(match[2]);
}

// Rendezéshez: a „28-13” formájú mérleg győzelmi aránya.
function recordValue(record: string | null): number {
  const match = record?.match(/^(\d+)-(\d+)$/);
  if (!match) return -1;
  const games = Number(match[1]) + Number(match[2]);
  return games === 0 ? 0 : Number(match[1]) / games;
}

const recordCell = (record: string | null) => <span className="text-secondary">{record ?? EMPTY}</span>;

function clincherTone(clincher: string): string {
  if (clincher === 'e') return 'badge-negative';
  if (clincher === 'pb') return 'badge-warning';
  return 'badge-positive';
}

interface StandingsTableProps {
  rows: StandingRow[];
  teamsById: ReadonlyMap<string, Team>;
  /** A kiemelt (kiválasztott) csapat azonosítója. */
  activeTeamId: string | null;
}

/** Egy konferencia tabellája: a sorrend alapértelmezetten a hivatalos kiemelés. */
export function StandingsTable({ rows, teamsById, activeTeamId }: StandingsTableProps) {
  const columns: ColumnDef<StandingRow>[] = [
    {
      key: 'seed',
      label: '#',
      numeric: true,
      width: 56,
      sortAccessor: row => row.conferenceSeed ?? NO_SEED,
      render: row => row.conferenceSeed ?? EMPTY,
    },
    {
      key: 'team',
      label: 'Csapat',
      sortAccessor: row => teamsById.get(row.teamId)?.name ?? '',
      render: row => (
        <span className="flex items-center gap-2">
          <OpponentCell team={teamsById.get(row.teamId)} />
          {row.clincher && (
            <Badge className={clincherTone(row.clincher)} title={CLINCHER_LABELS[row.clincher] ?? row.clincher}>
              {row.clincher}
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'wins', label: 'GY', numeric: true, sortAccessor: row => row.wins, render: row => row.wins },
    { key: 'losses', label: 'V', numeric: true, sortAccessor: row => row.losses, render: row => row.losses },
    {
      key: 'winPct',
      label: 'GY%',
      numeric: true,
      sortAccessor: row => row.winPct ?? -1,
      render: row => formatWinPct(row.winPct),
    },
    {
      key: 'gamesBehind',
      label: 'GB',
      numeric: true,
      sortAccessor: row => row.gamesBehind,
      render: row => <span className="dt-num--muted">{formatGamesBehind(row.gamesBehind)}</span>,
    },
    {
      key: 'home',
      label: 'Hazai',
      numeric: true,
      sortAccessor: row => recordValue(row.homeRecord),
      render: row => recordCell(row.homeRecord),
    },
    {
      key: 'road',
      label: 'Idegen',
      numeric: true,
      sortAccessor: row => recordValue(row.roadRecord),
      render: row => recordCell(row.roadRecord),
    },
    {
      key: 'division',
      label: 'Div.',
      numeric: true,
      sortAccessor: row => recordValue(row.divisionRecord),
      render: row => recordCell(row.divisionRecord),
    },
    {
      key: 'conference',
      label: 'Konf.',
      numeric: true,
      sortAccessor: row => recordValue(row.conferenceRecord),
      render: row => recordCell(row.conferenceRecord),
    },
    {
      key: 'lastTen',
      label: 'L10',
      numeric: true,
      sortAccessor: row => recordValue(row.lastTen),
      render: row => recordCell(row.lastTen),
    },
    {
      key: 'streak',
      label: 'Sorozat',
      numeric: true,
      sortAccessor: row => streakValue(row.streak),
      render: row => {
        const value = streakValue(row.streak);
        return (
          <span className={cn(value > 0 && 'dt-num--pos', value < 0 && 'dt-num--neg')}>{formatStreak(row.streak)}</span>
        );
      },
    },
    {
      key: 'pointsFor',
      label: 'PF',
      numeric: true,
      sortAccessor: row => row.pointsForPerGame ?? -1,
      render: row => (row.pointsForPerGame === null ? EMPTY : row.pointsForPerGame.toFixed(1)),
    },
    {
      key: 'pointsAgainst',
      label: 'PA',
      numeric: true,
      sortAccessor: row => row.pointsAgainstPerGame ?? -1,
      render: row => (row.pointsAgainstPerGame === null ? EMPTY : row.pointsAgainstPerGame.toFixed(1)),
    },
    {
      key: 'diff',
      label: 'Különbség',
      numeric: true,
      sortAccessor: row => pointDifference(row) ?? Number.NEGATIVE_INFINITY,
      render: row => {
        const diff = pointDifference(row);
        if (diff === null) return EMPTY;
        return <span className={cn(diff > 0 && 'dt-num--pos', diff < 0 && 'dt-num--neg')}>{formatSigned(diff)}</span>;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={row => row.teamId}
      activeRowId={activeTeamId ?? undefined}
      initialSort={{ key: 'seed', dir: 'asc' }}
    />
  );
}

/** Meccsenkénti pontkülönbség (szerzett − kapott); `null`, ha az ESPN nem adta a pontokat. */
export function pointDifference(row: StandingRow): number | null {
  if (row.pointsForPerGame === null || row.pointsAgainstPerGame === null) return null;
  return row.pointsForPerGame - row.pointsAgainstPerGame;
}
