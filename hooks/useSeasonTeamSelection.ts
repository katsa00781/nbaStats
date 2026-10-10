'use client';

import type { Season, Team } from '@/lib/master-data';
import { useFollowedTeam, useSeasons, useTeams } from '@/hooks/useMasterData';
import { resolveSeason, resolveTeam } from '@/lib/selection';
import { useCallback, useMemo, useState } from 'react';

export interface SeasonTeamSelection {
  seasons: Season[];
  teams: Team[];
  followedTeamId: string | null;
  /** A kiválasztott szezon; betöltés alatt és hibánál `null`. */
  season: Season | null;
  /** A kiválasztott csapat; betöltés alatt és hibánál `null`. */
  team: Team | null;
  selectSeason: (seasonId: string) => void;
  selectTeam: (teamId: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Az AppShell szezon- és csapatválasztójának állapota. Csak a felhasználó
 * választását tárolja; amíg nem választ, az alapértelmezés érvényes (2025/26-os
 * szezon + követett csapat, `lib/selection.ts`). Csak az auth guard mögött hívható.
 * A választás példányonkénti: egyszer, az AppShellben hívjuk, a nézetek propként
 * kapják a szezont és a csapatot.
 */
export function useSeasonTeamSelection(): SeasonTeamSelection {
  const seasons = useSeasons();
  const teams = useTeams();
  const followedTeam = useFollowedTeam();
  const [chosenSeasonId, setChosenSeasonId] = useState<string | null>(null);
  const [chosenTeamId, setChosenTeamId] = useState<string | null>(null);

  const loading = seasons.loading || teams.loading || followedTeam.loading;
  // A követett csapat hibája a csapatok és a beállítások hibáját is lefedi.
  const error = seasons.error ?? followedTeam.error;
  const ready = !loading && !error;

  const season = useMemo(
    () => (ready ? resolveSeason(seasons.data ?? [], chosenSeasonId) : null),
    [ready, seasons.data, chosenSeasonId],
  );
  const team = useMemo(
    () => (ready ? resolveTeam(teams.data ?? [], chosenTeamId, followedTeam.data) : null),
    [ready, teams.data, chosenTeamId, followedTeam.data],
  );

  const reloadSeasons = seasons.reload;
  const reloadFollowedTeam = followedTeam.reload;
  const seasonsFailed = seasons.error !== null;
  const followedTeamFailed = followedTeam.error !== null;
  const reload = useCallback(() => {
    if (seasonsFailed) reloadSeasons();
    if (followedTeamFailed) reloadFollowedTeam();
  }, [seasonsFailed, followedTeamFailed, reloadSeasons, reloadFollowedTeam]);

  return {
    seasons: seasons.data ?? [],
    teams: teams.data ?? [],
    followedTeamId: followedTeam.data?.id ?? null,
    season,
    team,
    selectSeason: setChosenSeasonId,
    selectTeam: setChosenTeamId,
    loading,
    error,
    reload,
  };
}
