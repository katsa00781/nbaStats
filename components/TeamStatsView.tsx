'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import type { Team } from '@/lib/master-data';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { TeamStageStats } from '@/lib/team-stats-data';
import type { ReactNode } from 'react';
import { CopyMarkdownButton } from '@/components/CopyMarkdownButton';
import { DataLoadError } from '@/components/DataLoadError';
import { TeamAnalysisPanel } from '@/components/TeamAnalysisPanel';
import { formatMetricValue, formatRank, TeamStatsTable } from '@/components/TeamStatsTable';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLeaguePlayerTotals } from '@/hooks/useLeaguePlayerData';
import { useTeamPlayerStats } from '@/hooks/usePlayerData';
import { useLeagueTeamStats } from '@/hooks/useTeamStatsData';
import { analyzeStageTeam } from '@/lib/adapters/team-analysis-adapter';
import { teamStatsToMd } from '@/lib/export-to-md';
import { orderSeasonTypes, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import { buildTeamMetricRows } from '@/lib/team-stats-metrics';
import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Gauge, Scale, Shield, Swords } from 'lucide-react';

const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;
// Ez alatt a meccsszám alatt a szezonátlag és a helyezés még nem mérvadó (kis minta, T15).
const SMALL_SAMPLE_GAMES = 10;

interface TeamStatsViewProps {
  selection: SeasonTeamSelection;
}

