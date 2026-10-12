'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { BoxScoreTeam } from '@/lib/box-score-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { fetchGameBoxScore } from '@/lib/box-score-data';
import { supabase } from '@/lib/supabase';

const ERROR_PREFIX = 'A mérkőzés adatainak betöltése sikertelen';

const loadGameBoxScore = (seasonId: string, gameId: string) => fetchGameBoxScore(supabase, seasonId, gameId);

/**
 * Egy meccs box score-ja, csapatonként. A közös betöltő második kulcsa itt a
 * meccs (nem a csapat): a mechanika ugyanaz – meccsváltáskor a régi adat nem
 * látszik tovább, `null` szezonnal vagy meccsel nem indul lekérdezés.
 */
export function useGameBoxScore(
  seasonId: string | null,
  gameId: string | null,
): SeasonScopedResourceState<BoxScoreTeam[]> {
  return useSeasonScopedResource(seasonId, gameId, loadGameBoxScore, ERROR_PREFIX);
}
