// ESPN dobás-koordináták → zóna, távolság és close/mid bontás.
//
// Koordináta-rendszer (valós meccs szöveges távolságaival ellenőrizve,
// átlagos eltérés < 1 láb): lábban mért félpálya, a kosár a (25, 0) pontban,
// x: 0–50 a pálya szélessége, y: távolság a kosártól az alapvonalra
// merőlegesen (a kosár mögötti dobásnál negatív).

import type { ShotZone } from '@/lib/supabase';
import type { EspnShotPlay } from '@/lib/espn/schemas';

const HOOP_X = 25;
/** Eddig számít „close” (közeli) kettesnek – az ASEStats close/mid bontásával egyező szerep. */
export const CLOSE_MAX_FT = 8;
const RIM_MAX_FT = 4;
/** Az NBA sarokhármas sávja: az alapvonaltól 14 lábig, a kosár ~5,25 lábra van az alapvonaltól. */
const CORNER_MAX_Y = 14 - 5.25;

export const shotDistanceFt = (x: number, y: number): number =>
  Math.round(Math.hypot(x - HOOP_X, y) * 10) / 10;

export function shotZone(shot: Pick<EspnShotPlay, 'x' | 'y' | 'pointsAttempted'>): ShotZone {
  if (shot.pointsAttempted === 3) return shot.y <= CORNER_MAX_Y ? 'corner3' : 'above_break3';
  const distance = shotDistanceFt(shot.x, shot.y);
  if (distance <= RIM_MAX_FT) return 'rim';
  if (distance <= CLOSE_MAX_FT) return 'paint';
  return 'mid';
}

export interface CloseMidSplit {
  closeMade: number;
  closeAttempted: number;
  midMade: number;
  midAttempted: number;
}

/** Játékosonkénti (ESPN athlete ID) close/mid kettes-bontás a dobás-eseményekből. */
export function closeMidByAthlete(shots: EspnShotPlay[]): Map<string, CloseMidSplit> {
  const result = new Map<string, CloseMidSplit>();
  for (const shot of shots) {
    if (shot.pointsAttempted !== 2 || !shot.espnAthleteId) continue;
    const split = result.get(shot.espnAthleteId) ?? { closeMade: 0, closeAttempted: 0, midMade: 0, midAttempted: 0 };
    const isClose = shotDistanceFt(shot.x, shot.y) <= CLOSE_MAX_FT;
    if (isClose) {
      split.closeAttempted++;
      if (shot.made) split.closeMade++;
    } else {
      split.midAttempted++;
      if (shot.made) split.midMade++;
    }
    result.set(shot.espnAthleteId, split);
  }
  return result;
}
