'use client';

import type { BoxScoreTeam } from '@/lib/box-score-data';
import type { TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { ReactNode } from 'react';
import { CopyMarkdownButton } from '@/components/CopyMarkdownButton';
import { DataLoadError } from '@/components/DataLoadError';
import {
  PostgameFactors,
  PostgameHeadlineCards,
  PostgameKeyStats,
  PostgamePlayersTable,
  PostgameSummary,
} from '@/components/PostgameReportBlocks';
import { Card, CardContent } from '@/components/ui/card';
import { useLeaguePlayerTotals } from '@/hooks/useLeaguePlayerData';
import { useLeagueTeamStats } from '@/hooks/useTeamStatsData';
import { buildGameReport } from '@/lib/adapters/postgame-adapter';
import { postgameReportToMd } from '@/lib/export-to-md';
import { describePostgameBaselineNote } from '@/lib/postgame-report';
import { seasonTypeLabel } from '@/lib/season-types';
import { AlertTriangle, Info } from 'lucide-react';
import { useMemo } from 'react';

interface PostgameReportPanelProps {
  seasonId: string;
  seasonName: string;
  /** A meccs box score-ja (már betöltve): a riport alapja. */
  boxScore: BoxScoreTeam[];
  /** A meccs a kiválasztott csapat nézőpontjából. */
  game: TeamGame;
  team: Team;
  opponent: Team | undefined;
}

// Meccs utáni riport egy lezárt meccsre, a kiválasztott csapat nézőpontjából: a meccs
// mutatóit a szezonátlaghoz (a meccs nélkül) és a liga mediánhoz méri a motor
// (lib/postgame-report.ts). A szezon csapat- és játékos-összesítőit a Csapatstatisztika és
// a Játékos-elemzés hookjai adják, ezért új lekérdezés nincs.
export function PostgameReportPanel({ seasonId, seasonName, boxScore, game, team, opponent }: PostgameReportPanelProps) {
  const league = useLeagueTeamStats(seasonId);
  const leaguePlayers = useLeaguePlayerTotals(seasonId);

  const outcome = useMemo(() => {
    if (!league.data || !leaguePlayers.data) return null;
    return buildGameReport(boxScore, league.data.stats, leaguePlayers.data, team.id, game.opponentTeamId, game.seasonType, {
      teamName: team.name,
      opponentName: opponent?.name ?? 'Ellenfél',
    });
  }, [boxScore, league.data, leaguePlayers.data, team.id, team.name, game.opponentTeamId, game.seasonType, opponent?.name]);

  let content: ReactNode;
  if (league.error) {
    content = <DataLoadError message={league.error} onRetry={league.reload} />;
  } else if (leaguePlayers.error) {
    content = <DataLoadError message={leaguePlayers.error} onRetry={leaguePlayers.reload} />;
  } else if (!outcome) {
    content = <div className="skeleton-shimmer h-72" aria-busy="true" aria-label="Meccs utáni riport betöltése" />;
  } else if (outcome.status === 'no-team-stats') {
    content = <Notice>Ehhez a mérkőzéshez hiányzik a csapatstatisztika, ezért nem készíthető riport.</Notice>;
  } else if (outcome.status === 'no-season-stats') {
    content = <Notice>A csapatnak nincs szezon-összesítője ebben a szakaszban, ezért nincs mihez mérni a meccset.</Notice>;
  } else {
    const { report, hasLeagueBenchmark } = outcome;
    const baselineNote = describePostgameBaselineNote(report.baseline, hasLeagueBenchmark);
    content = (
      <>
        <PostgameHeadlineCards report={report} />
        {(report.dataNotes.length > 0 || baselineNote) && (
          <ul className="flex flex-col gap-1.5 text-sm text-warning">
            {report.dataNotes.map(note => (
              <li key={note} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                {note}
              </li>
            ))}
            {baselineNote && (
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                {baselineNote}
              </li>
            )}
          </ul>
        )}
        <PostgameSummary report={report} />
        <section className="animate-fade-slide-up">
          <h3 className="mb-3 text-lg">Kulcsmutatók</h3>
          <PostgameKeyStats report={report} />
        </section>
        <PostgameFactors report={report} />
        <section className="animate-fade-slide-up">
          <h3 className="mb-3 text-lg">Játékosok</h3>
          <PostgamePlayersTable report={report} />
        </section>
      </>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">Meccs utáni riport</h2>
          {outcome?.status === 'ready' && (
            <CopyMarkdownButton
              label="Riport MD"
              build={() =>
                postgameReportToMd(outcome.report, {
                  seasonName,
                  gameDate: game.gameDate,
                  stageLabel: seasonTypeLabel(game.seasonType),
                  isHome: game.isHome,
                  venue: game.venue,
                  hasLeagueBenchmark: outcome.hasLeagueBenchmark,
                })
              }
            />
          )}
        </div>
        <p className="mt-1 text-sm text-secondary">
          A meccs mutatói a(z) {team.name} szezonátlagához (a meccs nélkül, kis mintánál a liga mediánhoz) és a liga
          mediánhoz mérve. A birtoklásszám a két csapaté közös átlaga, a hatás-pontszám a VAL/36, a TS% és a használat
          súlyozott keveréke; a szöveges megállapítások szabály-alapúak.
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
