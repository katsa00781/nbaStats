'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { TeamGameRow } from '@/lib/team-stats-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchTeamGameStatRows } from '@/lib/situational-data';
import { supabase } from '@/lib/supabase';

const ERROR_PREFIX = 'A szituációs elemzés betöltése sikertelen';

const loadTeamGameStatRows = (seasonId: string, teamId: string) => fetchTeamGameStatRows(supabase, seasonId, teamId);

/** A kiválasztott csapat és ellenfelei meccsenkénti csapatsorai a szezonban (minden szakasz). */
export function useTeamGameStatRows(
  seasonId: string | null,
  teamId: string | null,
): SeasonScopedResourceState<TeamGameRow[]> {
  return useSeasonScopedResource(seasonId, teamId, loadTeamGameStatRows, ERROR_PREFIX);
}
