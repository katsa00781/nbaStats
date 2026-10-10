// A tárolt szezontípusok (`games.season_type`, ESPN-kód) megjelenítési sorrendje
// és magyar neve. Az alapszakasz, a play-in és a rájátszás statisztikája nem
// keveredik: a nézetek egyszerre egy szakaszt mutatnak.

export const REGULAR_SEASON = 2;
export const PLAYOFFS = 3;
export const PLAY_IN = 5;

/** Időrendben: alapszakasz → play-in → rájátszás. */
export const SEASON_TYPE_ORDER: readonly number[] = [REGULAR_SEASON, PLAY_IN, PLAYOFFS];

const SEASON_TYPE_LABELS: Record<number, string> = {
  [REGULAR_SEASON]: 'Alapszakasz',
  [PLAY_IN]: 'Play-in',
  [PLAYOFFS]: 'Rájátszás',
};

export const seasonTypeLabel = (seasonType: number): string =>
  SEASON_TYPE_LABELS[seasonType] ?? `Szakasz ${seasonType}`;

/** Az előforduló szezontípusok ismétlés nélkül, megjelenítési sorrendben; az ismeretlen kód a végére kerül. */
export function orderSeasonTypes(seasonTypes: Iterable<number>): number[] {
  const present = new Set(seasonTypes);
  const known = SEASON_TYPE_ORDER.filter(type => present.has(type));
  const unknown = [...present].filter(type => !SEASON_TYPE_ORDER.includes(type)).sort((a, b) => a - b);
  return [...known, ...unknown];
}

/**
 * A megjelenítendő szakasz: a választott, ha van benne adat; különben az
 * alapszakasz, annak híján az első elérhető. Üres listánál `null`.
 */
export function resolveSeasonType(available: readonly number[], chosen: number | null): number | null {
  if (chosen !== null && available.includes(chosen)) return chosen;
  if (available.includes(REGULAR_SEASON)) return REGULAR_SEASON;
  return available[0] ?? null;
}
