// A csapatok konferencia- és divízió-besorolása (`nba.teams.conference` /
// `division`) az ESPN tabellájából. Csak a meglévő 30 csapatot frissíti ESPN ID
// alapján; új csapatot nem hoz létre (azt a meccs-import teszi, teljes adattal).

import type { NbaClient } from '@/lib/db-schema';
import type { EspnTeamAlignment } from '@/lib/espn/schemas';
import { FRANCHISE_TEAM_IDS } from '@/lib/espn/season-gate';

const TEAMS_PER_DIVISION = 5;

/**
 * Szerkezeti ellenőrzés írás előtt: pontosan a 30 NBA-csapat, mindegyik egyszer,
 * 2 konferencia × 3 divízió × 5 csapat. Üres lista = rendben.
 */
export function checkAlignment(alignments: EspnTeamAlignment[]): string[] {
  const errors: string[] = [];
  const ids = alignments.map(a => a.espnTeamId);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  const missing = FRANCHISE_TEAM_IDS.filter(id => !ids.includes(id));
  const unknown = ids.filter(id => !FRANCHISE_TEAM_IDS.includes(id));
  if (duplicates.length > 0) errors.push(`többször szereplő csapat: ${[...new Set(duplicates)].join(', ')}`);
  if (missing.length > 0) errors.push(`hiányzó csapat: ${missing.join(', ')}`);
  if (unknown.length > 0) errors.push(`nem NBA-csapat: ${unknown.join(', ')}`);

  const divisions = new Map<string, number>();
  for (const a of alignments) {
    const key = `${a.conference} / ${a.division}`;
    divisions.set(key, (divisions.get(key) ?? 0) + 1);
  }
  const conferences = new Set(alignments.map(a => a.conference));
  if (conferences.size !== 2) errors.push(`${conferences.size} konferencia (várt: 2)`);
  if (divisions.size !== 6) errors.push(`${divisions.size} divízió (várt: 6)`);
  for (const [key, n] of divisions) {
    if (n !== TEAMS_PER_DIVISION) errors.push(`${key}: ${n} csapat (várt: ${TEAMS_PER_DIVISION})`);
  }
  return errors;
}

/** Visszaadja a ténylegesen megváltozott csapatok számát. */
export async function writeTeamAlignment(db: NbaClient, alignments: EspnTeamAlignment[]): Promise<number> {
  const { data, error } = await db
    .from('teams')
    .select('espn_team_id, conference, division')
    .in('espn_team_id', alignments.map(a => a.espnTeamId));
  if (error) throw new Error(`teams select: ${error.message}`);
  const current = new Map((data as { espn_team_id: string; conference: string | null; division: string | null }[])
    .map(t => [t.espn_team_id, t]));

  let changed = 0;
  const now = new Date().toISOString();
  for (const a of alignments) {
    const team = current.get(a.espnTeamId);
    if (!team) throw new Error(`Nincs a nba.teams-ben: ESPN ${a.espnTeamId}`);
    if (team.conference === a.conference && team.division === a.division) continue;
    const { error: updateError } = await db
      .from('teams')
      .update({ conference: a.conference, division: a.division, updated_at: now })
      .eq('espn_team_id', a.espnTeamId);
    if (updateError) throw new Error(`teams update (ESPN ${a.espnTeamId}): ${updateError.message}`);
    changed++;
  }
  return changed;
}
