// ESPN site API kliens (nem hivatalos, kulcs nélküli JSON végpontok).
// Udvarias tempó: kérések között min. 1 mp, 429/5xx esetén exponenciális
// visszalépés. A válasz `unknown` – a validálás a schemas.ts dolga.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 3;

let lastRequestAt = 0;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - elapsed);
  lastRequestAt = Date.now();
}

export class EspnHttpError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`ESPN HTTP ${status}: ${url}`);
    this.name = 'EspnHttpError';
  }
}

async function espnGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${ESPN_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  for (let attempt = 0; ; attempt++) {
    await throttle();
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) return response.json() as Promise<unknown>;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) throw new EspnHttpError(response.status, url.toString());
    await wait(2000 * 2 ** attempt);
  }
}

/** Egy nap meccsei. `date`: YYYYMMDD (amerikai keleti parti dátum). */
export const fetchScoreboard = (date: string) => espnGet('scoreboard', { dates: date });

/** Egy meccs teljes összefoglalója: box score, play-by-play, dobások. */
export const fetchSummary = (eventId: string) => espnGet('summary', { event: eventId });

/**
 * Egy csapat menetrendje egy szezonban és szezontípusban (ESPN szezonév = záró év).
 * A `seasontype` nélkül az ESPN csak az aktuális típust (pl. előszezon) adja.
 */
export const fetchTeamSchedule = (espnTeamId: string, seasonYear: number, seasonType: number) =>
  espnGet(`teams/${espnTeamId}/schedule`, { season: String(seasonYear), seasontype: String(seasonType) });
