'use client';

import type { SeasonTeamResourceState } from '@/hooks/useSeasonTeamResource';
import type { PlayerSeasonStats } from '@/lib/player-data';
import { useSeasonTeamResource } from '@/hooks/useSeasonTeamResource';
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
): SeasonTeamResourceState<PlayerSeasonStats[]> {
  return useSeasonTeamResource(seasonId, teamId, loadTeamPlayerStats, ERROR_PREFIX);
}
