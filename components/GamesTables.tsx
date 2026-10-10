'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { GameResult, TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { GameStatus } from '@/lib/supabase';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { formatGameDate, formatLocalStart } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const LOGO_SIZE = 26;

const STATUS_BADGES: Record<GameStatus, { label: string; className: string }> = {
  scheduled: { label: 'Kiírva', className: 'badge-neutral' },
  in_progress: { label: 'Folyamatban', className: 'badge-cyan' },
  postponed: { label: 'Elhalasztva', className: 'badge-warning' },
  canceled: { label: 'Törölve', className: 'badge-negative' },
  final: { label: 'Lezárva', className: 'badge-neutral' },
};

// A `none` a pontszám nélkül lezárt meccs (az import ilyet nem ír, de a séma megengedi).
const RESULT_BADGES: Record<GameResult | 'none', { label: string; className: string }> = {
  win: { label: 'GY', className: 'dt-badge--win' },
  loss: { label: 'V', className: 'dt-badge--loss' },
  none: { label: '–', className: 'dt-badge--neutral' },
};

type TeamsById = ReadonlyMap<string, Team>;

interface GamesTableProps {
  games: TeamGame[];
  teamsById: TeamsById;
}

const venueLabel = (game: TeamGame): string => (game.isHome ? 'Hazai' : 'Idegenben');
const opponentName = (game: TeamGame, teamsById: TeamsById): string => teamsById.get(game.opponentTeamId)?.name ?? '';
const scoreDiff = (game: TeamGame): number => (game.teamScore ?? 0) - (game.opponentScore ?? 0);
// Valódi mínuszjel, hogy a mono oszlopban a +/− azonos szélességű legyen.
const formatDiff = (diff: number): string => (diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : '0');
const overtimeLabel = (overtimes: number): string => (overtimes > 1 ? `${overtimes}HU` : 'HU');
const overtimeTitle = (overtimes: number): string =>
  overtimes > 1 ? `${overtimes} hosszabbítás után` : 'Hosszabbítás után';

function OpponentCell({ team }: { team: Team | undefined }) {
  if (!team) return <span className="text-muted">Ismeretlen csapat</span>;
  return (
    <span className="dt-team">
      {team.logo_url ? (
        <Image
          src={team.logo_url}
          alt=""
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          className="h-6.5 w-6.5 shrink-0 object-contain"
        />
      ) : (
        <span className="dt-team-logo" aria-hidden="true">{team.abbreviation}</span>
      )}
      <span className="dt-team-name">{team.name}</span>
    </span>
  );
}

function sharedColumns(teamsById: TeamsById): Record<'date' | 'venue' | 'opponent', ColumnDef<TeamGame>> {
  return {
    date: {
      key: 'date',
      label: 'Dátum',
      sortAccessor: game => game.gameDate,
      render: game => <span className="font-mono tabular-nums text-secondary">{formatGameDate(game.gameDate)}</span>,
    },
    venue: {
      key: 'venue',
      label: 'Helyszín',
      sortAccessor: venueLabel,
      render: game => <span className="text-secondary">{venueLabel(game)}</span>,
    },
    opponent: {
      key: 'opponent',
      label: 'Ellenfél',
      sortAccessor: game => opponentName(game, teamsById),
      render: game => <OpponentCell team={teamsById.get(game.opponentTeamId)} />,
    },
  };
}

/** Lejátszott meccsek a kiválasztott csapat nézőpontjából; a legfrissebb elöl. */
export function GameResultsTable({ games, teamsById }: GamesTableProps) {
  const shared = sharedColumns(teamsById);
  const columns: ColumnDef<TeamGame>[] = [
    shared.date,
    shared.venue,
    shared.opponent,
    {
      key: 'result',
      label: 'Kimenetel',
      center: true,
      sortAccessor: game => RESULT_BADGES[game.result ?? 'none'].label,
      render: game => (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('dt-badge', RESULT_BADGES[game.result ?? 'none'].className)}>
            {RESULT_BADGES[game.result ?? 'none'].label}
          </span>
          {game.overtimes > 0 && (
            <span className="dt-badge dt-badge--neutral" title={overtimeTitle(game.overtimes)}>
              {overtimeLabel(game.overtimes)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'score',
      label: 'Eredmény',
      numeric: true,
      sortAccessor: game => game.teamScore ?? 0,
      render: game => `${game.teamScore ?? '–'}–${game.opponentScore ?? '–'}`,
    },
    {
      key: 'diff',
      label: 'Különbség',
      numeric: true,
      sortAccessor: scoreDiff,
      render: game => {
        const diff = scoreDiff(game);
        return <span className={cn(diff > 0 && 'dt-num--pos', diff < 0 && 'dt-num--neg')}>{formatDiff(diff)}</span>;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={games}
      getRowId={game => game.id}
      initialSort={{ key: 'date', dir: 'desc' }}
    />
  );
}

/** Le nem zárt meccsek (kiírt, folyamatban lévő, elhalasztott, törölt), időrendben. */
export function GameScheduleTable({ games, teamsById, footer }: GamesTableProps & { footer?: ReactNode }) {
  const shared = sharedColumns(teamsById);
  const columns: ColumnDef<TeamGame>[] = [
    shared.date,
    {
      key: 'start',
      label: 'Kezdés (helyi idő)',
      sortAccessor: game => game.startTime ?? '',
      render: game => (
        <span className="font-mono tabular-nums">{game.startTime ? formatLocalStart(game.startTime) : '–'}</span>
      ),
    },
    shared.venue,
    shared.opponent,
    {
      key: 'arena',
      label: 'Csarnok',
      sortAccessor: game => game.venue ?? '',
      render: game => <span className="text-secondary">{game.venue ?? '–'}</span>,
    },
    {
      key: 'status',
      label: 'Státusz',
      center: true,
      sortAccessor: game => STATUS_BADGES[game.status].label,
      render: game => <Badge className={STATUS_BADGES[game.status].className}>{STATUS_BADGES[game.status].label}</Badge>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={games}
      getRowId={game => game.id}
      initialSort={{ key: 'date', dir: 'asc' }}
      footer={footer}
    />
  );
}
