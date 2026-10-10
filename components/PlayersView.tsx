'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { PlayersTable } from '@/components/PlayersTable';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamPlayerStats } from '@/hooks/usePlayerData';
import { orderSeasonTypes, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import { useMemo, useState } from 'react';
import { UserX } from 'lucide-react';

interface PlayersViewProps {
  selection: SeasonTeamSelection;
}

// Játékosok nézet: a kiválasztott csapat játékosainak szezon-összesítői,
// szakaszonként (alapszakasz / play-in / rájátszás) külön – az átlagok nem keverednek.
export function PlayersView({ selection }: PlayersViewProps) {
  const { season, team } = selection;
  const players = useTeamPlayerStats(season?.id ?? null, team?.id ?? null);
  const [chosenStage, setChosenStage] = useState<number | null>(null);
  const stages = useMemo(() => orderSeasonTypes((players.data ?? []).map(player => player.seasonType)), [players.data]);

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  if (players.error) return <DataLoadError message={players.error} onRetry={players.reload} />;
  if (selection.loading || players.loading) return <PlayersSkeleton />;
  if (!season || !team || !players.data) return null;

  const stage = resolveSeasonType(stages, chosenStage);
  if (stage === null) {
    return (
      <EmptyState>
        A(z) {team.name} játékosainak még nincs lejátszott mérkőzése a(z) {season.name} szezonban.
      </EmptyState>
    );
  }

  return (
    <Tabs value={String(stage)} onValueChange={value => setChosenStage(Number(value))} className="gap-6">
      {stages.length > 1 && (
        <TabsList aria-label="Szakasz">
          {stages.map(type => (
            <TabsTrigger key={type} value={String(type)}>{seasonTypeLabel(type)}</TabsTrigger>
          ))}
        </TabsList>
      )}
      {stages.map(type => {
        const stagePlayers = players.data?.filter(player => player.seasonType === type) ?? [];
        return (
          <TabsContent key={type} value={String(type)}>
            <section className="animate-fade-slide-up">
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-xl">Játékosok</h2>
                <span className="font-mono text-sm tabular-nums text-secondary">{stagePlayers.length}</span>
              </div>
              <p className="mb-3 text-sm text-secondary">
                Meccsenkénti átlagok a(z) {team.name} színeiben játszott mérkőzésekből; a százalékok az összesített
                dobásokból számolódnak. M: mérkőzés, K: kezdőként.
              </p>
              <PlayersTable players={stagePlayers} />
            </section>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-3 py-8 text-secondary">
        <UserX className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function PlayersSkeleton() {
  return <div className="skeleton-shimmer h-96" aria-busy="true" aria-label="Játékosok betöltése" />;
}
