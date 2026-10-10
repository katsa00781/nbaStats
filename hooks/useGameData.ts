'use client';

import type { TeamGame } from '@/lib/game-data';
import type { ResourceState } from '@/lib/shared-resource';
import { fetchTeamGames } from '@/lib/game-data';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

const ERROR_PREFIX = 'A mérkőzések betöltése sikertelen';

export type TeamGamesState = ResourceState<TeamGame[]> & { reload: () => void };

interface LoadedGames {
  key: string;
  data: TeamGame[] | null;
  error: string | null;
}

/**
 * A kiválasztott csapat meccsei a kiválasztott szezonban, időrendben (T20).
 * Amíg nincs szezon vagy csapat (a választó még tölt), nem indít lekérdezést,
 * és `loading: false`, `data: null` állapotot ad. Szezon- vagy csapatváltáskor
 * a régi adat nem látszik tovább: a betöltés állapota a kérés kulcsából
 * származtatott érték, nem effectből állított state. Csak az auth guard mögött
 * hívható (RLS).
 */
export function useTeamGames(seasonId: string | null, teamId: string | null): TeamGamesState {
  const [loaded, setLoaded] = useState<LoadedGames | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = seasonId && teamId ? `${seasonId}|${teamId}|${attempt}` : null;

  useEffect(() => {
    if (!seasonId || !teamId || !key) return;
    // Váltás után a későn visszaérkező régi válasz nem írhatja felül az újat.
    let cancelled = false;
    fetchTeamGames(supabase, seasonId, teamId).then(
      data => {
        if (!cancelled) setLoaded({ key, data, error: null });
      },
      (err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
        console.error(`${ERROR_PREFIX}:`, err);
        setLoaded({ key, data: null, error: `${ERROR_PREFIX}: ${message}` });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [seasonId, teamId, key]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const current = loaded?.key === key ? loaded : null;

  return {
    data: current?.data ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  };
}
