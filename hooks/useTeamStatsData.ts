'use client';

import type { SeasonTeamResourceState } from '@/hooks/useSeasonTeamResource';
import type { LeagueTeamStats } from '@/lib/team-stats-data';
import { useSeasonTeamResource } from '@/hooks/useSeasonTeamResource';
import { supabase } from '@/lib/supabase';
import { fetchLeagueTeamStats } from '@/lib/team-stats-data';

const ERROR_PREFIX = 'A csapatstatisztika betöltése sikertelen';

// A lekérdezés a szezon összes csapatát adja (a ligarangsorhoz mind a 30 kell),
// ezért a második kulcsra nincs szükség.
const loadLeagueTeamStats = (seasonId: string) => fetchLeagueTeamStats(supabase, seasonId);

/**
 * A 30 csapat szezon-összesítői szakaszonként. Csak a szezon a kulcs: a csapatváltás
 * nem kérdez újra, a nézet a betöltött ligaadatból választja ki a csapatot.
 */
export function useLeagueTeamStats(seasonId: string | null): SeasonTeamResourceState<LeagueTeamStats> {
  // A közös betöltő mindig szezon + csapat kulcsot vár: a szezon azonosítója áll a
  // második helyen is, így a kulcs csak szezonváltáskor változik.
  return useSeasonTeamResource(seasonId, seasonId, loadLeagueTeamStats, ERROR_PREFIX);
}
