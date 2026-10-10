'use client';

import type { Team } from '@/lib/master-data';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { PlayerGameLog, PlayerGameLogAbsence } from '@/lib/player-game-log-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { PlayerGameLogTable } from '@/components/PlayerGameLogTable';
import { playerInitials, PositionBadge } from '@/components/PlayersTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlayerGameLog } from '@/hooks/usePlayerGameLogData';
import { orderSeasonTypes, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import Image from 'next/image';
import { ArrowLeft, CalendarCheck, CalendarX, Grab, Handshake, Target } from 'lucide-react';

const HEADSHOT_SIZE = 72;
const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;
// Az ESPN indoka szabad szöveg (angolul); csak a leggyakoribbat fordítjuk.
const COACH_DECISION = "COACH'S DECISION";
const NO_REASON = 'indok nélkül';

type TeamsById = ReadonlyMap<string, Team>;

interface PlayerDetailsViewProps {
  seasonId: string;
  /** A kiválasztott csapat: a napló az ő színeiben játszott meccseket mutatja. */
  team: Team;
  /** A játékos szezon-összesítő sorai ennél a csapatnál, szakaszonként egy (nem üres). */
  playerRows: PlayerSeasonStats[];
  teamsById: TeamsById;
  /** A Játékosok listán választott szakasz; a részletnézet ugyanazt állítja. */
  chosenStage: number | null;
  onStageChange: (stage: number) => void;
  onBack: () => void;
}

// Játékos-részletek: fejléc, a szakasz átlagai és a meccsenkénti napló.
// A fejléc és az átlagok a lista már betöltött soraiból jönnek, lekérdezés nélkül.
export function PlayerDetailsView({
  seasonId,
  team,
  playerRows,
  teamsById,
  chosenStage,
  onStageChange,
  onBack,
}: PlayerDetailsViewProps) {
  const player = playerRows[0];
  const log = usePlayerGameLog(seasonId, player.playerId);
  const stages = orderSeasonTypes(playerRows.map(row => row.seasonType));
  const stage = resolveSeasonType(stages, chosenStage);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} autoFocus>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          Vissza a játékosokhoz
        </Button>
      </div>

      <PlayerHeader player={player} team={team} />

      <Tabs value={String(stage)} onValueChange={value => onStageChange(Number(value))} className="gap-6">
        {stages.length > 1 && (
          <TabsList aria-label="Szakasz">
            {stages.map(type => (
              <TabsTrigger key={type} value={String(type)}>{seasonTypeLabel(type)}</TabsTrigger>
            ))}
          </TabsList>
        )}
        {playerRows.map(row => (
          <TabsContent key={row.seasonType} value={String(row.seasonType)} className="flex flex-col gap-8">
            <StageAverages row={row} />
            {log.error ? (
              <DataLoadError message={log.error} onRetry={log.reload} />
            ) : log.loading || !log.data ? (
              <div className="skeleton-shimmer h-96" aria-busy="true" aria-label="Mérkőzések betöltése" />
            ) : (
              <StageGameLog log={log.data} seasonType={row.seasonType} team={team} teamsById={teamsById} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PlayerHeader({ player, team }: { player: PlayerSeasonStats; team: Team }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-4 sm:gap-6">
        {player.headshotUrl ? (
          <Image
            src={player.headshotUrl}
            alt=""
            width={HEADSHOT_SIZE}
            height={HEADSHOT_SIZE}
            className="h-18 w-18 shrink-0 rounded-full border border-border-active bg-surface-3 object-cover object-top"
          />
        ) : (
          <span
            className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full border border-border-active bg-surface-3 font-display text-2xl font-semibold text-secondary"
            aria-hidden="true"
          >
            {playerInitials(player.name)}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl">{player.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">
            {player.jersey && <span className="font-mono tabular-nums">#{player.jersey}</span>}
            {player.position && <PositionBadge position={player.position} />}
            <span>{team.name}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const formatAverage = (value: number): string => value.toFixed(1);

function StageAverages({ row }: { row: PlayerSeasonStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Mérkőzés" value={row.gamesPlayed} icon={<CalendarCheck {...STAT_ICON_PROPS} />} />
      <StatCard
        label="Pont / meccs"
        value={formatAverage(row.pointsPerGame)}
        accentColor="orange"
        icon={<Target {...STAT_ICON_PROPS} />}
        animationDelay={60}
      />
      <StatCard
        label="Lepattanó / meccs"
        value={formatAverage(row.reboundsPerGame)}
        icon={<Grab {...STAT_ICON_PROPS} />}
        animationDelay={120}
      />
      <StatCard
        label="Gólpassz / meccs"
        value={formatAverage(row.assistsPerGame)}
        icon={<Handshake {...STAT_ICON_PROPS} />}
        animationDelay={180}
      />
    </div>
  );
}

interface StageGameLogProps {
  log: PlayerGameLog;
  seasonType: number;
  team: Team;
  teamsById: TeamsById;
}

// A szakasz meccsei a kiválasztott csapat színeiben: a szezon közben igazolt
// játékos más csapatnál játszott meccsei nem számítanak, ahogy a listán sem.
function StageGameLog({ log, seasonType, team, teamsById }: StageGameLogProps) {
  const inStage = (entry: { teamId: string; game: { seasonType: number } }) =>
    entry.teamId === team.id && entry.game.seasonType === seasonType;
  const entries = log.played.filter(inStage);
  const absences = log.didNotPlay.filter(inStage);

  return (
    <section className="animate-fade-slide-up">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl">Mérkőzések</h2>
        <span className="font-mono text-sm tabular-nums text-secondary">{entries.length}</span>
      </div>
      <p className="mb-3 text-sm text-secondary">
        A(z) {team.name} színeiben játszott mérkőzések, a legfrissebb elöl. K: kezdőként. FG / 3P / FT:
        bedobott/kísérlet.
      </p>
      {entries.length > 0 ? (
        <PlayerGameLogTable entries={entries} teamsById={teamsById} />
      ) : (
        <EmptyState>Ebben a szakaszban nincs lejátszott mérkőzése.</EmptyState>
      )}
      {absences.length > 0 && (
        <p className="mt-3 text-sm text-secondary">
          <span className="uppercase-label mr-2">Nevezve volt, de nem lépett pályára</span>
          {summarizeAbsences(absences)}
        </p>
      )}
    </section>
  );
}

// Indokonként összevonva (pl. „edzői döntés 12×”): a cserepad végén ülő
// játékosnak több tucat ilyen meccse lehet. A lista nem a kihagyott meccsek
// teljes köre: az ESPN csak a meccs keretébe nevezett játékost sorolja fel.
function summarizeAbsences(absences: PlayerGameLogAbsence[]): string {
  const counts = new Map<string, number>();
  for (const { reason } of absences) {
    const label = !reason ? NO_REASON : reason === COACH_DECISION ? 'edzői döntés' : reason.toLowerCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .sort(([labelA, countA], [labelB, countB]) => countB - countA || labelA.localeCompare(labelB, 'hu'))
    .map(([label, count]) => `${label} ${count}×`)
    .join(', ');
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-8 text-secondary">
        <CalendarX className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}
