'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { GameShot, SeasonShot } from '@/lib/shot-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchGameShots, fetchTeamSeasonShots } from '@/lib/shot-data';
import { supabase } from '@/lib/supabase';

const GAME_ERROR_PREFIX = 'A mérkőzés dobásainak betöltése sikertelen';
const SEASON_ERROR_PREFIX = 'A csapat szezonbeli dobásainak betöltése sikertelen';

const loadGameShots = (seasonId: string, gameId: string) => fetchGameShots(supabase, seasonId, gameId);
const loadTeamSeasonShots = (seasonId: string, teamId: string) => fetchTeamSeasonShots(supabase, seasonId, teamId);

/** Egy meccs mindkét csapatának dobásai; a második kulcs a meccs. */
export function useGameShots(
  seasonId: string | null,
  gameId: string | null,
): SeasonScopedResourceState<GameShot[]> {
  return useSeasonScopedResource(seasonId, gameId, loadGameShots, GAME_ERROR_PREFIX);
}

/**
 * Egy csapat összes dobása a szezonban (minden szakasz); a második kulcs a csapat.
 * A szakaszra és a vizsgált meccs kizárására a hívó szűr.
 */
export function useTeamSeasonShots(
  seasonId: string | null,
  teamId: string | null,
): SeasonScopedResourceState<SeasonShot[]> {
  return useSeasonScopedResource(seasonId, teamId, loadTeamSeasonShots, SEASON_ERROR_PREFIX);
}
