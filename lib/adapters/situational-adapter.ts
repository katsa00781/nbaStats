// Adapter az NBA sémáról a szituációs motor (lib/situational-analysis.ts) bemenetére:
// a csapat meccseiből (semleges hazai/vendég sor → a csapat nézőpontja, TeamGame) és a
// meccsekhez tartozó csapatsorokból (mindkét oldal) szakaszonként állítja elő a motor
// meccslistáját és az összesített box score-ját. A motor így nem ismeri a sémát.

import type { SituationGame, SituationMetricStats } from '@/lib/situational-analysis';
import type { TeamGame } from '@/lib/game-data';
import type { TeamGameRow, TeamStageStats } from '@/lib/team-stats-data';
import { toLeagueTeamStats } from '@/lib/team-stats-data';

export interface SituationalInput {
  games: SituationGame[];
  metricStats: SituationMetricStats;
}

/**
 * A `seasonType` szakasz lejátszott meccsei és összesített mutatóinak alapja. Csak a
 * lezárt, mindkét pontszámmal rendelkező meccs számít. A csapatsorokból a hazai és a
 * vendég részhalmaz külön összegződik; az a meccs, amelyiknek valamelyik csapatsora
 * hiányzik, a mutatókból kimarad (a meccslistában benne van).
 */
export function toSituationalInput(
  teamGames: readonly TeamGame[],
  statRows: readonly TeamGameRow[],
  teamId: string,
  seasonType: number,
  opponentLabel: (opponentTeamId: string) => string,
): SituationalInput {
  const played = teamGames.filter(
    game => game.seasonType === seasonType && game.result !== null && game.teamScore !== null && game.opponentScore !== null,
  );
  const homeIds = new Set(played.filter(game => game.isHome).map(game => game.id));
  const awayIds = new Set(played.filter(game => !game.isHome).map(game => game.id));

  const stageStats = (gameIds: ReadonlySet<string>): TeamStageStats | null => {
    if (gameIds.size === 0) return null;
    const rows = statRows.filter(row => gameIds.has(row.game_id));
    return toLeagueTeamStats(rows).stats.find(stats => stats.teamId === teamId) ?? null;
  };

  return {
    games: played.map(game => ({
      id: game.id,
      date: game.gameDate,
      opponent: opponentLabel(game.opponentTeamId),
      isHome: game.isHome,
      // A szűrés garantálja a nem-null értéket.
      ourScore: game.teamScore ?? 0,
      oppScore: game.opponentScore ?? 0,
      overtimes: game.overtimes,
    })),
    metricStats: {
      all: stageStats(new Set([...homeIds, ...awayIds])),
      home: stageStats(homeIds),
      away: stageStats(awayIds),
    },
  };
}
