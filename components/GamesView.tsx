'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { GameResultsTable, GameScheduleTable } from '@/components/GamesTables';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamGames } from '@/hooks/useGameData';
import { seasonTypesOf, summarizeRecord } from '@/lib/game-data';
import { REGULAR_SEASON, seasonTypeLabel } from '@/lib/season-types';
import { useMemo, useState } from 'react';
import { CalendarX, Diff, House, Plane, Trophy } from 'lucide-react';

const UPCOMING_PREVIEW = 5;
const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;

interface GamesViewProps {
  selection: SeasonTeamSelection;
}

// Mérkőzések nézet: a kiválasztott csapat meccsei a kiválasztott szezonban,
// szakaszonként (alapszakasz / play-in / rájátszás) külön – a mérleg nem keveri őket.
export function GamesView({ selection }: GamesViewProps) {
  const { season, team, teams } = selection;
  const games = useTeamGames(season?.id ?? null, team?.id ?? null);
  const [chosenStage, setChosenStage] = useState<number | null>(null);
  const teamsById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const stages = useMemo(() => seasonTypesOf(games.data ?? []), [games.data]);

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  if (games.error) return <DataLoadError message={games.error} onRetry={games.reload} />;
  if (selection.loading || games.loading) return <GamesSkeleton />;
  if (!season || !team || !games.data) return null;

  if (games.data.length === 0) {
    return (
      <EmptyState>
        A(z) {team.name} csapatnak nincs mérkőzése a(z) {season.name} szezonban.
      </EmptyState>
    );
  }

  // A választott szakasz csak akkor érvényes, ha a csapatnak van benne meccse;
  // különben az alapszakasz (annak híján az első szakasz) látszik.
  const stage =
    chosenStage !== null && stages.includes(chosenStage)
      ? chosenStage
      : stages.includes(REGULAR_SEASON)
        ? REGULAR_SEASON
        : stages[0];

  return (
    <Tabs value={String(stage)} onValueChange={value => setChosenStage(Number(value))} className="gap-6">
      {stages.length > 1 && (
        <TabsList aria-label="Szakasz">
          {stages.map(type => (
            <TabsTrigger key={type} value={String(type)}>{seasonTypeLabel(type)}</TabsTrigger>
          ))}
        </TabsList>
      )}
      {stages.map(type => (
        <TabsContent key={type} value={String(type)}>
          <GamesStage
            key={`${season.id}|${team.id}|${type}`}
            games={games.data?.filter(game => game.seasonType === type) ?? []}
            teamsById={teamsById}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface GamesStageProps {
  games: TeamGame[];
  teamsById: ReadonlyMap<string, Team>;
}

function GamesStage({ games, teamsById }: GamesStageProps) {
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const played = useMemo(() => games.filter(game => game.status === 'final'), [games]);
  const upcoming = useMemo(() => games.filter(game => game.status !== 'final'), [games]);
  const record = useMemo(() => summarizeRecord(played), [played]);
  const shownUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW);
  const decided = record.wins + record.losses;
  const avgDiff = decided > 0 ? (record.pointsFor - record.pointsAgainst) / decided : 0;

  return (
    <div className="flex flex-col gap-8">
      {decided > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Mérleg"
            value={`${record.wins}–${record.losses}`}
            accentColor="orange"
            icon={<Trophy {...STAT_ICON_PROPS} />}
          />
          <StatCard
            label="Hazai mérleg"
            value={`${record.homeWins}–${record.homeLosses}`}
            icon={<House {...STAT_ICON_PROPS} />}
            animationDelay={60}
          />
          <StatCard
            label="Idegenbeli mérleg"
            value={`${record.awayWins}–${record.awayLosses}`}
            icon={<Plane {...STAT_ICON_PROPS} />}
            animationDelay={120}
          />
          <StatCard
            label="Pontkülönbség / meccs"
            value={formatSigned(avgDiff)}
            trend={avgDiff > 0 ? 'up' : avgDiff < 0 ? 'down' : 'neutral'}
            icon={<Diff {...STAT_ICON_PROPS} />}
            animationDelay={180}
          />
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="animate-fade-slide-up">
          <SectionHeading title="Következő mérkőzések" count={upcoming.length} />
          <p className="mb-3 text-sm text-secondary">
            A dátum az amerikai keleti parti nap, a kezdés a helyi időd szerint.
          </p>
          <GameScheduleTable
            games={shownUpcoming}
            teamsById={teamsById}
            footer={
              upcoming.length > UPCOMING_PREVIEW ? (
                <>
                  <span>{shownUpcoming.length} / {upcoming.length} mérkőzés</span>
                  <button type="button" className="dt-foot-btn" onClick={() => setShowAllUpcoming(all => !all)}>
                    {showAllUpcoming ? `Csak a következő ${UPCOMING_PREVIEW}` : 'Összes megjelenítése'}
                  </button>
                </>
              ) : undefined
            }
          />
        </section>
      )}

      <section className="animate-fade-slide-up">
        <SectionHeading title="Lejátszott mérkőzések" count={played.length} />
        {played.length > 0 ? (
          <GameResultsTable games={played} teamsById={teamsById} />
        ) : (
          <EmptyState>Ebben a szakaszban még nincs lejátszott mérkőzés.</EmptyState>
        )}
      </section>
    </div>
  );
}

// Egy tizedes, előjellel; valódi mínuszjel a mono számokhoz.
function formatSigned(value: number): string {
  const rounded = Math.abs(value).toFixed(1);
  if (Number(rounded) === 0) return '0.0';
  return `${value > 0 ? '+' : '−'}${rounded}`;
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-xl">{title}</h2>
      <span className="font-mono text-sm tabular-nums text-secondary">{count}</span>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-3 py-8 text-secondary">
        <CalendarX className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function GamesSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Mérkőzések betöltése">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer h-35" />
        ))}
      </div>
      <div className="skeleton-shimmer h-96" />
    </div>
  );
}