// Csapatstatisztika nézet: a kiválasztott csapat meccsenkénti átlagai és fejlett
// mutatói a szezon egy szakaszában, a liga 30 csapatához (átlag, helyezés) mérve.
// A szakaszok nem keverednek: a rangsor is azonos szakaszon belül készül.
export function TeamStatsView({ selection }: TeamStatsViewProps) {
  const { season, team } = selection;
  const league = useLeagueTeamStats(season?.id ?? null);
  // A csapat-elemzés rosterének adata: a liga játékosai (benchmark) és a csapat játékosai (nevek).
  const leaguePlayers = useLeaguePlayerTotals(season?.id ?? null);
  const teamPlayers = useTeamPlayerStats(season?.id ?? null, team?.id ?? null);
  const [chosenStage, setChosenStage] = useState<number | null>(null);
  const teamId = team?.id ?? null;
  // A csapatnak lejátszott szakaszai: ahol nincs sora, ott nincs mit mutatni.
  const stages = useMemo(
    () => orderSeasonTypes((league.data?.stats ?? []).filter(s => s.teamId === teamId).map(s => s.seasonType)),
    [league.data, teamId],
  );

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  if (league.error) return <DataLoadError message={league.error} onRetry={league.reload} />;
  if (selection.loading || league.loading) return <TeamStatsSkeleton />;
  if (!season || !team || !league.data) return null;

  const stage = resolveSeasonType(stages, chosenStage);
  if (stage === null) {
    return (
      <EmptyState>
        A(z) {team.name} csapatnak még nincs lejátszott mérkőzése a(z) {season.name} szezonban.
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
      {league.data.incompleteGames > 0 && (
        <p role="note" className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {league.data.incompleteGames} mérkőzés kimaradt a számításból, mert az egyik csapat statisztikai sora hiányzik.
        </p>
      )}
      {stages.map(type => (
        <TabsContent key={type} value={String(type)}>
          <TeamStatsStage
            key={`${season.id}|${team.id}|${type}`}
            stageStats={league.data?.stats.filter(s => s.seasonType === type) ?? []}
            teamId={team.id}
            teamName={team.name}
            seasonName={season.name}
            seasonType={type}
            teams={selection.teams}
            leaguePlayers={leaguePlayers}
            teamPlayers={teamPlayers}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface TeamStatsStageProps {
  stageStats: TeamStageStats[];
  teamId: string;
  teamName: string;
  seasonName: string;
  seasonType: number;
  teams: readonly Team[];
  leaguePlayers: SeasonScopedResourceState<LeaguePlayerTotals[]>;
  teamPlayers: SeasonScopedResourceState<PlayerSeasonStats[]>;
}

function TeamStatsStage({ stageStats, teamId, teamName, seasonName, seasonType, teams, leaguePlayers, teamPlayers }: TeamStatsStageProps) {
  const rows = useMemo(() => buildTeamMetricRows(stageStats, teamId), [stageStats, teamId]);
  const games = stageStats.find(s => s.teamId === teamId)?.games ?? 0;
  const basic = rows.filter(row => row.metric.group === 'basic');
  const advanced = rows.filter(row => row.metric.group === 'advanced');
  const byKey = (key: string) => rows.find(row => row.metric.key === key);
  const headline = [
    { key: 'points', label: 'Pont / meccs', icon: <BarChart3 {...STAT_ICON_PROPS} />, accent: 'orange' as const },
    { key: 'offensiveRating', label: 'ORtg', icon: <Swords {...STAT_ICON_PROPS} />, accent: 'cyan' as const },
    { key: 'defensiveRating', label: 'DRtg', icon: <Shield {...STAT_ICON_PROPS} />, accent: 'cyan' as const },
    { key: 'netRating', label: 'NetRtg', icon: <Scale {...STAT_ICON_PROPS} />, accent: 'green' as const },
  ];

  // A Csapat-elemzés kimenete az exportba csak kattintáskor számolódik (a panel a sajátját számolja).
  const exportMarkdown = () => {
    const outcome = leaguePlayers.data
      ? analyzeStageTeam(stageStats, leaguePlayers.data, teamId, seasonType, {
          teamNames: new Map(teams.map(item => [item.id, item.name])),
          playerNames: new Map((teamPlayers.data ?? []).map(player => [player.playerId, player.name])),
        })
      : null;
    return teamStatsToMd({
      seasonName,
      stageLabel: seasonTypeLabel(seasonType),
      teamName,
      games,
      rows,
      analysis: outcome?.status === 'ready' ? outcome.analysis : null,
      leagueTeams: rows[0]?.of ?? 0,
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <CopyMarkdownButton label="Csapat MD" build={exportMarkdown} disabled={!leaguePlayers.data} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map((card, index) => {
          const row = byKey(card.key);
          if (!row) return null;
          return (
            <StatCard
              key={card.key}
              label={card.label}
              value={formatMetricValue(row.metric.kind, row.value)}
              trend="neutral"
              trendValue={formatRank(row.rank, row.of)}
              accentColor={card.accent}
              icon={card.icon}
              animationDelay={index * 60}
            />
          );
        })}
      </div>

      <section className="animate-fade-slide-up">
        <SectionHeading title="Alapmutatók" count={games} unit="mérkőzés" />
        <p className="mb-3 text-sm text-secondary">
          Meccsenkénti átlagok a(z) {teamName} lejátszott mérkőzéseiből; a százalékok az összesített dobásokból
          számolódnak. A helyezés a szakaszban játszott csapatok között készül (1. = a legjobb; a kapott pontnál,
          az eladott labdánál és a személyi hibánál a kevesebb a jobb).
        </p>
        {games > 0 && games < SMALL_SAMPLE_GAMES && (
          <p role="note" className="mb-3 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Kis minta: {games} mérkőzés, a helyezések még nem mérvadók.
          </p>
        )}
        <TeamStatsTable rows={basic} />
      </section>

      <section className="animate-fade-slide-up">
        <SectionHeading title="Fejlett mutatók" />
        <p className="mb-3 text-sm text-secondary">
          100 birtoklásra vetítve. A birtoklásszám a két csapaté közös átlaga ((saját + ellenfél) / 2), a tempó 48
          percre vetített; a tempónál nincs jobb vagy rosszabb irány, ezért a helyezése nem színezett.
        </p>
        <TeamStatsTable rows={advanced} />
      </section>

      <TeamAnalysisPanel
        stageStats={stageStats}
        league={leaguePlayers}
        players={teamPlayers}
        teams={teams}
        teamId={teamId}
        seasonType={seasonType}
      />
    </div>
  );
}

function SectionHeading({ title, count, unit }: { title: string; count?: number; unit?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-xl">{title}</h2>
      {count !== undefined && (
        <span className="font-mono text-sm tabular-nums text-secondary">
          {count} {unit}
        </span>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-3 py-8 text-secondary">
        <Gauge className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function TeamStatsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Csapatstatisztika betöltése">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer h-35" />
        ))}
      </div>
      <div className="skeleton-shimmer h-96" />
    </div>
  );
}
