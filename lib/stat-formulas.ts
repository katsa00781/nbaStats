// Kanonikus kosárlabda stat-formulák – az egyetlen hiteles definíció.
// A korábban 6 helyen (GameInput, useGameData, player-analysis, player-postgame,
// export-to-md) másolt TS% / eFG% / valuation képletek ide konszolidálódnak.
// Minden százalék 0–100 skálán tér vissza, kerekítés nélkül – a megjelenítési
// kerekítés a hívó dolga (vagy a formatPercent helperé).

/** Dobószázalék (FG%, 3P%, FT%): bedobott / kísérlet × 100 */
export const shootingPct = (made: number, attempted: number): number => {
  return attempted > 0 ? (made / attempted) * 100 : 0;
};

/** True Shooting %: pontok / (2 × (FGA + 0.44 × FTA)) × 100 */
export const trueShootingPct = (points: number, fga: number, fta: number): number => {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? (points / denom) * 100 : 0;
};

/** Effective FG%: (FGM + 0.5 × 3PM) / FGA × 100 */
export const effectiveFgPct = (fgm: number, threeMade: number, fga: number): number => {
  return fga > 0 ? ((fgm + 0.5 * threeMade) / fga) * 100 : 0;
};

/**
 * FIBA valuation (egyszerűsített, fault-adatok nélkül):
 * PTS + REB + AST + STL + BLK − kihagyott mezőny − kihagyott büntető − TOV.
 * Az NBA box score-ban nincs hivatalos VAL, ezért itt mindig ez a számolt érték
 * áll elő – az átvett elemző motorok (valPct, valPer36) erre épülnek.
 */
export const simpleValuation = (input: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgMade: number;
  fgAttempted: number;
  ftMade: number;
  ftAttempted: number;
  turnovers: number;
}): number => {
  return (
    input.points +
    input.rebounds +
    input.assists +
    input.steals +
    input.blocks -
    (input.fgAttempted - input.fgMade) -
    (input.ftAttempted - input.ftMade) -
    input.turnovers
  );
};

/** Egységes százalék-formázás: 1 tizedes + % jel; nem-véges értékre '-'. */
export const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}%`;
};

/** Birtoklás-becslés egy csapatra: FGA + 0,44 × FTA + TOV − OREB (nem lehet negatív). */
export const estimatePossessions = (input: {
  fga: number;
  fta: number;
  turnovers: number;
  offensiveRebounds: number;
}): number => {
  return Math.max(input.fga + 0.44 * input.fta + input.turnovers - input.offensiveRebounds, 0);
};

/** Pont 100 birtoklásra vetítve (ORtg / DRtg); birtoklás nélkül 0. */
export const ratingPer100 = (points: number, possessions: number): number => {
  return possessions > 0 ? (points / possessions) * 100 : 0;
};

/** Eladott labda % (Oliver): TOV / (FGA + 0,44 × FTA + TOV) × 100 */
export const turnoverPct = (turnovers: number, fga: number, fta: number): number => {
  const denom = fga + 0.44 * fta + turnovers;
  return denom > 0 ? (turnovers / denom) * 100 : 0;
};

/** Támadó lepattanó %: OREB / (OREB + az ellenfél DREB-je) × 100 */
export const offensiveReboundPct = (oreb: number, opponentDreb: number): number => {
  const denom = oreb + opponentDreb;
  return denom > 0 ? (oreb / denom) * 100 : 0;
};

/** Büntetődobás-mutató (az ASEStats döntése, T17): FTM / FGA */
export const freeThrowRate = (ftm: number, fga: number): number => {
  return fga > 0 ? ftm / fga : 0;
};
