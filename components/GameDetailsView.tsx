'use client';

import type { BoxScoreAbsence, BoxScoreTeam, SummedStat } from '@/lib/box-score-data';
import type { TeamGame } from '@/lib/game-data';
import type { Team } from '@/lib/master-data';
import type { ReactNode } from 'react';
import { BoxScoreTable, TeamComparisonTable } from '@/components/BoxScoreTables';
import { DataLoadError } from '@/components/DataLoadError';
import { GameResultBadges } from '@/components/GamesTables';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGameBoxScore } from '@/hooks/useBoxScoreData';
import { formatGameDate } from '@/lib/format-date';
import { seasonTypeLabel } from '@/lib/season-types';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AlertTriangle, ArrowLeft, ClipboardX } from 'lucide-react';

const LOGO_SIZE = 48;
const UNKNOWN_TEAM = 'Ismeretlen csapat';
// Az ESPN indoka szabad szöveg (angolul); csak a leggyakoribbat fordítjuk.
const COACH_DECISION = "COACH'S DECISION";

const SUMMED_STAT_LABELS: Record<SummedStat, string> = {
  points: 'PTS',
  fgMade: 'FGM',
  fgAttempted: 'FGA',
  threeMade: '3PM',
  threeAttempted: '3PA',
  ftMade: 'FTM',
  ftAttempted: 'FTA',
  offensiveRebounds: 'OREB',
  rebounds: 'REB',
  assists: 'AST',
  steals: 'STL',
  blocks: 'BLK',
  fouls: 'PF',
};

interface GameDetailsViewProps {
  seasonId: string;
  /** A meccs a kiválasztott csapat nézőpontjából. */
  game: TeamGame;
  team: Team;
  opponent: Team | undefined;
  onBack: () => void;
}

// Meccs-részletek: eredmény-fejléc, a két csapat összesítője és a box score.
// A kiválasztott csapat áll elöl, ahogy a Mérkőzések listában is.
export function GameDetailsView({ seasonId, game, team, opponent, onBack }: GameDetailsViewProps) {
  const boxScore = useGameBoxScore(seasonId, game.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} autoFocus>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          Vissza a mérkőzésekhez
        </Button>
      </div>

      <Scoreboard game={game} team={team} opponent={opponent} />

      {boxScore.error ? (
        <DataLoadError message={boxScore.error} onRetry={boxScore.reload} />
      ) : boxScore.loading || !boxScore.data ? (
        <BoxScoreSkeleton />
      ) : (
        <BoxScore teams={boxScore.data} game={game} team={team} opponent={opponent} />
      )}
    </div>
  );
}

interface ScoreboardProps {
  game: TeamGame;
  team: Team;
  opponent: Team | undefined;
}

function Scoreboard({ game, team, opponent }: ScoreboardProps) {
  const opponentName = opponent?.name ?? UNKNOWN_TEAM;
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex flex-col gap-5">
        <h2 className="sr-only">{team.name} – {opponentName}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
          <span className="font-mono tabular-nums">{formatGameDate(game.gameDate)}</span>
          <span>{seasonTypeLabel(game.seasonType)}</span>
          <span>{game.isHome ? 'Hazai' : 'Idegenben'}</span>
          {game.venue && <span>{game.venue}</span>}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
          <TeamSide team={team} />
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-baseline gap-1.5 text-3xl sm:gap-3 sm:text-5xl" data-stat>
              <span className={cn(game.result === 'loss' && 'text-secondary')}>{game.teamScore ?? '–'}</span>
              <span className="text-muted">–</span>
              <span className={cn(game.result === 'win' && 'text-secondary')}>{game.opponentScore ?? '–'}</span>
            </div>
            <GameResultBadges game={game} />
          </div>
          <TeamSide team={opponent} reversed />
        </div>
      </CardContent>
    </Card>
  );
}

