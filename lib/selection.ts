// A szezon- és csapatválasztó alapértelmezései. Tiszta függvények: a tényleges
// kiválasztás a felhasználó választásából és a törzsadatból származtatott érték,
// nem külön szinkronizált state (hooks/useSeasonTeamSelection.ts).

import type { Season, Team } from '@/lib/master-data';

// Az alapértelmezett szezon a tesztelés idejére a 2025/26-os (döntés: 2026-10-10):
// a 2026/27-nek 2026-10-20-ig nincs lejátszott meccse. Utána felül kell vizsgálni.
export const DEFAULT_SEASON_ESPN_YEAR = 2026;

/** A választott szezon; választás nélkül az alapértelmezett, annak híján a legújabb. */
export function resolveSeason(seasons: Season[], chosenId: string | null): Season | null {
  return (
    seasons.find(s => s.id === chosenId) ??
    seasons.find(s => s.espn_year === DEFAULT_SEASON_ESPN_YEAR) ??
    seasons[0] ??
    null
  );
}

/** A választott csapat; választás nélkül a követett csapat, annak híján az első. */
export function resolveTeam(teams: Team[], chosenId: string | null, followedTeam: Team | null): Team | null {
  return teams.find(t => t.id === chosenId) ?? followedTeam ?? teams[0] ?? null;
}
