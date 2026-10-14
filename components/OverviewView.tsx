'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { Team } from '@/lib/master-data';
import type { StandingRow } from '@/lib/standings-data';
import type { TeamMetricRow } from '@/lib/team-stats-metrics';
import { DataLoadError } from '@/components/DataLoadError';
import {
  ConferenceSnapshot,
  NextGameCard,
  OverviewSection,
  RecentGamesTable,
  TopPlayersTable,
} from '@/components/OverviewBlocks';
import { formatGamesBehind, formatStreak, formatWinPct } from '@/components/StandingsTable';
import { formatMetricValue, formatRank } from '@/components/TeamStatsTable';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { useTeamGames } from '@/hooks/useGameData';
import { useTeamPlayerStats } from '@/hooks/usePlayerData';
import { useStandings } from '@/hooks/useStandingsData';
import { useLeagueTeamStats } from '@/hooks/useTeamStatsData';
import { orderSeasonTypes, REGULAR_SEASON, resolveSeasonType, seasonTypeLabel } from '@/lib/season-types';
import { buildTeamMetricRows } from '@/lib/team-stats-metrics';
import { useMemo } from 'react';
import { Activity, Flame, LayoutDashboard, ListOrdered, Scale, Trophy } from 'lucide-react';

const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;
const RECENT_GAMES = 5;
const TOP_PLAYERS = 5;
const SNAPSHOT_TEAMS = 5;
// Ez alatt a meccsszám alatt a pontátlag kis mintára épül (T15): a lista elejére nem kerül játékos.
const MIN_TOP_PLAYER_GAMES = 10;

const CONFERENCES = [
  { key: 'East', label: 'Keleti konferencia' },
  { key: 'West', label: 'Nyugati konferencia' },
] as const;

interface OverviewViewProps {
  selection: SeasonTeamSelection;
  onNavigate: (tab: string) => void;
}

