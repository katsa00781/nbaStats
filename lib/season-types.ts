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
