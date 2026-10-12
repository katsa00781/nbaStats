'use client';

import type { ResourceState } from '@/lib/shared-resource';
import { useCallback, useEffect, useState } from 'react';

export type SeasonScopedResourceState<T> = ResourceState<T> & { reload: () => void };

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Szezonra és egy második kulcsra (csapat, játékos vagy meccs azonosítója) szűrt
 * adat betöltése (T20). Amíg nincs szezon vagy kulcs (a választó még tölt), nem
 * indít lekérdezést, és `loading: false`, `data: null` állapotot ad. Szezon- vagy kulcsváltáskor a régi adat nem látszik tovább: a
 * betöltés állapota a kérés kulcsából származtatott érték, nem effectből
 * állított state. A `load` legyen stabil (modul-szintű) függvény, különben
 * minden renderelés új lekérdezést indít. Csak az auth guard mögött hívható (RLS).
 */
export function useSeasonScopedResource<T>(
  seasonId: string | null,
  scopeId: string | null,
  load: (seasonId: string, scopeId: string) => Promise<T>,
  errorPrefix: string,
): SeasonScopedResourceState<T> {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = seasonId && scopeId ? `${seasonId}|${scopeId}|${attempt}` : null;

  useEffect(() => {
    if (!seasonId || !scopeId || !key) return;
    // Váltás után a későn visszaérkező régi válasz nem írhatja felül az újat.
    let cancelled = false;
    load(seasonId, scopeId).then(
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
  }, [seasonId, scopeId, key, load, errorPrefix]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const current = loaded?.key === key ? loaded : null;

  return {
    data: current?.data ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  };
}
