// Megosztott, egyszer betöltött erőforrás React-független tárolója.
// Akárhány komponens iratkozik fel, a betöltés egyszer fut le (T21); a hookok
// `useSyncExternalStore`-ral olvassák (hooks/useMasterData.ts).

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface SharedResource<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ResourceState<T>;
  getServerSnapshot: () => ResourceState<T>;
  reload: () => void;
}

export function createSharedResource<T>(load: () => Promise<T>, errorPrefix: string): SharedResource<T> {
  const initial: ResourceState<T> = { data: null, loading: true, error: null };
  const listeners = new Set<() => void>();
  let state = initial;
  let started = false;
  let requestId = 0;

  const setState = (next: ResourceState<T>) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const run = async () => {
    // Újratöltéskor a későn visszaérkező régi válasz nem írhatja felül az újat.
    const id = ++requestId;
    if (!state.loading) setState({ data: state.data, loading: true, error: null });
    try {
      const data = await load();
      if (id === requestId) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id !== requestId) return;
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
      console.error(`${errorPrefix}:`, err);
      setState({ data: null, loading: false, error: `${errorPrefix}: ${message}` });
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      // Csak az első feliratkozó indít betöltést. Hiba után nincs automatikus
      // újrapróbálás (egy fel-le mountolódó komponens végtelen kéréssort indítana):
      // a hibaállapot a `reload()` hívásáig marad.
      if (!started) {
        started = true;
        void run();
      }
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    reload: () => {
      started = true;
      void run();
    },
  };
}
