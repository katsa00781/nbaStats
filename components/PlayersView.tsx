'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { PlayerDetailsView } from '@/components/PlayerDetailsView';
import { PlayersTable } from '@/components/PlayersTable';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamPlayerStats } from '@/hooks/usePlayerData';
import { orderSeasonTypes, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import { useCallback, useMemo, useState } from 'react';
import { UserX } from 'lucide-react';

interface PlayersViewProps {
  selection: SeasonTeamSelection;
}

// Játékosok nézet: a kiválasztott csapat játékosainak szezon-összesítői,
// szakaszonként (alapszakasz / play-in / rájátszás) külön – az átlagok nem keverednek.
// Egy játékos részletei (meccsenkénti napló) a lista helyén nyílnak meg.
export function PlayersView({ selection }: PlayersViewProps) {
  const { season, team, teams } = selection;
  const players = useTeamPlayerStats(season?.id ?? null, team?.id ?? null);
  const [chosenStage, setChosenStage] = useState<number | null>(null);
  const [openedPlayerId, setOpenedPlayerId] = useState<string | null>(null);
  // Szezon- vagy csapatváltáskor a lista jön vissza: a megnyitott játékost a
  // választás változásakor renderelés közben ejtjük el (nem effectből).
  const scope = season && team ? `${season.id}|${team.id}` : null;
  const [openedScope, setOpenedScope] = useState(scope);
  if (openedScope !== scope) {
    setOpenedScope(scope);
    setOpenedPlayerId(null);
  }
  const teamsById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const stages = useMemo(() => orderSeasonTypes((players.data ?? []).map(player => player.seasonType)), [players.data]);
  // A részletnézet a lap tetején kezdődik, akármelyik sorból nyílt.
  const openPlayer = useCallback((playerId: string) => {
    setOpenedPlayerId(playerId);
    window.scrollTo({ top: 0 });
  }, []);

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  if (players.error) return <DataLoadError message={players.error} onRetry={players.reload} />;
  if (selection.loading || players.loading) return <PlayersSkeleton />;
  if (!season || !team || !players.data) return null;

  const openedRows = openedPlayerId ? players.data.filter(player => player.playerId === openedPlayerId) : [];
  if (openedPlayerId && openedRows.length > 0) {
    return (
      <PlayerDetailsView
        key={openedPlayerId}
        seasonId={season.id}
        team={team}
        playerRows={openedRows}
        teamsById={teamsById}
        chosenStage={chosenStage}
        onStageChange={setChosenStage}
        onBack={() => setOpenedPlayerId(null)}
      />
    );
  }

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
                dobásokból számolódnak. M: mérkőzés, K: kezdőként. A játékos nevére kattintva a mérkőzései nyílnak
                meg.
              </p>
              <PlayersTable players={stagePlayers} onOpenPlayer={openPlayer} />
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
