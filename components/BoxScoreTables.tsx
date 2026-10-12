'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { BoxScorePlayer, BoxScoreTeamTotals } from '@/lib/box-score-data';
import { PlayerCell, PositionBadge } from '@/components/PlayerCell';
import { DataTable } from '@/components/ui/data-table';
import { formatPercent, shootingPct } from '@/lib/stat-formulas';
import { cn } from '@/lib/utils';

const EMPTY = '–';
const TEAM_VALUE_WIDTH = 190;

const formatShots = (made: number, attempted: number): string => `${made}/${attempted}`;
// Valódi mínuszjel, hogy a mono oszlopban a +/− azonos szélességű legyen.
const formatSigned = (value: number): string => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');
const formatCount = (value: number | null): string => (value === null ? EMPTY : String(value));

// Kísérlet nélkül nincs százalék (T12: a százalék az összesített dobásokból jön).
function formatShotLine(made: number, attempted: number): string {
  if (attempted === 0) return formatShots(made, attempted);
  return `${formatShots(made, attempted)} (${formatPercent(shootingPct(made, attempted))})`;
}

function countColumn(key: string, label: string, value: (player: BoxScorePlayer) => number): ColumnDef<BoxScorePlayer> {
  return { key, label, numeric: true, sortAccessor: value, render: player => value(player) };
}

// Bedobott/kísérlet; a rendezés a bedobott dobások száma szerint megy.
function shotColumn(
  key: string,
  label: string,
  made: (player: BoxScorePlayer) => number,
  attempted: (player: BoxScorePlayer) => number,
): ColumnDef<BoxScorePlayer> {
  return {
    key,
    label,
    numeric: true,
    sortAccessor: made,
    render: player => formatShots(made(player), attempted(player)),
  };
}

const PLAYER_COLUMNS: ColumnDef<BoxScorePlayer>[] = [
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
    render: player => (
      <span className="inline-flex items-center gap-2">
        <PlayerCell player={player} />
        {player.starter && (
          <span className="dt-badge dt-badge--neutral" title="Kezdő" aria-label="Kezdő">K</span>
        )}
      </span>
    ),
  },
  {
    key: 'position',
    label: 'Poz.',
    center: true,
    sortAccessor: player => player.position ?? '',
    render: player => <PositionBadge position={player.position} />,
  },
  countColumn('minutes', 'MIN', player => player.minutes),
  countColumn('points', 'PTS', player => player.points),
  shotColumn('fg', 'FG', player => player.fgMade, player => player.fgAttempted),
  shotColumn('three', '3P', player => player.threeMade, player => player.threeAttempted),
  shotColumn('ft', 'FT', player => player.ftMade, player => player.ftAttempted),
  countColumn('offensiveRebounds', 'OREB', player => player.offensiveRebounds),
  countColumn('rebounds', 'REB', player => player.rebounds),
  countColumn('assists', 'AST', player => player.assists),
  countColumn('steals', 'STL', player => player.steals),
  countColumn('blocks', 'BLK', player => player.blocks),
  countColumn('turnovers', 'TOV', player => player.turnovers),
  countColumn('fouls', 'PF', player => player.fouls),
  {
    key: 'plusMinus',
    label: '+/-',
    numeric: true,
    sortAccessor: player => player.plusMinus ?? 0,
    render: player => {
      if (player.plusMinus === null) return EMPTY;
      return (
        <span className={cn(player.plusMinus > 0 && 'dt-num--pos', player.plusMinus < 0 && 'dt-num--neg')}>
          {formatSigned(player.plusMinus)}
        </span>
      );
    },
  },
  countColumn('valuation', 'VAL', player => player.valuation),
];

/** Egy csapat pályára lépett játékosai egy meccsen; alapból a kezdők elöl, perc szerint. */
export function BoxScoreTable({ players }: { players: BoxScorePlayer[] }) {
  return <DataTable columns={PLAYER_COLUMNS} rows={players} getRowId={player => player.playerId} />;
}

const TEAM_STAT_ROWS: { key: string; label: string; value: (totals: BoxScoreTeamTotals) => string }[] = [
  { key: 'points', label: 'Pont', value: totals => String(totals.points) },
  { key: 'fg', label: 'Mezőnydobás', value: totals => formatShotLine(totals.fgMade, totals.fgAttempted) },
  { key: 'three', label: 'Hárompontos', value: totals => formatShotLine(totals.threeMade, totals.threeAttempted) },
  { key: 'ft', label: 'Büntető', value: totals => formatShotLine(totals.ftMade, totals.ftAttempted) },
  { key: 'rebounds', label: 'Lepattanó', value: totals => String(totals.rebounds) },
  { key: 'offensiveRebounds', label: 'Támadólepattanó', value: totals => String(totals.offensiveRebounds) },
  { key: 'assists', label: 'Gólpassz', value: totals => String(totals.assists) },
  { key: 'steals', label: 'Labdaszerzés', value: totals => String(totals.steals) },
  { key: 'blocks', label: 'Blokk', value: totals => String(totals.blocks) },
  { key: 'turnovers', label: 'Eladott labda', value: totals => String(totals.turnovers) },
  { key: 'fouls', label: 'Személyi hiba', value: totals => String(totals.fouls) },
  { key: 'pointsInPaint', label: 'Pont a festékből', value: totals => formatCount(totals.pointsInPaint) },
  { key: 'fastBreakPoints', label: 'Pont gyorsindításból', value: totals => formatCount(totals.fastBreakPoints) },
  {
    key: 'pointsOffTurnovers',
    label: 'Pont eladott labdák után',
    value: totals => formatCount(totals.pointsOffTurnovers),
  },
  { key: 'largestLead', label: 'Legnagyobb előny', value: totals => formatCount(totals.largestLead) },
];

interface TeamComparisonRow {
  key: string;
  label: string;
  team: string;
  opponent: string;
}

interface TeamComparisonTableProps {
  teamLabel: string;
  opponentLabel: string;
  team: BoxScoreTeamTotals | null;
  opponent: BoxScoreTeamTotals | null;
}

/** A két csapat összesítője a csapatsorokból (`team_game_stats`), mutatónként egy sorban. */
export function TeamComparisonTable({ teamLabel, opponentLabel, team, opponent }: TeamComparisonTableProps) {
  const rows: TeamComparisonRow[] = TEAM_STAT_ROWS.map(stat => ({
    key: stat.key,
    label: stat.label,
    team: team ? stat.value(team) : EMPTY,
    opponent: opponent ? stat.value(opponent) : EMPTY,
  }));
  const columns: ColumnDef<TeamComparisonRow>[] = [
    { key: 'label', label: 'Mutató', sortable: false, render: row => <span className="text-secondary">{row.label}</span> },
    { key: 'team', label: teamLabel, numeric: true, sortable: false, width: TEAM_VALUE_WIDTH },
    { key: 'opponent', label: opponentLabel, numeric: true, sortable: false, width: TEAM_VALUE_WIDTH },
  ];

  return <DataTable columns={columns} rows={rows} getRowId={row => row.key} className="max-w-3xl" />;
}
