'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { TeamGame } from '@/lib/game-data';
import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { Team } from '@/lib/master-data';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { TeamStageStats } from '@/lib/team-stats-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { ScoutingHeadlineCards, ScoutingOverview } from '@/components/ScoutingSummaryBlocks';
import {
  ScoutingAdvancedPlayers,
  ScoutingKeyPlayers,
  ScoutingPositionTable,
  ScoutingRiskScenarios,
  ScoutingScenarioTable,
  ScoutingTeamStatsTable,
} from '@/components/ScoutingMatchupBlocks';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamGames } from '@/hooks/useGameData';
import { useLeaguePlayerTotals } from '@/hooks/useLeaguePlayerData';
import { useTeamPlayerStats } from '@/hooks/usePlayerData';
import { useLeagueTeamStats } from '@/hooks/useTeamStatsData';
import {
  MIN_ROTATION_GAMES,
  MIN_ROTATION_MINUTES_PER_GAME,
  MIN_SCOUTING_BENCHMARK_POOL,
  MIN_SCOUTING_GAMES,
  scoutStageOpponent,
} from '@/lib/adapters/pregame-adapter';
import { formatGameDate } from '@/lib/format-date';
import { orderSeasonTypes, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';

const OPPONENT_FIELD_ID = 'scouting-opponent';

interface ScoutingViewProps {
  selection: SeasonTeamSelection;
}

/** A felhasználó ellenfél-választása; a szezon- vagy csapatváltás (más `scope`) eldobja. */
interface ChosenOpponent {
  scope: string;
  teamId: string;
}

/**
 * Alapértelmezett ellenfél: a csapat következő le nem játszott meccsének ellenfele;
 * ha nincs ilyen (lezárt szezon), az utolsó lejátszott meccsé. `null`, ha a csapatnak nincs meccse.
 */
function defaultOpponent(games: readonly TeamGame[]): { teamId: string; upcoming: TeamGame | null } | null {
  const upcoming = games.find(game => game.status === 'scheduled' || game.status === 'in_progress');
  if (upcoming) return { teamId: upcoming.opponentTeamId, upcoming };
  const last = [...games].reverse().find(game => game.status === 'final');
  return last ? { teamId: last.opponentTeamId, upcoming: null } : null;
}

// Scouting nézet: a kiválasztott csapat (a követett csapat az alapértelmezés) meccs előtti
// elemzése egy ellenfél ellen. A riport a szakasz azonos meccsszám-küszöböt elérő
// csapataihoz mér, ezért szakaszonként készül; a szakaszok nem keverednek.
export function ScoutingView({ selection }: ScoutingViewProps) {
  const { season, team, teams } = selection;
  const seasonId = season?.id ?? null;
  const teamId = team?.id ?? null;
  const league = useLeagueTeamStats(seasonId);
  const leaguePlayers = useLeaguePlayerTotals(seasonId);
  const games = useTeamGames(seasonId, teamId);
  const [chosen, setChosen] = useState<ChosenOpponent | null>(null);

  const scope = `${seasonId}|${teamId}`;
  const fallback = useMemo(() => defaultOpponent(games.data ?? []), [games.data]);
  const opponentId = chosen && chosen.scope === scope ? chosen.teamId : (fallback?.teamId ?? null);
  const opponent = teams.find(candidate => candidate.id === opponentId) ?? null;
  const upcoming = fallback && fallback.teamId === opponentId ? fallback.upcoming : null;

  const ownPlayers = useTeamPlayerStats(seasonId, teamId);
  const opponentPlayers = useTeamPlayerStats(seasonId, opponentId);
  const [chosenStage, setChosenStage] = useState<number | null>(null);

  // Azok a szakaszok, ahol mindkét csapatnak van lejátszott meccse.
  const stages = useMemo(() => {
    const stats = league.data?.stats ?? [];
    const own = new Set(stats.filter(s => s.teamId === teamId).map(s => s.seasonType));
    return orderSeasonTypes(stats.filter(s => s.teamId === opponentId && own.has(s.seasonType)).map(s => s.seasonType));
  }, [league.data, teamId, opponentId]);

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  if (league.error) return <DataLoadError message={league.error} onRetry={league.reload} />;
  if (games.error) return <DataLoadError message={games.error} onRetry={games.reload} />;
  if (selection.loading || league.loading || games.loading) return <ScoutingSkeleton />;
  if (!season || !team || !league.data) return null;

  const stage = resolveSeasonType(stages, chosenStage);
  const opponents = teams.filter(candidate => candidate.id !== team.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-64">
          <label htmlFor={OPPONENT_FIELD_ID} className="uppercase-label mb-2 block">Ellenfél</label>
          <Select value={opponent?.id} onValueChange={value => setChosen({ scope, teamId: value })}>
            <SelectTrigger id={OPPONENT_FIELD_ID} className="w-full">
              <SelectValue placeholder="Válassz ellenfelet" />
            </SelectTrigger>
            <SelectContent>
              {opponents.map(candidate => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {upcoming && (
          <p className="pb-2 text-sm text-secondary">
            Következő mérkőzés: {formatGameDate(upcoming.gameDate)}, {upcoming.isHome ? 'hazai' : 'idegenben'}.
          </p>
        )}
      </div>

      {!opponent ? (
        <Notice>Válassz ellenfelet a(z) {team.name} meccs előtti elemzéséhez.</Notice>
      ) : stage === null ? (
        <Notice>
          A(z) {team.name} és a(z) {opponent.name} még nem játszott mérkőzést ugyanabban a szakaszban a(z){' '}
          {season.name} szezonban, ezért nincs mihez mérni az elemzést.
        </Notice>
      ) : (
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
              <ScoutingStage
                key={`${season.id}|${team.id}|${opponent.id}|${type}`}
                stageStats={league.data?.stats.filter(s => s.seasonType === type) ?? []}
                ownTeamId={team.id}
                opponentTeamId={opponent.id}
                seasonType={type}
                teams={teams}
                leaguePlayers={leaguePlayers}
                ownPlayers={ownPlayers}
                opponentPlayers={opponentPlayers}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

interface ScoutingStageProps {
  stageStats: TeamStageStats[];
  ownTeamId: string;
  opponentTeamId: string;
  seasonType: number;
  teams: readonly Team[];
  leaguePlayers: SeasonScopedResourceState<LeaguePlayerTotals[]>;
  ownPlayers: SeasonScopedResourceState<PlayerSeasonStats[]>;
  opponentPlayers: SeasonScopedResourceState<PlayerSeasonStats[]>;
}

function ScoutingStage({
  stageStats,
  ownTeamId,
  opponentTeamId,
  seasonType,
  teams,
  leaguePlayers,
  ownPlayers,
  opponentPlayers,
}: ScoutingStageProps) {
  const outcome = useMemo(() => {
    if (!leaguePlayers.data) return null;
    return scoutStageOpponent(stageStats, leaguePlayers.data, ownTeamId, opponentTeamId, seasonType, {
      teamNames: new Map(teams.map(team => [team.id, team.name])),
      // A nevek csak megjelenítésre kellenek; betöltésük előtt is készülhet az elemzés.
      playerNames: new Map(
        [...(ownPlayers.data ?? []), ...(opponentPlayers.data ?? [])].map(player => [player.playerId, player.name]),
      ),
    });
  }, [stageStats, leaguePlayers.data, ownPlayers.data, opponentPlayers.data, teams, ownTeamId, opponentTeamId, seasonType]);

  if (leaguePlayers.error) return <DataLoadError message={leaguePlayers.error} onRetry={leaguePlayers.reload} />;
  if (leaguePlayers.loading || !outcome) {
    return <div className="skeleton-shimmer h-96" aria-busy="true" aria-label="Scouting riport betöltése" />;
  }

  const teamName = (id: string) => teams.find(team => team.id === id)?.name ?? '';
  if (outcome.status === 'no-data') {
    return <Notice>Ebben a szakaszban nincs lejátszott mérkőzés: {outcome.teamIds.map(teamName).join(', ')}.</Notice>;
  }
  if (outcome.status === 'small-sample') {
    return (
      <Notice>
        Kis minta: {outcome.teams.map(entry => `${teamName(entry.teamId)} (${entry.games} mérkőzés)`).join(', ')}. Az
        elemzéshez mindkét csapatnak legalább {MIN_SCOUTING_GAMES} mérkőzés kell a szakaszban.
      </Notice>
    );
  }
  if (outcome.status === 'no-benchmark') {
    return (
      <Notice>
        Ebben a szakaszban csak {outcome.teams} csapat játszott legalább {MIN_SCOUTING_GAMES} mérkőzést (legalább{' '}
        {MIN_SCOUTING_BENCHMARK_POOL} kell), ezért nincs értelmezhető liga-összevetés.
      </Notice>
    );
  }

  const { report } = outcome;
  return (
    <div className="flex flex-col gap-8">
      <ScoutingHeadlineCards report={report} />
      <p className="text-sm text-secondary">
        A nyerési esély a két csapat szakaszbeli mutatóinak és a poszt-párharcoknak a modell-becslése, nem
        kalibrált előrejelzés. Az összevetés a szakasz legalább {MIN_SCOUTING_GAMES} mérkőzést játszott csapataihoz
        mér (100 = a legjobb tizedek értéke); a rotációt a legalább {MIN_ROTATION_GAMES} meccset és meccsenként {MIN_ROTATION_MINUTES_PER_GAME} percet játszó játékosok adják.
      </p>
      <ScoutingOverview report={report} />

      <section className="animate-fade-slide-up">
        <h2 className="mb-3 text-xl">Csapatmutatók</h2>
        <ScoutingTeamStatsTable report={report} />
      </section>

      <section className="animate-fade-slide-up">
        <h2 className="mb-3 text-xl">Poszt-párharcok</h2>
        <p className="mb-3 text-sm text-secondary">
          A rotációs játékosok 36 percre vetített valuation-je poszt szerint; a poszt a statisztikai illesztésből
          jön (az ESPN csak G / F / C jelölést ad).
        </p>
        <ScoutingPositionTable rows={report.positionComparison} />
        {report.positionComparisonNote && <p className="mt-3 text-sm text-secondary">{report.positionComparisonNote}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Kulcsjátékosok</h2>
        <ScoutingKeyPlayers report={report} />
      </section>

      {report.advancedPlayers && (
        <section className="animate-fade-slide-up flex flex-col gap-6">
          <h2 className="text-xl">Rotáció legjobbjai</h2>
          <ScoutingAdvancedPlayers title={report.opponentTeamName} players={report.advancedPlayers.opponent} />
          <ScoutingAdvancedPlayers title={report.ownTeamName} players={report.advancedPlayers.own} />
        </section>
      )}

      {report.scenarioOutcomes && (
        <section className="animate-fade-slide-up">
          <h2 className="mb-3 text-xl">Forgatókönyvek</h2>
          <ScoutingScenarioTable rows={report.scenarioOutcomes} />
        </section>
      )}

      {report.riskScenarios && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">Ha bekövetkezik</h2>
          <ScoutingRiskScenarios scenarios={report.riskScenarios} />
        </section>
      )}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-3 py-6 text-secondary">
        <Info className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function ScoutingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Scouting betöltése">
      <div className="skeleton-shimmer h-14 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer h-35" />
        ))}
      </div>
      <div className="skeleton-shimmer h-96" />
    </div>
  );
}