// Logó + név; keskeny képernyőn a logó alatt a rövidítés áll a név helyén.
function TeamSide({ team, reversed = false }: { team: Team | undefined; reversed?: boolean }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-1.5 sm:gap-3',
        reversed ? 'sm:flex-row-reverse sm:text-right' : 'sm:flex-row sm:text-left',
      )}
    >
      {team?.logo_url ? (
        <Image
          src={team.logo_url}
          alt=""
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          className="h-9 w-9 shrink-0 object-contain sm:h-12 sm:w-12"
        />
      ) : (
        <span className="dt-team-logo shrink-0" aria-hidden="true">{team?.abbreviation ?? '?'}</span>
      )}
      <span className="min-w-0 font-display text-lg font-semibold uppercase tracking-wide sm:text-2xl">
        <span className="hidden truncate md:block">{team?.name ?? UNKNOWN_TEAM}</span>
        <span className="md:hidden">{team?.abbreviation ?? '?'}</span>
      </span>
    </div>
  );
}

interface BoxScoreProps {
  teams: BoxScoreTeam[];
  game: TeamGame;
  team: Team;
  opponent: Team | undefined;
}

function BoxScore({ teams, game, team, opponent }: BoxScoreProps) {
  const own = teams.find(side => side.teamId === team.id);
  const other = teams.find(side => side.teamId === game.opponentTeamId);
  const sides = [
    { side: own, name: team.name },
    { side: other, name: opponent?.name ?? UNKNOWN_TEAM },
  ];

  if (!sides.some(({ side }) => side && side.players.length > 0)) {
    return <EmptyState>Ehhez a mérkőzéshez nincs box score adat.</EmptyState>;
  }

  return (
    <>
      {(own?.totals || other?.totals) && (
        <section className="animate-fade-slide-up">
          <h2 className="mb-3 text-xl">Csapatstatisztika</h2>
          <TeamComparisonTable
            teamLabel={team.abbreviation}
            opponentLabel={opponent?.abbreviation ?? '?'}
            team={own?.totals ?? null}
            opponent={other?.totals ?? null}
          />
        </section>
      )}

      {sides.map(({ side, name }) =>
        side ? <TeamBoxScore key={side.teamId} side={side} teamName={name} /> : null,
      )}
    </>
  );
}

function TeamBoxScore({ side, teamName }: { side: BoxScoreTeam; teamName: string }) {
  return (
    <section className="animate-fade-slide-up">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl">{teamName}</h2>
        <span className="font-mono text-sm tabular-nums text-secondary">{side.players.length}</span>
      </div>
      <p className="mb-3 text-sm text-secondary">
        Elöl a kezdők (K), utánuk a cserék a játszott percek szerint. FG / 3P / FT: bedobott/kísérlet.
      </p>
      {side.sumMismatches.length > 0 && (
        <p role="note" className="mb-3 flex items-start gap-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span>
            A játékossorok összege eltér a csapatsortól, a forrásadat (ESPN) hiányos. A csapatstatisztika a helyes
            érték. Játékosok / csapat:{' '}
            <span className="font-mono tabular-nums">
              {side.sumMismatches
                .map(({ stat, playerSum, teamTotal }) => `${SUMMED_STAT_LABELS[stat]} ${playerSum}/${teamTotal}`)
                .join(' · ')}
            </span>
          </span>
        </p>
      )}
      <BoxScoreTable players={side.players} />
      {side.didNotPlay.length > 0 && (
        <p className="mt-3 text-sm text-secondary">
          <span className="uppercase-label mr-2">Nem lépett pályára</span>
          {side.didNotPlay.map(formatAbsence).join(', ')}
        </p>
      )}
    </section>
  );
}

function formatAbsence(absence: BoxScoreAbsence): string {
  if (!absence.reason) return absence.name;
  const reason = absence.reason === COACH_DECISION ? 'edzői döntés' : absence.reason.toLowerCase();
  return `${absence.name} (${reason})`;
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex items-center gap-3 py-8 text-secondary">
        <ClipboardX className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} />
        <span>{children}</span>
      </CardContent>
    </Card>
  );
}

function BoxScoreSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Box score betöltése">
      <div className="skeleton-shimmer h-96 max-w-3xl" />
      <div className="skeleton-shimmer h-96" />
      <div className="skeleton-shimmer h-96" />
    </div>
  );
}
