'use client';

import type { BoxScoreTeam } from '@/lib/box-score-data';
import type { TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { ReactNode } from 'react';
import { CopyMarkdownButton } from '@/components/CopyMarkdownButton';
import { DataLoadError } from '@/components/DataLoadError';
import { PostgameShotMapBlocks } from '@/components/PostgameShotMapBlocks';
import {
  PostgameFactors,
  PostgameHeadlineCards,
  PostgameKeyStats,
  PostgamePlayersTable,
  PostgameSummary,
} from '@/components/PostgameReportBlocks';
import { Card, CardContent } from '@/components/ui/card';
import { useLeaguePlayerTotals } from '@/hooks/useLeaguePlayerData';
import { useGameShots, useTeamSeasonShots } from '@/hooks/useShotData';
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
  /** A csapat összes meccse a szezonban (a dobástérkép szezonreferenciájának szűrője). */
  seasonGames: readonly TeamGame[];
  team: Team;
  opponent: Team | undefined;
}

// Meccs utáni riport egy lezárt meccsre, a kiválasztott csapat nézőpontjából: a meccs
// mutatóit a szezonátlaghoz (a meccs nélkül) és a liga mediánhoz méri a motor
// (lib/postgame-report.ts). A szezon csapat- és játékos-összesítőit a Csapatstatisztika és
// a Játékos-elemzés hookjai adják; a dobástérképhez a meccs és a csapat szezonbeli dobásai
// töltődnek be (hooks/useShotData.ts). A riport csak mindegyik után készül el, így a szövege
// nem változik a dobások megérkezésekor.
export function PostgameReportPanel({ seasonId, seasonName, boxScore, game, seasonGames, team, opponent }: PostgameReportPanelProps) {
  const league = useLeagueTeamStats(seasonId);
  const leaguePlayers = useLeaguePlayerTotals(seasonId);
  const gameShots = useGameShots(seasonId, game.id);
  const seasonShots = useTeamSeasonShots(seasonId, team.id);

  const stageGameIds = useMemo(
    () => new Set(seasonGames.filter(item => item.status === 'final' && item.seasonType === game.seasonType).map(item => item.id)),
    [seasonGames, game.seasonType],
  );

  const outcome = useMemo(() => {
    if (!league.data || !leaguePlayers.data || !gameShots.data || !seasonShots.data) return null;
    return buildGameReport(
      boxScore,
      league.data.stats,
      leaguePlayers.data,
      team.id,
      game.opponentTeamId,
      game.seasonType,
      { teamName: team.name, opponentName: opponent?.name ?? 'Ellenfél' },
      { gameId: game.id, gameShots: gameShots.data, seasonShots: seasonShots.data, stageGameIds },
    );
  }, [
    boxScore,
    league.data,
    leaguePlayers.data,
    gameShots.data,
    seasonShots.data,
    stageGameIds,
    team.id,
    team.name,
    game.id,
    game.opponentTeamId,
    game.seasonType,
    opponent?.name,
  ]);

  const playerNames = useMemo(
    () => new Map(boxScore.flatMap(side => side.players.map(player => [player.playerId, player.name] as const))),
    [boxScore],
  );

  const loadError = [league, leaguePlayers, gameShots, seasonShots].find(resource => resource.error);

  let content: ReactNode;
  if (loadError?.error) {
    content = <DataLoadError message={loadError.error} onRetry={loadError.reload} />;
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
        {report.shotMap && gameShots.data && (
          <section className="animate-fade-slide-up">
            <h3 className="mb-3 text-lg">Dobástérkép és zónák (meccs vs szezon)</h3>
            <PostgameShotMapBlocks
              shotMap={report.shotMap}
              gameShots={gameShots.data}
              teamId={team.id}
              opponentTeamId={game.opponentTeamId}
              teamLabel={team.abbreviation}
              opponentLabel={opponent?.abbreviation ?? 'Ellenfél'}
              playerNames={playerNames}
            />
          </section>
        )}
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
          mediánhoz mérve; a dobászónák a szakasz többi meccséhez. A birtoklásszám a két csapaté közös átlaga, a hatás-pontszám a VAL/36, a TS% és a használat
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
