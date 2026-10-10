'use client';

import type { Season, Team } from '@/lib/master-data';
import type { ResourceState, SharedResource } from '@/lib/shared-resource';
import { fetchAppSettings, fetchSeasons, fetchTeams } from '@/lib/master-data';
import { createSharedResource } from '@/lib/shared-resource';
import { supabase } from '@/lib/supabase';
import { useMemo, useSyncExternalStore } from 'react';

// A törzsadat modul-szinten, egyszer töltődik be: a hookokat akárhány komponens
// hívhatja, külön lekérdezés nélkül (T21). Csak az auth guard mögött használhatók,
// mert az RLS bejelentkezés nélkül nem enged olvasni.
const seasonsResource = createSharedResource(() => fetchSeasons(supabase), 'A szezonok betöltése sikertelen');
const teamsResource = createSharedResource(() => fetchTeams(supabase), 'A csapatok betöltése sikertelen');
const settingsResource = createSharedResource(() => fetchAppSettings(supabase), 'A beállítások betöltése sikertelen');

export type MasterData<T> = ResourceState<T> & { reload: () => void };

function useSharedResource<T>(resource: SharedResource<T>): ResourceState<T> {
  return useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
}

const reloadFollowedTeam = () => {
  settingsResource.reload();
  teamsResource.reload();
};

/** Szezonok, a legújabb elöl. */
export function useSeasons(): MasterData<Season[]> {
  const state = useSharedResource(seasonsResource);
  return { ...state, reload: seasonsResource.reload };
}

/** A csapatok név szerint. */
export function useTeams(): MasterData<Team[]> {
  const state = useSharedResource(teamsResource);
  return { ...state, reload: teamsResource.reload };
}

/** A követett csapat (`app_settings.followed_team_id`); `data: null`, ha nincs beállítva. */
export function useFollowedTeam(): MasterData<Team> {
  const teams = useSharedResource(teamsResource);
  const settings = useSharedResource(settingsResource);

  const state = useMemo<ResourceState<Team>>(() => {
    const error = settings.error ?? teams.error;
    if (error) return { data: null, loading: false, error };
    if (settings.loading || teams.loading) return { data: null, loading: true, error: null };
    const followedTeamId = settings.data?.followed_team_id ?? null;
    const team = teams.data?.find(t => t.id === followedTeamId) ?? null;
    return { data: team, loading: false, error: null };
  }, [teams, settings]);

  return { ...state, reload: reloadFollowedTeam };
}
