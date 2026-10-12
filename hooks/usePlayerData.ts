'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { PlayerSeasonStats } from '@/lib/player-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchTeamPlayerStats } from '@/lib/player-data';
import { supabase } from '@/lib/supabase';

const ERROR_PREFIX = 'A játékosok betöltése sikertelen';

const loadTeamPlayerStats = (seasonId: string, teamId: string) => fetchTeamPlayerStats(supabase, seasonId, teamId);

/**
 * A kiválasztott csapat játékosainak szezon-összesítői, a szezon minden
 * szakaszára (a sorok `seasonType` szerint külön maradnak).
 */
export function useTeamPlayerStats(
  seasonId: string | null,
  teamId: string | null,
): SeasonScopedResourceState<PlayerSeasonStats[]> {
  return useSeasonScopedResource(seasonId, teamId, loadTeamPlayerStats, ERROR_PREFIX);
}
