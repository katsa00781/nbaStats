'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { StandingRow } from '@/lib/standings-data';
import type { ReactNode } from 'react';
import { GameResultBadges, OpponentCell } from '@/components/GamesTables';
import { PlayerCell } from '@/components/PlayerCell';
import { formatGamesBehind, formatWinPct } from '@/components/StandingsTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatGameDate, formatLocalStart } from '@/lib/format-date';
import { CalendarClock, ChevronRight } from 'lucide-react';

const EMPTY = '–';

type TeamsById = ReadonlyMap<string, Team>;

interface SectionProps {
  title: string;
  note?: string;
  children: ReactNode;
}

export function OverviewSection({ title, note, children }: SectionProps) {
  return (
    <section className="animate-fade-slide-up">
      <h2 className="mb-3 text-xl">{title}</h2>
      {note && <p className="mb-3 text-sm text-secondary">{note}</p>}
      {children}
    </section>
  );
}

interface NextGameCardProps {
  game: TeamGame | null;
  teamsById: TeamsById;
  onOpenScouting: () => void;
}

/** A csapat következő le nem játszott meccse, gyors belépővel a Scoutingba. */
export function NextGameCard({ game, teamsById, onOpenScouting }: NextGameCardProps) {
  if (!game) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-secondary">
          <CalendarClock className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
          <span>Nincs kiírt következő mérkőzés ebben a szezonban.</span>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-xs uppercase tracking-[0.12em] text-secondary">
            {game.isHome ? 'Hazai' : 'Idegenben'} · {formatGameDate(game.gameDate)}
            {game.startTime ? ` · ${formatLocalStart(game.startTime)}` : ''}
          </span>
          <OpponentCell team={teamsById.get(game.opponentTeamId)} />
          {game.venue && <span className="text-sm text-muted">{game.venue}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenScouting}>
          Scouting
          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
        </Button>
      </CardContent>
    </Card>
  );
}

/** Az utolsó néhány lejátszott meccs: ellenfél, kimenetel, eredmény. */
export function RecentGamesTable({ games, teamsById }: { games: TeamGame[]; teamsById: TeamsById }) {
  const columns: ColumnDef<TeamGame>[] = [
    {
      key: 'date',
      label: 'Dátum',
      sortable: false,
      render: game => <span className="font-mono tabular-nums text-secondary">{formatGameDate(game.gameDate)}</span>,
    },
    {
      key: 'venue',
      label: 'Helyszín',
      sortable: false,
      render: game => <span className="text-secondary">{game.isHome ? 'Hazai' : 'Idegenben'}</span>,
    },
    {
      key: 'opponent',
      label: 'Ellenfél',
      sortable: false,
      render: game => <OpponentCell team={teamsById.get(game.opponentTeamId)} />,
    },
    {
      key: 'result',
      label: 'Kimenetel',
      center: true,
      sortable: false,
      render: game => <GameResultBadges game={game} />,
    },
    {
      key: 'score',
      label: 'Eredmény',
      numeric: true,
      sortable: false,
      render: game => `${game.teamScore ?? EMPTY}–${game.opponentScore ?? EMPTY}`,
    },
  ];
  return <DataTable columns={columns} rows={games} getRowId={game => game.id} />;
}

const average = (value: number): string => value.toFixed(1);
const percent = (value: number | null): string => (value === null ? EMPTY : value.toFixed(1));

/** A csapat legjobb játékosai pontátlag szerint. */
export function TopPlayersTable({ players }: { players: PlayerSeasonStats[] }) {
  const columns: ColumnDef<PlayerSeasonStats>[] = [
    {
      key: 'name',
      label: 'Játékos',
      sortAccessor: player => player.name,
      render: player => <PlayerCell player={player} />,
    },
    { key: 'games', label: 'M', numeric: true, sortAccessor: p => p.gamesPlayed, render: p => p.gamesPlayed },
    { key: 'pts', label: 'PTS', numeric: true, sortAccessor: p => p.pointsPerGame, render: p => average(p.pointsPerGame) },
    { key: 'reb', label: 'REB', numeric: true, sortAccessor: p => p.reboundsPerGame, render: p => average(p.reboundsPerGame) },
    { key: 'ast', label: 'AST', numeric: true, sortAccessor: p => p.assistsPerGame, render: p => average(p.assistsPerGame) },
    {
      key: 'ts',
      label: 'TS%',
      numeric: true,
      sortAccessor: p => p.trueShootingPct ?? -1,
      render: p => percent(p.trueShootingPct),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={players}
      getRowId={player => player.playerId}
      initialSort={{ key: 'pts', dir: 'desc' }}
    />
  );
}

interface ConferenceSnapshotProps {
  title: string;
  rows: StandingRow[];
  teamsById: TeamsById;
  activeTeamId: string;
}

/** Egy konferencia élmezőnye: a kiemelés szerinti első néhány csapat. */
export function ConferenceSnapshot({ title, rows, teamsById, activeTeamId }: ConferenceSnapshotProps) {
  const columns: ColumnDef<StandingRow>[] = [
    { key: 'seed', label: '#', numeric: true, width: 48, sortable: false, render: row => row.conferenceSeed ?? EMPTY },
    {
      key: 'team',
      label: title,
      sortable: false,
      render: row => <OpponentCell team={teamsById.get(row.teamId)} />,
    },
    { key: 'record', label: 'GY–V', numeric: true, sortable: false, render: row => `${row.wins}–${row.losses}` },
    { key: 'winPct', label: 'GY%', numeric: true, sortable: false, render: row => formatWinPct(row.winPct) },
    {
      key: 'gamesBehind',
      label: 'GB',
      numeric: true,
      sortable: false,
      render: row => <span className="dt-num--muted">{formatGamesBehind(row.gamesBehind)}</span>,
    },
    {
      key: 'lastTen',
      label: 'L10',
      numeric: true,
      sortable: false,
      render: row => <span className="text-secondary">{row.lastTen ?? EMPTY}</span>,
    },
  ];
  return <DataTable columns={columns} rows={rows} getRowId={row => row.teamId} activeRowId={activeTeamId} />;
}
