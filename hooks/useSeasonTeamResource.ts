'use client';

import type { ResourceState } from '@/lib/shared-resource';
import { useCallback, useEffect, useState } from 'react';

export type SeasonTeamResourceState<T> = ResourceState<T> & { reload: () => void };

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Szezonra és csapatra szűrt adat betöltése (T20). Amíg nincs szezon vagy csapat
 * (a választó még tölt), nem indít lekérdezést, és `loading: false`, `data: null`
 * állapotot ad. Szezon- vagy csapatváltáskor a régi adat nem látszik tovább: a
 * betöltés állapota a kérés kulcsából származtatott érték, nem effectből
 * állított state. A `load` legyen stabil (modul-szintű) függvény, különben
 * minden renderelés új lekérdezést indít. Csak az auth guard mögött hívható (RLS).
 */
export function useSeasonTeamResource<T>(
  seasonId: string | null,
  teamId: string | null,
  load: (seasonId: string, teamId: string) => Promise<T>,
  errorPrefix: string,
): SeasonTeamResourceState<T> {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = seasonId && teamId ? `${seasonId}|${teamId}|${attempt}` : null;

  useEffect(() => {
    if (!seasonId || !teamId || !key) return;
    // Váltás után a későn visszaérkező régi válasz nem írhatja felül az újat.
    let cancelled = false;
    load(seasonId, teamId).then(
      data => {
        if (!cancelled) setLoaded({ key, data, error: null });
      },
      (err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
        console.error(`${errorPrefix}:`, err);
        setLoaded({ key, data: null, error: `${errorPrefix}: ${message}` });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [seasonId, teamId, key, load, errorPrefix]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const current = loaded?.key === key ? loaded : null;

  return {
    data: current?.data ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  };
}