// Áttekintés: a kiválasztott csapat pillanatképe egy helyen – mérleg, kiemelés, forma,
// NetRtg; a következő és az utolsó meccsek; a legjobb játékosok; a két konferencia
// élmezőnye. Új lekérdezés nincs: a Tabella, a Csapatstatisztika, a Mérkőzések és a
// Játékosok nézet hookjait használja. A szakaszok nem keverednek: a kártyák és a
// játékosok az alapszakaszt mutatják (annak híján az első elérhető szakaszt).
export function OverviewView({ selection, onNavigate }: OverviewViewProps) {
  const { season, team, teams } = selection;
  const standings = useStandings(season?.id ?? null);
  const league = useLeagueTeamStats(season?.id ?? null);
  const games = useTeamGames(season?.id ?? null, team?.id ?? null);
  const players = useTeamPlayerStats(season?.id ?? null, team?.id ?? null);
  const teamsById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const teamId = team?.id ?? null;

  const stageStats = useMemo(() => {
    const own = (league.data?.stats ?? []).filter(s => s.teamId === teamId);
    const stage = resolveSeasonType(orderSeasonTypes(own.map(s => s.seasonType)), null);
    return stage === null ? null : { stage, stats: (league.data?.stats ?? []).filter(s => s.seasonType === stage) };
  }, [league.data, teamId]);
  const metricRows = useMemo(
    () => (stageStats && teamId ? buildTeamMetricRows(stageStats.stats, teamId) : []),
    [stageStats, teamId],
  );
  const topPlayers = useMemo(() => {
    const stage = resolveSeasonType(orderSeasonTypes((players.data ?? []).map(p => p.seasonType)), null);
    const stagePlayers = (players.data ?? []).filter(p => p.seasonType === stage);
    const qualified = stagePlayers.filter(p => p.gamesPlayed >= MIN_TOP_PLAYER_GAMES);
    return [...(qualified.length > 0 ? qualified : stagePlayers)]
      .sort((a, b) => b.pointsPerGame - a.pointsPerGame)
      .slice(0, TOP_PLAYERS);
  }, [players.data]);

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  const failed = [standings, league, games, players].find(resource => resource.error);
  if (failed?.error) return <DataLoadError message={failed.error} onRetry={failed.reload} />;
  if (selection.loading || standings.loading || league.loading || games.loading || players.loading) {
    return <OverviewSkeleton />;
  }
  if (!season || !team || !standings.data || !games.data) return null;

  const teamStanding = standings.data.find(row => row.teamId === team.id) ?? null;
  const allGames = games.data;
  const nextGame = allGames.find(game => game.status === 'scheduled' || game.status === 'in_progress') ?? null;
  const recentGames = allGames.filter(game => game.status === 'final').slice(-RECENT_GAMES).reverse();

  if (!teamStanding && recentGames.length === 0 && !nextGame) {
    return (
      <Card className="animate-fade-slide-up">
        <CardContent className="flex items-center gap-3 py-8 text-secondary">
          <LayoutDashboard className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
          <span>A(z) {team.name} csapatnak még nincs adata a(z) {season.name} szezonban.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {(teamStanding || metricRows.length > 0) && (
        <TeamCards
          standing={teamStanding}
          team={team}
          netRating={metricRows.find(row => row.metric.key === 'netRating')}
          offensiveRating={metricRows.find(row => row.metric.key === 'offensiveRating')}
          defensiveRating={metricRows.find(row => row.metric.key === 'defensiveRating')}
          stageLabel={stageStats && stageStats.stage !== REGULAR_SEASON ? seasonTypeLabel(stageStats.stage) : null}
        />
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <OverviewSection title="Következő mérkőzés">
          <NextGameCard game={nextGame} teamsById={teamsById} onOpenScouting={() => onNavigate('scouting')} />
        </OverviewSection>
        {recentGames.length > 0 && (
          <OverviewSection title="Utolsó mérkőzések" note="A legfrissebb elöl, minden szakaszból.">
            <RecentGamesTable games={recentGames} teamsById={teamsById} />
          </OverviewSection>
        )}
      </div>

      {topPlayers.length > 0 && (
        <OverviewSection
          title="Legjobb játékosok"
          note={`Pontátlag szerint, a(z) ${team.name} színeiben játszott mérkőzésekből (legalább ${MIN_TOP_PLAYER_GAMES} meccs, ha van ennyi játékos).`}
        >
          <TopPlayersTable players={topPlayers} />
        </OverviewSection>
      )}

      {standings.data.length > 0 && (
        <OverviewSection title="Liga-pillanatkép" note="Alapszakasz, az ESPN napi pillanatképe; a kiválasztott csapat kiemelve.">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {CONFERENCES.map(conference => (
              <ConferenceSnapshot
                key={conference.key}
                title={conference.label}
                rows={topOfConference(standings.data ?? [], teamsById, conference.key)}
                teamsById={teamsById}
                activeTeamId={team.id}
              />
            ))}
          </div>
        </OverviewSection>
      )}
    </div>
  );
}

/** A konferencia első néhány csapata kiemelés szerint. */
function topOfConference(rows: StandingRow[], teamsById: ReadonlyMap<string, Team>, conference: string): StandingRow[] {
  return rows
    .filter(row => teamsById.get(row.teamId)?.conference === conference)
    .sort((a, b) => (a.conferenceSeed ?? Infinity) - (b.conferenceSeed ?? Infinity))
    .slice(0, SNAPSHOT_TEAMS);
}

interface TeamCardsProps {
  standing: StandingRow | null;
  team: Team;
  netRating: TeamMetricRow | undefined;
  offensiveRating: TeamMetricRow | undefined;
  defensiveRating: TeamMetricRow | undefined;
  /** Kitöltve, ha a mutatók nem az alapszakaszból jönnek. */
  stageLabel: string | null;
}

function TeamCards({ standing, team, netRating, offensiveRating, defensiveRating, stageLabel }: TeamCardsProps) {
  const conferenceLabel = CONFERENCES.find(c => c.key === team.conference)?.label ?? 'Konferencia';
  const ratingTrend = [
    offensiveRating && `ORtg ${formatMetricValue(offensiveRating.metric.kind, offensiveRating.value)}`,
    defensiveRating && `DRtg ${formatMetricValue(defensiveRating.metric.kind, defensiveRating.value)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const cards = [
    standing && {
      label: 'Mérleg',
      value: `${standing.wins}–${standing.losses}`,
      trendValue: `GY% ${formatWinPct(standing.winPct)}`,
      icon: <Trophy {...STAT_ICON_PROPS} />,
      accent: 'orange' as const,
    },
    standing && {
      label: 'Kiemelés',
      value: standing.conferenceSeed === null ? '–' : `${standing.conferenceSeed}.`,
      trendValue: `${conferenceLabel}, GB ${formatGamesBehind(standing.gamesBehind)}`,
      icon: <ListOrdered {...STAT_ICON_PROPS} />,
      accent: 'cyan' as const,
    },
    standing && {
      label: 'Forma',
      value: standing.lastTen ?? '–',
      trendValue: `Sorozat ${formatStreak(standing.streak)} · utolsó 10`,
      icon: standing.streak?.startsWith('L') ? <Activity {...STAT_ICON_PROPS} /> : <Flame {...STAT_ICON_PROPS} />,
      accent: standing.streak?.startsWith('L') ? ('orange' as const) : ('green' as const),
    },
    netRating && {
      label: stageLabel ? `NetRtg · ${stageLabel}` : 'NetRtg',
      value: formatMetricValue(netRating.metric.kind, netRating.value),
      trendValue: [ratingTrend, formatRank(netRating.rank, netRating.of)].filter(Boolean).join(' · '),
      icon: <Scale {...STAT_ICON_PROPS} />,
      accent: 'cyan' as const,
    },
  ].filter((card): card is NonNullable<typeof card> => Boolean(card));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          trend="neutral"
          trendValue={card.trendValue}
          accentColor={card.accent}
          icon={card.icon}
          animationDelay={index * 60}
        />
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Áttekintés betöltése">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer h-35" />
        ))}
      </div>
      <div className="skeleton-shimmer h-64" />
      <div className="skeleton-shimmer h-64" />
    </div>
  );
}
