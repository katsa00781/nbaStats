'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { Team } from '@/lib/master-data';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { TeamStageStats } from '@/lib/team-stats-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { TeamAnalysisSummary, TeamRosterBlocks } from '@/components/TeamAnalysisBlocks';
import { Card, CardContent } from '@/components/ui/card';
import {
  analyzeStageTeam,
  MIN_RELIABLE_ROSTER_PLAYERS,
  MIN_TEAM_ANALYSIS_GAMES,
  MIN_TEAM_BENCHMARK_POOL,
} from '@/lib/adapters/team-analysis-adapter';
import { Info } from 'lucide-react';
import { useMemo } from 'react';

interface TeamAnalysisPanelProps {
  /** A szakasz csapatsorai (a ligarangsor adata); a nézet tölti be egyszer. */
  stageStats: TeamStageStats[];
  /** A szezon összes játékosának összegei (a roster és a poszt szerinti benchmark alapja). */
  league: SeasonScopedResourceState<LeaguePlayerTotals[]>;
  /** A kiválasztott csapat játékosai (a nevekhez). */
  players: SeasonScopedResourceState<PlayerSeasonStats[]>;
  teams: readonly Team[];
  teamId: string;
  seasonType: number;
}

// Csapat-elemzés egy szakaszra: a szakasz csapatai közötti percentilisekből a motor
// (lib/team-analysis.ts) stílust, erősségeket, limitációkat és roster-képet ad.
export function TeamAnalysisPanel({ stageStats, league, players, teams, teamId, seasonType }: TeamAnalysisPanelProps) {
  const outcome = useMemo(() => {
    if (!league.data) return null;
    return analyzeStageTeam(stageStats, league.data, teamId, seasonType, {
      teamNames: new Map(teams.map(team => [team.id, team.name])),
      // A nevek csak megjelenítésre kellenek; betöltésük előtt is készülhet az elemzés.
      playerNames: new Map((players.data ?? []).map(player => [player.playerId, player.name])),
    });
  }, [stageStats, league.data, players.data, teams, teamId, seasonType]);

  let content: ReactNode;
  if (league.error) {
    content = <DataLoadError message={league.error} onRetry={league.reload} />;
  } else if (league.loading || !league.data) {
    content = <div className="skeleton-shimmer h-72" aria-busy="true" aria-label="Csapat-elemzés betöltése" />;
  } else if (!outcome) {
    content = <Notice>Ebben a szakaszban nincs adat a csapat elemzéséhez.</Notice>;
  } else if (outcome.status === 'small-sample') {
    content = (
      <Notice>
        Kis minta: {outcome.games} mérkőzés. Az elemzéshez legalább {MIN_TEAM_ANALYSIS_GAMES} mérkőzés kell.
      </Notice>
    );
  } else if (outcome.status === 'no-benchmark') {
    content = (
      <Notice>
        Ebben a szakaszban csak {outcome.teams} csapat játszott legalább {MIN_TEAM_ANALYSIS_GAMES} mérkőzést
        (legalább {MIN_TEAM_BENCHMARK_POOL} kell), ezért nincs értelmezhető liga-összevetés.
      </Notice>
    );
  } else {
    content = (
      <>
        <TeamAnalysisSummary analysis={outcome.analysis} />
        <TeamRosterBlocks
          analysis={outcome.analysis}
          eligiblePlayers={outcome.eligiblePlayers}
          minReliablePlayers={MIN_RELIABLE_ROSTER_PLAYERS}
          thinRoster={outcome.eligiblePlayers < MIN_RELIABLE_ROSTER_PLAYERS}
        />
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl">Csapat-elemzés</h2>
        <p className="mt-1 text-sm text-secondary">
          A szakasz azon csapatai között, amelyek legalább {MIN_TEAM_ANALYSIS_GAMES} mérkőzést játszottak
          (100 = a legjobb tizedek értéke, 0 = a leggyengébb). A rosterhez a Játékos-elemzés posztjai és
          szerepkörei jönnek; a használat a labdabirtoklás közelítése, nem USG%.
        </p>
      </div>
      {content}
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6 text-secondary">
        <Info className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}
