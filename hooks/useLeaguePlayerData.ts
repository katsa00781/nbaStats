'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { LeaguePlayerTotals } from '@/lib/league-player-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchLeaguePlayerTotals } from '@/lib/league-player-data';
import { supabase } from '@/lib/supabase';

const ERROR_PREFIX = 'A liga játékosadatainak betöltése sikertelen';

// A benchmarkhoz mind a 30 csapat játékosa kell, ezért a második kulcsra nincs szükség.
const loadLeaguePlayerTotals = (seasonId: string) => fetchLeaguePlayerTotals(supabase, seasonId);

/**
 * A szezon összes játékosának összegei (a játékos-elemzés benchmarkjához). Csak a
 * szezon a kulcs: a játékos- vagy csapatváltás nem kérdez újra.
 */
export function useLeaguePlayerTotals(seasonId: string | null): SeasonScopedResourceState<LeaguePlayerTotals[]> {
  // A közös betöltő szezon + második kulcsot vár: a szezon azonosítója áll a második helyen is.
  return useSeasonScopedResource(seasonId, seasonId, loadLeaguePlayerTotals, ERROR_PREFIX);
}
