'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { PlayerAdvancedBlocks, PlayerAnalysisSummary } from '@/components/PlayerAnalysisBlocks';
import { Card, CardContent } from '@/components/ui/card';
import { analyzeStagePlayer, ANALYSIS_REQUIREMENTS, buildStageBenchmarks } from '@/lib/adapters/player-analysis-adapter';
import { Info } from 'lucide-react';
import { useMemo } from 'react';

interface PlayerAnalysisPanelProps {
  /** A szezon összes játékosának összegei (a benchmarkhoz); a részletnézet tölti be egyszer. */
  league: SeasonScopedResourceState<LeaguePlayerTotals[]>;
  playerId: string;
  teamId: string;
  seasonType: number;
}

// Játékos-elemzés egy szakaszra: a poszt szerinti liga-percentilisekből a motor
// (lib/player-analysis.ts) szerepköröket, skill-pontokat és haladó blokkokat ad.
export function PlayerAnalysisPanel({ league, playerId, teamId, seasonType }: PlayerAnalysisPanelProps) {
  const outcome = useMemo(() => {
    if (!league.data) return null;
    const benchmarks = buildStageBenchmarks(league.data, seasonType);
    return analyzeStagePlayer(league.data, benchmarks, playerId, teamId, seasonType);
  }, [league.data, playerId, teamId, seasonType]);

  let content: ReactNode;
  if (league.error) {
    content = <DataLoadError message={league.error} onRetry={league.reload} />;
  } else if (league.loading || !league.data) {
    content = <div className="skeleton-shimmer h-72" aria-busy="true" aria-label="Játékos-elemzés betöltése" />;
  } else if (!outcome) {
    content = <Notice>Ebben a szakaszban nincs adat a játékos elemzéséhez.</Notice>;
  } else if (outcome.status === 'small-sample') {
    content = (
      <Notice>
        Kis minta: {outcome.games} meccs, {outcome.minutesPerGame.toFixed(1)} perc / meccs. Az elemzéshez legalább{' '}
        {ANALYSIS_REQUIREMENTS.minGames} meccs és {ANALYSIS_REQUIREMENTS.minMinutesPerGame} perc / meccs kell.
      </Notice>
    );
  } else if (outcome.status === 'no-benchmark') {
    content = (
      <Notice>
        Ebben a szakaszban a(z) {outcome.position} poszton kevesebb mint {ANALYSIS_REQUIREMENTS.minBenchmarkPool}{' '}
        alkalmas játékos van, ezért nincs értelmezhető liga-összevetés.
      </Notice>
    );
  } else if (outcome.status === 'no-shot-data') {
    content = <Notice>A játékoshoz nincs dobásadat, ezért az elemzés nem készíthető el.</Notice>;
  } else {
    content = (
      <>
        <PlayerAnalysisSummary analysis={outcome.analysis} />
        <PlayerAdvancedBlocks blocks={outcome.blocks} />
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl">Játékos-elemzés</h2>
        <p className="mt-1 text-sm text-secondary">
          A liga azonos posztú játékosaihoz képest (legalább {ANALYSIS_REQUIREMENTS.minGames} meccs és{' '}
          {ANALYSIS_REQUIREMENTS.minMinutesPerGame} perc / meccs), 36 percre vetítve. A poszt az ESPN jelöléséből
          és a statisztikai profilból jön; a használat a labdabirtoklás közelítése, nem USG%.
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
