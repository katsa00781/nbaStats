'use client';

import type { SeasonScopedResourceState } from '@/hooks/useSeasonScopedResource';
import type { StandingRow } from '@/lib/standings-data';
import { useSeasonScopedResource } from '@/hooks/useSeasonScopedResource';
import { supabase } from '@/lib/supabase';
import { fetchStandings } from '@/lib/standings-data';

const ERROR_PREFIX = 'A tabella betöltése sikertelen';

// A tabella a szezon összes csapatát adja (a konferenciák és a kiemelés miatt mind a
// 30 kell), ezért a második kulcsra nincs szükség.
const loadStandings = (seasonId: string) => fetchStandings(supabase, seasonId);

/**
 * A szezon tabellája. Csak a szezon a kulcs: a csapatváltás nem kérdez újra, a nézet
 * a betöltött sorokban emeli ki a csapatot.
 */
export function useStandings(seasonId: string | null): SeasonScopedResourceState<StandingRow[]> {
  // A közös betöltő mindig szezon + második kulcsot vár: a szezon azonosítója áll a
  // második helyen is, így a kulcs csak szezonváltáskor változik.
  return useSeasonScopedResource(seasonId, seasonId, loadStandings, ERROR_PREFIX);
}
