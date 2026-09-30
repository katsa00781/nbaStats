// NBA menetrend-import az ESPN site API-ból (jövőbeli meccsek `scheduled` státusszal).
//
// Használat:
//   npx tsx ingest-schedule.ts --season 2027 --dry-run   # DB nélkül, csak validál és kiír
//   npx tsx ingest-schedule.ts --season 2027             # írás Supabase-be (service role)
//
// A 30 csapat menetrendje szezontípusonként (alapszakasz, rájátszás, play-in):
// 90 kérés, kb. 1,5 perc. A lezárt / folyamatban lévő meccseket nem írja felül
// (azok az ingest-games dolga); az elhalasztott és törölt státuszt átveszi.
// Kilépési kód: 0 = rendben, 1 = hiba, 2 = figyelmeztetés volt.

import * as dotenv from 'dotenv';
import { createNbaClient, type NbaClient } from '@/lib/db-schema';
import { fetchTeamSchedule } from '@/lib/espn/client';
import { parseTeamSchedule, type EspnScheduleEvent } from '@/lib/espn/schemas';
import {
  defaultSeasonWindow,
  FRANCHISE_TEAM_IDS,
  INGESTED_SEASON_TYPES,
  isFranchiseTeam,
} from '@/lib/espn/season-gate';
import { requireSeason } from '@/lib/espn/write-game';
import { stageSchedule, writeSchedule } from '@/lib/espn/write-schedule';

const USAGE = 'Használat: npx tsx ingest-schedule.ts --season YYYY [--dry-run]';

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
  // Élesben a szezonnak léteznie kell (migráció); dry-runban a tág ablak.
  const window = db ? await requireSeason(db, seasonYear) : defaultSeasonWindow(seasonYear);

  const events: EspnScheduleEvent[] = [];
  const failures: string[] = [];
  for (const seasonType of INGESTED_SEASON_TYPES) {
    for (const teamId of FRANCHISE_TEAM_IDS) {
      try {
        const parsed = parseTeamSchedule(await fetchTeamSchedule(teamId, seasonYear, seasonType));
        // Az ESPN kérésre visszaadhat más szezont / típust is – csak a kértet tartjuk meg.
        events.push(...parsed.filter(e =>
          e.seasonYear === seasonYear && e.seasonType === seasonType &&
          isFranchiseTeam(e.homeEspnTeamId) && isFranchiseTeam(e.awayEspnTeamId)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`csapat ${teamId}, szezontípus ${seasonType}: ${message}`);
        console.error(`  ✗ csapat ${teamId}, szezontípus ${seasonType}: ${message}`);
      }
    }
  }

  const staged = stageSchedule(events, window);
  const byType = staged.games.reduce<Record<number, number>>((acc, g) => {
    acc[g.seasonType] = (acc[g.seasonType] ?? 0) + 1;
    return acc;
  }, {});
  const byStatus = staged.games.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = (acc[g.status] ?? 0) + 1;
    return acc;
  }, {});
  const dates = staged.games.map(g => g.gameDate).sort();
  console.log(`Szezon ${seasonYear}: ${staged.games.length} menetrendi meccs (${dates[0] ?? '–'} → ${dates.at(-1) ?? '–'})${dryRun ? ' (dry-run, nincs DB írás)' : ''}`);
  console.log(`  szezontípus: ${Object.entries(byType).map(([t, n]) => `${t}=${n}`).join(', ') || '–'}; státusz: ${Object.entries(byStatus).map(([s, n]) => `${s}=${n}`).join(', ') || '–'}`);
  if (staged.notStarted > 0) console.log(`  ℹ ${staged.notStarted} meccs már elkezdődött / lejátszva – az ingest-games írja`);

  if (db) {
    try {
      const result = await writeSchedule(db, seasonYear, staged);
      console.log(`  ✓ mentve: ${result.written}${result.keptOwned > 0 ? `, lezárt / folyamatban lévő (érintetlen): ${result.keptOwned}` : ''}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Összesítő (T6).
  if (staged.warnings.length > 0) {
    console.warn(`Figyelmeztetés: ${staged.warnings.length}`);
    for (const line of staged.warnings) console.warn(`  ⚠ ${line}`);
  }
  if (failures.length > 0) {
    console.error(`Hiba: ${failures.length}`);
    for (const line of failures) console.error(`  ✗ ${line}`);
    process.exit(1);
  }
  if (staged.warnings.length > 0) process.exit(2);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
