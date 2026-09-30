// NBA meccs-import az ESPN site API-ból (box score + dobás-események).
//
// Használat:
//   npx tsx ingest-games.ts --date 2025-03-01 --dry-run   # DB nélkül, csak validál és kiír
//   npx tsx ingest-games.ts --date 2025-03-01             # írás Supabase-be (service role)
//
// Csak a lezárt (final) alapszakasz / play-in / rájátszás meccseket dolgozza fel.
// A dátum amerikai keleti parti nap.
// Kilépési kód: 0 = rendben, 1 = legalább egy meccs elbukott, 2 = figyelmeztetés volt.

import * as dotenv from 'dotenv';
import { createNbaClient } from '@/lib/db-schema';
import { fetchScoreboard, fetchSummary } from '@/lib/espn/client';
import { parseScoreboard, parseSummary } from '@/lib/espn/schemas';
import { mapSummary, type StagedGame } from '@/lib/espn/map-boxscore';
import { assertInSeasonWindow, defaultSeasonWindow, isIngestedSeasonType } from '@/lib/espn/season-gate';
import { writeGame } from '@/lib/espn/write-game';

interface CliArgs {
  date: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const dateIndex = argv.indexOf('--date');
  const date = dateIndex >= 0 ? argv[dateIndex + 1] : undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('Használat: npx tsx ingest-games.ts --date YYYY-MM-DD [--dry-run]');
    process.exit(1);
  }
  return { date, dryRun: argv.includes('--dry-run') };
}

function createScriptClient() {
  dotenv.config({ path: '.env.local' });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Hiányzó env (.env.local): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  return createNbaClient(url, key, { persistSession: false });
}

function printSummary(staged: StagedGame): void {
  const { game, teams } = staged;
  const byId = new Map(teams.map(t => [t.espn_team_id, t.abbreviation]));
  const home = byId.get(game.homeEspnTeamId);
  const away = byId.get(game.awayEspnTeamId);
  const played = staged.playerLines.filter(p => !p.did_not_play);
  const zones = staged.shots.reduce<Record<string, number>>((acc, s) => {
    acc[s.zone] = (acc[s.zone] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n${game.game_date}  ${away} ${game.away_score} @ ${home} ${game.home_score}  [${game.status}, ${game.periods} negyed, ESPN ${game.espn_event_id}]`);
  console.log(`  játékos-sorok: ${staged.playerLines.length} (pályán: ${played.length}), csapat-sorok: ${staged.teamLines.length}, dobások: ${staged.shots.length}` +
    (staged.heavesExcluded > 0 ? ` (+${staged.heavesExcluded} kihagyott heave, nem FGA)` : ''));
  console.log(`  zónák: ${Object.entries(zones).map(([zone, n]) => `${zone}=${n}`).join(', ')}`);

  const top = [...played].sort((a, b) => b.points - a.points).slice(0, 3);
  for (const line of top) {
    const name = staged.players.find(p => p.espn_athlete_id === line.espnAthleteId)?.name ?? line.espnAthleteId;
    console.log(
      `  ${name.padEnd(24)} ${String(line.minutes).padStart(2)} perc  ${String(line.points).padStart(2)} pont  ` +
      `FG ${line.fgm}-${line.fga}  3P ${line.fg3m}-${line.fg3a}  FT ${line.ftm}-${line.fta}  ` +
      `close ${line.close_made}-${line.close_attempted}  mid ${line.mid_made}-${line.mid_attempted}  +/- ${line.plus_minus}`,
    );
  }
  for (const notice of staged.notices) console.log(`  ℹ ${notice}`);
  for (const warning of staged.warnings) console.warn(`  ⚠ ${warning}`);
}

async function main(): Promise<void> {
  const { date, dryRun } = parseArgs(process.argv.slice(2));
  const db = dryRun ? null : createScriptClient();

  const events = parseScoreboard(await fetchScoreboard(date.replaceAll('-', '')));
  const finals = events.filter(e => e.state === 'post' && e.completed);
  console.log(`${date}: ${events.length} meccs, ebből lezárt: ${finals.length}${dryRun ? ' (dry-run, nincs DB írás)' : ''}`);

  const failures: string[] = [];
  const warned: string[] = [];
  let skipped = 0;
  for (const event of finals) {
    try {
      const raw = await fetchSummary(event.id);
      const staged = mapSummary(parseSummary(raw));
      if (!isIngestedSeasonType(staged.game.season_type)) {
        skipped++;
        console.log(`\n  ℹ ${event.name} (${event.id}): szezontípus ${staged.game.season_type} (nem alapszakasz / play-in / rájátszás), kihagyva`);
        continue;
      }
      printSummary(staged);
      // Dry-runban nincs DB: a tág szezonablakot ellenőrizzük; élesben a writeGame
      // a nba.seasons pontos határaival (T4).
      if (!db) assertInSeasonWindow(staged.game.game_date, defaultSeasonWindow(staged.season.espn_year));
      if (db) {
        const result = await writeGame(db, staged, raw);
        console.log(`  ✓ mentve (game ${result.gameId})`);
      }
      for (const warning of staged.warnings) warned.push(`${event.name} (${event.id}): ${warning}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${event.name} (${event.id}): ${message}`);
      console.error(`  ✗ ${event.name} (${event.id}): ${message}`);
    }
  }

  // Összesítő (T6): az ütemezett futás ne legyen „zöld” hiba vagy figyelmeztetés mellett.
  const processed = finals.length - failures.length - skipped;
  console.log(`\nKész: ${processed}/${finals.length} meccs feldolgozva${skipped > 0 ? `, ${skipped} kihagyva (szezontípus)` : ''}.`);
  if (warned.length > 0) {
    console.warn(`Figyelmeztetés: ${warned.length}`);
    for (const line of warned) console.warn(`  ⚠ ${line}`);
  }
  if (failures.length > 0) {
    console.error(`Hiba: ${failures.length} meccs`);
    for (const line of failures) console.error(`  ✗ ${line}`);
  }
  // 1 = legalább egy meccs elbukott; 2 = minden meccs lefutott, de volt figyelmeztetés.
  if (failures.length > 0) process.exit(1);
  if (warned.length > 0) process.exit(2);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
