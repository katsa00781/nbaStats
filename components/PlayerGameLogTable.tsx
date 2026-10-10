'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { Team } from '@/lib/master-data';
import type { PlayerGameLogEntry } from '@/lib/player-game-log-data';
import { GameResultBadges, OpponentCell } from '@/components/GamesTables';
import { DataTable } from '@/components/ui/data-table';
import { formatGameDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

const EMPTY = '–';

type TeamsById = ReadonlyMap<string, Team>;

const venueLabel = (entry: PlayerGameLogEntry): string => (entry.game.isHome ? 'Hazai' : 'Idegenben');
const formatShots = (made: number, attempted: number): string => `${made}/${attempted}`;
// Valódi mínuszjel, hogy a mono oszlopban a +/− azonos szélességű legyen.
const formatSigned = (value: number): string => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

function countColumn(
  key: string,
  label: string,
  value: (entry: PlayerGameLogEntry) => number,
): ColumnDef<PlayerGameLogEntry> {
  return { key, label, numeric: true, sortAccessor: value, render: entry => value(entry) };
}

// Bedobott/kísérlet; a rendezés a bedobott dobások száma szerint megy.
function shotColumn(
  key: string,
  label: string,
  made: (entry: PlayerGameLogEntry) => number,
  attempted: (entry: PlayerGameLogEntry) => number,
): ColumnDef<PlayerGameLogEntry> {
  return {
    key,
    label,
    numeric: true,
    sortAccessor: made,
    render: entry => formatShots(made(entry), attempted(entry)),
  };
}

function buildColumns(teamsById: TeamsById): ColumnDef<PlayerGameLogEntry>[] {
  return [
    {
      key: 'date',
      label: 'Dátum',
      sortAccessor: entry => entry.game.gameDate,
      render: entry => (
        <span className="font-mono tabular-nums text-secondary">{formatGameDate(entry.game.gameDate)}</span>
      ),
    },
    {
      key: 'venue',
      label: 'Helyszín',
      sortAccessor: venueLabel,
      render: entry => <span className="text-secondary">{venueLabel(entry)}</span>,
    },
    {
      key: 'opponent',
      label: 'Ellenfél',
      sortAccessor: entry => teamsById.get(entry.game.opponentTeamId)?.name ?? '',
      render: entry => <OpponentCell team={teamsById.get(entry.game.opponentTeamId)} />,
    },
    {
      key: 'result',
      label: 'Kimenetel',
      center: true,
      sortAccessor: entry => entry.game.result ?? '',
      render: entry => <GameResultBadges game={entry.game} />,
    },
    {
      key: 'score',
      label: 'Eredmény',
      numeric: true,
      sortAccessor: entry => (entry.game.teamScore ?? 0) - (entry.game.opponentScore ?? 0),
      render: entry => `${entry.game.teamScore ?? EMPTY}–${entry.game.opponentScore ?? EMPTY}`,
    },
    {
      key: 'starter',
      label: 'K',
      center: true,
      sortAccessor: entry => (entry.starter ? 1 : 0),
      render: entry =>
        entry.starter ? (
          <span className="dt-badge dt-badge--neutral" title="Kezdő" aria-label="Kezdő">K</span>
        ) : null,
    },
    countColumn('minutes', 'MIN', entry => entry.minutes),
    countColumn('points', 'PTS', entry => entry.points),
    shotColumn('fg', 'FG', entry => entry.fgMade, entry => entry.fgAttempted),
    shotColumn('three', '3P', entry => entry.threeMade, entry => entry.threeAttempted),
    shotColumn('ft', 'FT', entry => entry.ftMade, entry => entry.ftAttempted),
    countColumn('rebounds', 'REB', entry => entry.rebounds),
    countColumn('assists', 'AST', entry => entry.assists),
    countColumn('steals', 'STL', entry => entry.steals),
    countColumn('blocks', 'BLK', entry => entry.blocks),
    countColumn('turnovers', 'TOV', entry => entry.turnovers),
    countColumn('fouls', 'PF', entry => entry.fouls),
    {
      key: 'plusMinus',
      label: '+/-',
      numeric: true,
      sortAccessor: entry => entry.plusMinus ?? 0,
      render: entry => {
        if (entry.plusMinus === null) return EMPTY;
        return (
          <span className={cn(entry.plusMinus > 0 && 'dt-num--pos', entry.plusMinus < 0 && 'dt-num--neg')}>
            {formatSigned(entry.plusMinus)}
          </span>
        );
      },
    },
    countColumn('valuation', 'VAL', entry => entry.valuation),
  ];
}

interface PlayerGameLogTableProps {
  entries: PlayerGameLogEntry[];
  teamsById: TeamsById;
}

/** Egy játékos meccsei egy szakaszban, a csapata nézőpontjából; a legfrissebb elöl. */
export function PlayerGameLogTable({ entries, teamsById }: PlayerGameLogTableProps) {
  const columns = useMemo(() => buildColumns(teamsById), [teamsById]);
  return (
    <DataTable
      columns={columns}
      rows={entries}
      getRowId={entry => entry.game.id}
      initialSort={{ key: 'date', dir: 'desc' }}
    />
  );
}
