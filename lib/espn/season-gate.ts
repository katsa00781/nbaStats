// Szezon-kapu (T4): egy meccs csak a saját szezonja alá kerülhet. Az ASEStatsben
// rossz szezon-párosítás miatt 276 meccs került rossz season_id alá, és a
// szezonátlagok két szezont kevertek. Tiszta függvények, DB nélkül.

/** A tárolt szezontípusok: 2 = alapszakasz, 3 = rájátszás, 5 = play-in (előszezon nélkül). */
const INGESTED_SEASON_TYPES: ReadonlySet<number> = new Set([2, 3, 5]);

export const isIngestedSeasonType = (seasonType: number): boolean => INGESTED_SEASON_TYPES.has(seasonType);

/**
 * A 30 NBA-csapat ESPN-azonosítója 1–30 (ellenőrizve: 2025/26). Az All-Star
 * meccseket az ESPN alapszakaszként (`season.type = 2`) jelöli, de álcsapatokkal
 * (pl. Team Stars 132374, World 111386) – ezeket e szerint szűrjük ki (döntés: 2026-09-30).
 */
export const isFranchiseTeam = (espnTeamId: string): boolean => /^([1-9]|[12][0-9]|30)$/.test(espnTeamId);

export interface SeasonWindow {
  espn_year: number;
  start_date: string | null;
  end_date: string | null;
}

export class SeasonGateError extends Error {
  constructor(message: string) {
    super(`Szezon-kapu: ${message}`);
    this.name = 'SeasonGateError';
  }
}

/**
 * Tág ablak DB nélkül (dry-run): az ESPN szezonév a záró év, az NBA-szezon
 * augusztus 1. és a következő július 31. közé esik.
 */
export const defaultSeasonWindow = (espnYear: number): SeasonWindow => ({
  espn_year: espnYear,
  start_date: `${espnYear - 1}-08-01`,
  end_date: `${espnYear}-07-31`,
});

/** A `gameDate` (YYYY-MM-DD, keleti parti nap) a szezon határain belül van, különben hiba. */
export function assertInSeasonWindow(gameDate: string, season: SeasonWindow): void {
  if (season.start_date && gameDate < season.start_date) {
    throw new SeasonGateError(`${gameDate} a ${season.espn_year}-es szezon kezdete (${season.start_date}) előtt van`);
  }
  if (season.end_date && gameDate > season.end_date) {
    throw new SeasonGateError(`${gameDate} a ${season.espn_year}-es szezon vége (${season.end_date}) után van`);
  }
}
