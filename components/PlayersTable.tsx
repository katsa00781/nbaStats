'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { PlayerSeasonStats } from '@/lib/player-data';
import { DataTable } from '@/components/ui/data-table';
import { PlayerCell, PositionBadge } from '@/components/PlayerCell';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

const EMPTY = '–';
// Kísérlet nélkül nincs százalék: csökkenő rendezésnél a 0%-os sor alá kerül.
const NO_PCT_SORT_VALUE = -1;

const formatAverage = (value: number): string => value.toFixed(1);
const formatPct = (value: number | null): string => (value === null ? EMPTY : value.toFixed(1));
const pctSortValue = (value: number | null): number => value ?? NO_PCT_SORT_VALUE;

// Egy tizedes, előjellel; valódi mínuszjel, hogy a mono oszlopban a +/− azonos szélességű legyen.
function formatSigned(value: number): string {
  if (value === 0) return '0.0';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
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

const buildColumns = (onOpenPlayer: (playerId: string) => void): ColumnDef<PlayerSeasonStats>[] => [
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
    render: player => <PlayerCell player={player} onOpen={() => onOpenPlayer(player.playerId)} />,
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

interface PlayersTableProps {
  players: PlayerSeasonStats[];
  onOpenPlayer: (playerId: string) => void;
}

/**
 * Egy csapat játékosai egy szakaszban: meccsenkénti átlagok és dobószázalékok.
 * A játékos neve a részleteit (meccsenkénti napló) nyitja meg.
 */
export function PlayersTable({ players, onOpenPlayer }: PlayersTableProps) {
  const columns = useMemo(() => buildColumns(onOpenPlayer), [onOpenPlayer]);
  return (
    <DataTable
      columns={columns}
      rows={players}
      getRowId={player => player.playerId}
      initialSort={{ key: 'points', dir: 'desc' }}
    />
  );
}
