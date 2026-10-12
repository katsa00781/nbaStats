'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { TeamGameRow } from '@/lib/team-stats-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { FormTable, SituationMetricsTable, SituationsTable, toMetricRows } from '@/components/SituationalTables';
import { formatWinPct } from '@/components/StandingsTable';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamGames } from '@/hooks/useGameData';
import { useTeamGameStatRows } from '@/hooks/useSituationalData';
import { toSituationalInput } from '@/lib/adapters/situational-adapter';
import { orderSeasonTypes, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import { buildSituationalData } from '@/lib/situational-analysis';
import { useMemo, useState } from 'react';
import { AlertTriangle, Flame, House, Plane, Target, Timer } from 'lucide-react';

const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;
// Ez alatt a meccsszám alatt a szituációs mérleg még nem mérvadó (kis minta, T15).
const SMALL_SAMPLE_GAMES = 10;

interface SituationalViewProps {
  selection: SeasonTeamSelection;
}

// Szituációk nézet: a kiválasztott csapat mérlege hazai / vendég, szoros, gála és
// hosszabbításos meccseken, fejlett mutatói és formája a szezon egy szakaszában.
// A szakaszok nem keverednek. Negyedenkénti bontás nincs (a linescore nincs tárolva).
export function SituationalView({ selection }: SituationalViewProps) {
  const { season, team, teams } = selection;
  const games = useTeamGames(season?.id ?? null, team?.id ?? null);
  const statRows = useTeamGameStatRows(season?.id ?? null, team?.id ?? null);
  const [chosenStage, setChosenStage] = useState<number | null>(null);
  const teamsById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  // Csak a lezárt meccsek szakaszai: a kiírt meccs nem ad szituációt.
  const stages = useMemo(
    () => orderSeasonTypes((games.data ?? []).filter(game => game.result !== null).map(game => game.seasonType)),
    [games.data],
  );

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  const error = games.error ?? statRows.error;
  if (error) {
    return (
      <DataLoadError
        message={error}
        onRetry={() => {
          games.reload();
          statRows.reload();
        }}
      />
    );
  }
  if (selection.loading || games.loading || statRows.loading) return <SituationalSkeleton />;
  if (!season || !team || !games.data || !statRows.data) return null;

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
      {stages.map(type => (
        <TabsContent key={type} value={String(type)}>
          <SituationalStage
            key={`${season.id}|${team.id}|${type}`}
            games={games.data ?? []}
            statRows={statRows.data ?? []}
            team={team}
            teamsById={teamsById}
            seasonType={type}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface SituationalStageProps {
  games: TeamGame[];
  statRows: TeamGameRow[];
  team: Team;
  teamsById: ReadonlyMap<string, Team>;
  seasonType: number;
}

function SituationalStage({ games, statRows, team, teamsById, seasonType }: SituationalStageProps) {
  const data = useMemo(() => {
    const input = toSituationalInput(
      games,
      statRows,
      team.id,
      seasonType,
      opponentId => teamsById.get(opponentId)?.abbreviation ?? '?',
    );
    return buildSituationalData(input.games, input.metricStats);
  }, [games, statRows, team.id, seasonType, teamsById]);
  const { situations } = data;
  const cards = [
    { result: situations.home, icon: <House {...STAT_ICON_PROPS} />, accent: 'cyan' as const },
    { result: situations.away, icon: <Plane {...STAT_ICON_PROPS} />, accent: 'cyan' as const },
    { result: situations.closeGames, icon: <Target {...STAT_ICON_PROPS} />, accent: 'orange' as const },
    { result: situations.blowouts, icon: <Flame {...STAT_ICON_PROPS} />, accent: 'green' as const },
  ];
  const missingMetrics = data.totalGames - data.gamesWithMetricsData;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ result, icon, accent }, index) => (
          <StatCard
            key={result.label}
            label={result.label}
            value={result.total > 0 ? `${result.wins}–${result.losses}` : '–'}
            trend="neutral"
            trendValue={result.total > 0 ? `GY% ${formatWinPct(result.winRate)}` : 'nincs meccs'}
            accentColor={accent}
            icon={icon}
            animationDelay={index * 60}
          />
        ))}
      </div>

      <section className="animate-fade-slide-up">
        <SectionHeading title="Szituációk" count={data.totalGames} unit="mérkőzés" />
        <p className="mb-3 text-sm text-secondary">
          Mérleg a(z) {team.name} lejátszott mérkőzésein. Szoros: a különbség legfeljebb 5 pont; gálameccs: legalább 15
          pont; hosszabbítás: a meccs hosszabbításra ment.
        </p>
        {data.totalGames < SMALL_SAMPLE_GAMES && (
          <p role="note" className="mb-3 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Kis minta: {data.totalGames} mérkőzés, a szituációs mérleg még nem mérvadó.
          </p>
        )}
        <SituationsTable
          rows={[situations.home, situations.away, situations.closeGames, situations.blowouts, situations.overtime]}
        />
      </section>

      <section className="animate-fade-slide-up">
        <SectionHeading title="Fejlett mutatók" count={data.gamesWithMetricsData} unit="mérkőzés" />
        <p className="mb-3 text-sm text-secondary">
          Az összesített box score-ból, 100 közös birtoklásra vetítve (ugyanaz a definíció, mint a Csapatstatisztikán).
          A hazai / vendég bontás az ORtg-nél és az eFG%-nál látszik.
        </p>
        {missingMetrics > 0 && (
          <p role="note" className="mb-3 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {missingMetrics} mérkőzés kimaradt a mutatókból, mert valamelyik csapat statisztikai sora hiányzik.
          </p>
        )}
        <SituationMetricsTable rows={toMetricRows(data.metrics)} />
      </section>

      <section className="animate-fade-slide-up">
        <SectionHeading title="Forma" count={data.form.length} unit="mérkőzés" />
        <p className="mb-3 text-sm text-secondary">
          Meccsenként, a legfrissebb elöl. Az „Utolsó 5 GY%” az ötödik meccstől számolódik.
        </p>
        <FormTable rows={data.form} />
      </section>
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
        <Timer className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function SituationalSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Szituációk betöltése">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer h-35" />
        ))}
      </div>
      <div className="skeleton-shimmer h-96" />
    </div>
  );
}
