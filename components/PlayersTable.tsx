'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { Position } from '@/lib/positions';
import { DataTable } from '@/components/ui/data-table';
import { parsePositionBuckets } from '@/lib/positions';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const AVATAR_SIZE = 30;
const EMPTY = '–';
// Kísérlet nélkül nincs százalék: csökkenő rendezésnél a 0%-os sor alá kerül.
const NO_PCT_SORT_VALUE = -1;

const POSITION_BADGES: Record<Position, string> = {
  PG: 'dt-badge--pg',
  SG: 'dt-badge--sg',
  SF: 'dt-badge--sf',
  PF: 'dt-badge--pf',
  C: 'dt-badge--c',
};

const formatAverage = (value: number): string => value.toFixed(1);
const formatPct = (value: number | null): string => (value === null ? EMPTY : value.toFixed(1));
const pctSortValue = (value: number | null): number => value ?? NO_PCT_SORT_VALUE;

// Egy tizedes, előjellel; valódi mínuszjel, hogy a mono oszlopban a +/− azonos szélességű legyen.
function formatSigned(value: number): string {
  if (value === 0) return '0.0';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Headshot (kép híján monogram) + név; a box score táblája is ezt használja. */
export function PlayerCell({ player }: { player: Pick<PlayerSeasonStats, 'name' | 'headshotUrl'> }) {
  return (
    <span className="dt-player">
      {player.headshotUrl ? (
        <Image
          src={player.headshotUrl}
          alt=""
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          className="h-7.5 w-7.5 shrink-0 rounded-full border border-border-active bg-surface-3 object-cover object-top"
        />
      ) : (
        <span className="dt-player-avatar" aria-hidden="true">{initials(player.name)}</span>
      )}
      <span className="font-semibold">{player.name}</span>
    </span>
  );
}

export function PositionBadge({ position }: { position: string | null }) {
  if (!position) return <span className="text-muted">{EMPTY}</span>;
  // Az ESPN többnyire csak G / F / C rövidítést ad: a szín az első illeszkedő poszté.
  const primary = parsePositionBuckets(position)[0];
  return <span className={cn('dt-badge', primary ? POSITION_BADGES[primary] : 'dt-badge--neutral')}>{position}</span>;
}

function averageColumn(
  key: string,
  label: string,
  value: (player: PlayerSeasonStats) => number,
): ColumnDef<PlayerSeasonStats> {
  return { key, label, numeric: true, sortAccessor: value, render: player => formatAverage(value(player)) };
}

function pctColumn(
  key: string,
  label: string,
  value: (player: PlayerSeasonStats) => number | null,
): ColumnDef<PlayerSeasonStats> {
  return {
    key,
    label,
    numeric: true,
    sortAccessor: player => pctSortValue(value(player)),
    render: player => formatPct(value(player)),
  };
}

const COLUMNS: ColumnDef<PlayerSeasonStats>[] = [
  {
    key: 'jersey',
    label: '#',
    width: 48,
    sortable: false,
    render: player => <span className="dt-num dt-num--muted">{player.jersey ? `#${player.jersey}` : EMPTY}</span>,
  },
  {
    key: 'name',
    label: 'Játékos',
    sortAccessor: player => player.name,
    render: player => <PlayerCell player={player} />,
  },
  {
    key: 'position',
    label: 'Poz.',
    center: true,
    sortAccessor: player => player.position ?? '',
    render: player => <PositionBadge position={player.position} />,
  },
  { key: 'gamesPlayed', label: 'M', numeric: true, sortAccessor: player => player.gamesPlayed },
  { key: 'gamesStarted', label: 'K', numeric: true, sortAccessor: player => player.gamesStarted },
  averageColumn('minutes', 'MIN', player => player.minutesPerGame),
  averageColumn('points', 'PTS', player => player.pointsPerGame),
  averageColumn('rebounds', 'REB', player => player.reboundsPerGame),
  averageColumn('assists', 'AST', player => player.assistsPerGame),
  averageColumn('steals', 'STL', player => player.stealsPerGame),
  averageColumn('blocks', 'BLK', player => player.blocksPerGame),
  averageColumn('turnovers', 'TOV', player => player.turnoversPerGame),
  pctColumn('fgPct', 'FG%', player => player.fgPct),
  pctColumn('threePct', '3P%', player => player.threePct),
  pctColumn('ftPct', 'FT%', player => player.ftPct),
  pctColumn('trueShootingPct', 'TS%', player => player.trueShootingPct),
  pctColumn('effectiveFgPct', 'eFG%', player => player.effectiveFgPct),
  averageColumn('valuation', 'VAL', player => player.valuationPerGame),
  {
    key: 'plusMinus',
    label: '+/-',
    numeric: true,
    sortAccessor: player => player.plusMinusPerGame ?? 0,
    render: player => {
      if (player.plusMinusPerGame === null) return EMPTY;
      // A szín a megjelenített (kerekített) értéket követi.
      const value = Number(player.plusMinusPerGame.toFixed(1));
      return <span className={cn(value > 0 && 'dt-num--pos', value < 0 && 'dt-num--neg')}>{formatSigned(value)}</span>;
    },
  },
];

/** Egy csapat játékosai egy szakaszban: meccsenkénti átlagok és dobószázalékok. */
export function PlayersTable({ players }: { players: PlayerSeasonStats[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={players}
      getRowId={player => player.playerId}
      initialSort={{ key: 'points', dir: 'desc' }}
    />
  );
}
