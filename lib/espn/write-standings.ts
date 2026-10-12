// A tabella (`nba.standings`) írása az ESPN konferencia-tabellájából, service
// role klienssel. Csapat × szezon pillanatkép: minden futás felülírja az előzőt
// (upsert a `(season_id, team_id)` kulcsra). Új szezont nem hoz létre (T4).

import type { NbaClient } from '@/lib/db-schema';
import type { EspnStandingsEntry } from '@/lib/espn/schemas';
import type { TableInsert } from '@/lib/supabase';
import { FRANCHISE_TEAM_IDS } from '@/lib/espn/season-gate';
import { requireSeason } from '@/lib/espn/write-game';

const TEAMS_PER_CONFERENCE = 15;

/** Szerkezeti ellenőrzés írás előtt: a 30 NBA-csapat egyszer, konferenciánként 15. Üres lista = rendben. */
export function checkStandings(entries: EspnStandingsEntry[], conferenceSizes: number[]): string[] {
  const errors: string[] = [];
  const ids = entries.map(e => e.espnTeamId);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  const missing = FRANCHISE_TEAM_IDS.filter(id => !ids.includes(id));
  const unknown = ids.filter(id => !FRANCHISE_TEAM_IDS.includes(id));
  if (duplicates.length > 0) errors.push(`többször szereplő csapat: ${[...new Set(duplicates)].join(', ')}`);
  if (missing.length > 0) errors.push(`hiányzó csapat: ${missing.join(', ')}`);
  if (unknown.length > 0) errors.push(`nem NBA-csapat: ${unknown.join(', ')}`);
  if (conferenceSizes.length !== 2) errors.push(`${conferenceSizes.length} konferencia (várt: 2)`);
  for (const size of conferenceSizes) {
    if (size !== TEAMS_PER_CONFERENCE) errors.push(`konferencia: ${size} csapat (várt: ${TEAMS_PER_CONFERENCE})`);
  }
  return errors;
}

/**
 * Visszaadja a kiírt sorok számát. Amíg a szezonnak nincs lezárt meccse a
 * `games`-ben, nem ír (0-t ad): az ESPN már a szezonkezdet előtt is mutathat
 * mérleget (előszezon), ami nem egyezne a mi adatunkkal.
 */
export async function writeStandings(db: NbaClient, seasonYear: number, entries: EspnStandingsEntry[]): Promise<number> {
  const season = await requireSeason(db, seasonYear);
  const { count, error: countError } = await db
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', season.id)
    .eq('status', 'final');
  if (countError) throw new Error(`games count: ${countError.message}`);
  if (!count) return 0;
  const { data, error } = await db
    .from('teams')
    .select('id, espn_team_id')
    .in('espn_team_id', entries.map(e => e.espnTeamId));
  if (error) throw new Error(`teams select: ${error.message}`);
  const teamIds = new Map((data as { id: string; espn_team_id: string }[]).map(t => [t.espn_team_id, t.id]));

  const now = new Date().toISOString();
  const rows: TableInsert<'standings'>[] = entries.map(e => {
    const teamId = teamIds.get(e.espnTeamId);
    if (!teamId) throw new Error(`Nincs a nba.teams-ben: ESPN ${e.espnTeamId}`);
    return {
      season_id: season.id,
      team_id: teamId,
      wins: e.wins,
      losses: e.losses,
      conference_seed: e.conferenceSeed,
      clincher: e.clincher,
      games_behind: e.gamesBehind,
      home_record: e.homeRecord,
      road_record: e.roadRecord,
      division_record: e.divisionRecord,
      conference_record: e.conferenceRecord,
      last_ten: e.lastTen,
      streak: e.streak,
      points_for: e.pointsFor,
      points_against: e.pointsAgainst,
      updated_at: now,
    };
  });
  const { error: upsertError } = await db.from('standings').upsert(rows, { onConflict: 'season_id,team_id' });
  if (upsertError) throw new Error(`standings upsert: ${upsertError.message}`);
  return rows.length;
}
