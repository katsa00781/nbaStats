'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { PlayerGameLog } from '@/lib/player-game-log-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchPlayerGameLog } from '@/lib/player-game-log-data';
import { supabase } from '@/lib/supabase';

const ERROR_PREFIX = 'A játékos mérkőzéseinek betöltése sikertelen';

const loadPlayerGameLog = (seasonId: string, playerId: string) => fetchPlayerGameLog(supabase, seasonId, playerId);

/**
 * Egy játékos meccsenkénti naplója a szezonban. A közös betöltő második kulcsa
 * itt a játékos (nem a csapat): a mechanika ugyanaz – játékosváltáskor a régi
 * adat nem látszik tovább, `null` szezonnal vagy játékossal nem indul lekérdezés.
 */
export function usePlayerGameLog(
  seasonId: string | null,
  playerId: string | null,
): SeasonScopedResourceState<PlayerGameLog> {
  return useSeasonScopedResource(seasonId, playerId, loadPlayerGameLog, ERROR_PREFIX);
}
