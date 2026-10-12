// A tabella az ESPN-ből: a csapatok konferencia- és divízió-besorolása, valamint
// a tabella pillanatképe (W-L, kiemelés, GB, mérlegek, sorozat).
//
// Használat:
//   npx tsx ingest-standings.ts --season 2027 --dry-run   # DB nélkül, csak validál és kiír
//   npx tsx ingest-standings.ts --season 2027             # nba.teams.conference / division + nba.standings
//
// Két kérés (level=3 a besoroláshoz, level=2 a tabellához). Írás előtt szerkezeti
// ellenőrzés: 30 NBA-csapat, 2 konferencia × 3 divízió × 5 csapat; eltérésnél
// semmit nem ír. A besorolásnál csak a változott sort frissíti, a tabella
// pillanatkép minden futáskor felülíródik. Napi futás: .github/workflows/ingest.yml.
// Kilépési kód: 0 = rendben, 1 = hiba.

import * as dotenv from 'dotenv';
import { createNbaClient, type NbaClient } from '@/lib/db-schema';
import { fetchConferenceStandings, fetchDivisionStandings } from '@/lib/espn/client';
import { parseConferenceStandings, parseDivisionStandings } from '@/lib/espn/schemas';
import { checkStandings, writeStandings } from '@/lib/espn/write-standings';
import { checkAlignment, writeTeamAlignment } from '@/lib/espn/write-teams';

const USAGE = 'Használat: npx tsx ingest-standings.ts --season YYYY [--dry-run]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): { seasonYear: number; dryRun: boolean } {
  const index = argv.indexOf('--season');
  const season = index >= 0 ? argv[index + 1] : undefined;
  if (!season || !/^\d{4}$/.test(season)) fail(USAGE);
  return { seasonYear: Number(season), dryRun: argv.includes('--dry-run') };
}

function createScriptClient(): NbaClient {
  dotenv.config({ path: '.env.local', quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('Hiányzó env (.env.local): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  return createNbaClient(url, key, { persistSession: false });
}

async function main(): Promise<void> {
  const { seasonYear, dryRun } = parseArgs(process.argv.slice(2));
  const db = dryRun ? null : createScriptClient();

  const alignments = parseDivisionStandings(await fetchDivisionStandings(seasonYear));
  const errors = checkAlignment(alignments);
  if (errors.length > 0) fail(`Szerkezeti hiba, nincs írás:\n${errors.map(e => `  ✗ ${e}`).join('\n')}`);

  const byDivision = new Map<string, string[]>();
  for (const a of alignments) {
    const key = `${a.conference} / ${a.division}`;
    byDivision.set(key, [...(byDivision.get(key) ?? []), a.espnTeamId]);
  }
  console.log(`Szezon ${seasonYear}: ${alignments.length} csapat, ${byDivision.size} divízió${dryRun ? ' (dry-run, nincs DB írás)' : ''}`);
  for (const [key, ids] of byDivision) console.log(`  ${key.padEnd(20)} ESPN ID: ${ids.join(', ')}`);

  const conferenceJson = await fetchConferenceStandings(seasonYear);
  const standings = parseConferenceStandings(conferenceJson);
  const conferenceSizes = [...new Set(alignments.map(a => a.conference))].map(
    conference => alignments.filter(a => a.conference === conference).length,
  );
  const standingsErrors = checkStandings(standings, conferenceSizes);
  if (standingsErrors.length > 0) {
    fail(`Tabella szerkezeti hiba, nincs írás:\n${standingsErrors.map(e => `  ✗ ${e}`).join('\n')}`);
  }
  const leader = [...standings].sort((a, b) => a.losses - b.losses || b.wins - a.wins)[0];
  console.log(`Tabella: ${standings.length} csapat; legjobb mérleg: ESPN ${leader.espnTeamId} (${leader.wins}–${leader.losses})`);

  if (db) {
    const changed = await writeTeamAlignment(db, alignments);
    console.log(`  ✓ besorolás mentve: ${changed} csapat változott (${alignments.length - changed} már naprakész)`);
    const written = await writeStandings(db, seasonYear, standings);
    console.log(`  ✓ tabella mentve: ${written} sor`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
