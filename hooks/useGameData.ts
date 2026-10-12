'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { TeamGame } from '@/lib/game-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchTeamGames } from '@/lib/game-data';
import { supabase } from '@/lib/supabase';

const ERROR_PREFIX = 'A mérkőzések betöltése sikertelen';

const loadTeamGames = (seasonId: string, teamId: string) => fetchTeamGames(supabase, seasonId, teamId);

/** A kiválasztott csapat meccsei a kiválasztott szezonban, időrendben, minden szakaszban. */
export function useTeamGames(seasonId: string | null, teamId: string | null): SeasonScopedResourceState<TeamGame[]> {
  return useSeasonScopedResource(seasonId, teamId, loadTeamGames, ERROR_PREFIX);
}
