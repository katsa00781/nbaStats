'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import type { Team } from '@/lib/master-data';
import type { StandingRow } from '@/lib/standings-data';
import type { ReactNode } from 'react';
import { DataLoadError } from '@/components/DataLoadError';
import { formatGamesBehind, formatStreak, formatWinPct, StandingsTable } from '@/components/StandingsTable';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStandings } from '@/hooks/useStandingsData';
import { CLINCHER_LABELS } from '@/lib/standings-data';
import { useMemo, useState } from 'react';
import { Activity, Flame, ListOrdered, Trophy } from 'lucide-react';

const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;

const CONFERENCES = [
  { key: 'East', label: 'Keleti konferencia' },
  { key: 'West', label: 'Nyugati konferencia' },
] as const;
type ConferenceKey = (typeof CONFERENCES)[number]['key'];
const isConferenceKey = (value: string | null): value is ConferenceKey => CONFERENCES.some(c => c.key === value);

interface StandingsViewProps {
  selection: SeasonTeamSelection;
}

// Tabella nézet: az ESPN alapszakasz-tabellája konferenciánként (kiemelés szerint),
// a kiválasztott csapat kiemelve, a konferenciája nyílik meg elöl. A tabella csak
// alapszakaszra szól, ezért nincs szakasz-választó.
export function StandingsView({ selection }: StandingsViewProps) {
  const { season, team } = selection;
  const standings = useStandings(season?.id ?? null);
  // A választott fül a csapathoz kötött: csapatváltáskor a csapat konferenciája jön vissza.
  const [chosen, setChosen] = useState<{ teamId: string; conference: ConferenceKey } | null>(null);
  const teamsById = useMemo(() => new Map(selection.teams.map(t => [t.id, t])), [selection.teams]);

  // A törzsadat hibáját és üres állapotát a választó jeleníti meg.
  if (selection.error) return null;
  if (standings.error) return <DataLoadError message={standings.error} onRetry={standings.reload} />;
  if (selection.loading || standings.loading) return <StandingsSkeleton />;
  if (!season || !team || !standings.data) return null;

  if (standings.data.length === 0) {
    return (
      <EmptyState>
        A(z) {season.name} szezonnak még nincs tabellája: az első lezárt mérkőzés után töltődik.
      </EmptyState>
    );
  }

  const ownConference = isConferenceKey(team.conference) ? team.conference : CONFERENCES[0].key;
  const conference = chosen?.teamId === team.id ? chosen.conference : ownConference;
  const teamStanding = standings.data.find(row => row.teamId === team.id) ?? null;

  return (
    <div className="flex flex-col gap-8">
      {teamStanding && <TeamStandingCards standing={teamStanding} team={team} />}
      <Tabs
        value={conference}
        onValueChange={value => isConferenceKey(value) && setChosen({ teamId: team.id, conference: value })}
        className="gap-6"
      >
        <TabsList aria-label="Konferencia">
          {CONFERENCES.map(c => (
            <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        {CONFERENCES.map(c => {
          const rows = standings.data?.filter(row => teamsById.get(row.teamId)?.conference === c.key) ?? [];
          return (
            <TabsContent key={c.key} value={c.key}>
              <section className="animate-fade-slide-up">
                <ConferenceNote rows={rows} />
                <StandingsTable rows={rows} teamsById={teamsById} activeTeamId={team.id} />
                <ClincherLegend rows={rows} />
              </section>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function ConferenceNote({ rows }: { rows: StandingRow[] }) {
  return (
    <p className="mb-3 text-sm text-secondary">
      Alapszakasz, az ESPN napi pillanatképe ({rows.length} csapat). A sorrend a hivatalos kiemelés; GB = lemaradás a
      konferencia éléről, L10 = utolsó 10 meccs, PF / PA = szerzett / kapott pont meccsenként. A kiválasztott csapat
      kiemelve.
    </p>
  );
}

// A táblában előforduló clincher-jelölések magyarázata (az ESPN saját jelölései).
function ClincherLegend({ rows }: { rows: StandingRow[] }) {
  const codes = [...new Set(rows.map(row => row.clincher).filter((code): code is string => code !== null))];
  if (codes.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-secondary" aria-label="Jelölések">
      {codes.map(code => (
        <li key={code}>
          <span className="font-mono text-primary">{code}</span> {CLINCHER_LABELS[code] ?? code}
        </li>
      ))}
    </ul>
  );
}

function TeamStandingCards({ standing, team }: { standing: StandingRow; team: Team }) {
  const conferenceLabel = CONFERENCES.find(c => c.key === team.conference)?.label ?? 'Konferencia';
  const cards = [
    {
      label: 'Mérleg',
      value: `${standing.wins}–${standing.losses}`,
      trendValue: `GY% ${formatWinPct(standing.winPct)}`,
      icon: <Trophy {...STAT_ICON_PROPS} />,
      accent: 'orange' as const,
    },
    {
      label: 'Kiemelés',
      value: standing.conferenceSeed === null ? '–' : `${standing.conferenceSeed}.`,
      trendValue: `${conferenceLabel}, GB ${formatGamesBehind(standing.gamesBehind)}`,
      icon: <ListOrdered {...STAT_ICON_PROPS} />,
      accent: 'cyan' as const,
    },
    {
      label: 'Utolsó 10',
      value: standing.lastTen ?? '–',
      trendValue: `Hazai ${standing.homeRecord ?? '–'} · Idegen ${standing.roadRecord ?? '–'}`,
      icon: <Activity {...STAT_ICON_PROPS} />,
      accent: 'cyan' as const,
    },
    {
      label: 'Sorozat',
      value: formatStreak(standing.streak),
      trendValue: `Konf. ${standing.conferenceRecord ?? '–'} · Div. ${standing.divisionRecord ?? '–'}`,
      icon: <Flame {...STAT_ICON_PROPS} />,
      accent: standing.streak?.startsWith('L') ? ('orange' as const) : ('green' as const),
    },
  ];

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

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-3 py-8 text-secondary">
        <Trophy className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function StandingsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Tabella betöltése">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer h-35" />
        ))}
      </div>
      <div className="skeleton-shimmer h-96" />
    </div>
  );
}
