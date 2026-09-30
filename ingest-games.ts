// NBA meccs-import az ESPN site API-ból (box score + dobás-események).
//
// Használat:
//   npx tsx ingest-games.ts --date 2026-03-01 --dry-run   # DB nélkül, csak validál és kiír
//   npx tsx ingest-games.ts --date 2026-03-01             # egy nap írása Supabase-be (service role)
//   npx tsx ingest-games.ts --season 2026 [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--dry-run]
//                                                         # szezon-visszatöltés, folytatható
//
// Csak a lezárt (final) alapszakasz / play-in / rájátszás meccseket dolgozza fel.
// A dátum amerikai keleti parti nap. Szezon módban a napok a nba.seasons
// határai között futnak (legfeljebb a mai napig), és a már mentett meccseket
// (van nyers JSON-juk) kihagyja, így egy megszakadt futás egyszerűen újraindítható.
// Kilépési kód: 0 = rendben, 1 = legalább egy meccs elbukott, 2 = figyelmeztetés volt.

import * as dotenv from 'dotenv';
import { createNbaClient, type NbaClient } from '@/lib/db-schema';
import { fetchScoreboard, fetchSummary } from '@/lib/espn/client';
import { parseScoreboard, parseSummary, type EspnScoreboardEvent } from '@/lib/espn/schemas';
import { easternDate, mapSummary, type StagedGame } from '@/lib/espn/map-boxscore';
import {
  assertInSeasonWindow,
  defaultSeasonWindow,
  isFranchiseTeam,
  isIngestedSeasonType,
  type SeasonWindow,
} from '@/lib/espn/season-gate';
import { writeGame } from '@/lib/espn/write-game';
import { fetchAllRows } from '@/lib/fetch-all-rows';

type Mode =
  | { kind: 'date'; date: string }
  | { kind: 'season'; year: number; from: string | null; to: string | null };

interface CliArgs {
  mode: Mode;
  dryRun: boolean;
}

const USAGE =
  'Használat: npx tsx ingest-games.ts --date YYYY-MM-DD [--dry-run]\n' +
  '           npx tsx ingest-games.ts --season YYYY [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--dry-run]';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const dryRun = argv.includes('--dry-run');
  const date = argValue(argv, '--date');
  const season = argValue(argv, '--season');
  if (date !== undefined && season === undefined) {
    if (!DATE_RE.test(date)) fail(USAGE);
    return { mode: { kind: 'date', date }, dryRun };
  }
  if (season !== undefined && date === undefined) {
    const from = argValue(argv, '--from') ?? null;
    const to = argValue(argv, '--to') ?? null;
    if (!/^\d{4}$/.test(season) || (from !== null && !DATE_RE.test(from)) || (to !== null && !DATE_RE.test(to))) fail(USAGE);
    return { mode: { kind: 'season', year: Number(season), from, to }, dryRun };
  }
  return fail(USAGE);
}

function createScriptClient(): NbaClient {
  dotenv.config({ path: '.env.local' });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('Hiányzó env (.env.local): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  return createNbaClient(url, key, { persistSession: false });
}

function matchup(staged: StagedGame): string {
  const { game, teams } = staged;
  const byId = new Map(teams.map(t => [t.espn_team_id, t.abbreviation]));
  return `${byId.get(game.awayEspnTeamId)} ${game.away_score} @ ${byId.get(game.homeEspnTeamId)} ${game.home_score}`;
}

function printNotes(staged: StagedGame): void {
  for (const notice of staged.notices) console.log(`  ℹ ${notice}`);
  for (const warning of staged.warnings) console.warn(`  ⚠ ${warning}`);
}

/** Részletes kiírás (egynapos mód). */
function printSummary(staged: StagedGame): void {
  const { game } = staged;
  const played = staged.playerLines.filter(p => !p.did_not_play);
  const zones = staged.shots.reduce<Record<string, number>>((acc, s) => {
    acc[s.zone] = (acc[s.zone] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n${game.game_date}  ${matchup(staged)}  [${game.status}, ${game.periods} negyed, ESPN ${game.espn_event_id}]`);
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
  printNotes(staged);
}

/** Egysoros kiírás (szezon mód: kb. 1300 meccs). */
function printCompact(staged: StagedGame): void {
  const heaves = staged.heavesExcluded > 0 ? `, heave: ${staged.heavesExcluded}` : '';
  console.log(`  ${staged.game.espn_event_id}  ${matchup(staged)}  (dobás: ${staged.shots.length}${heaves})`);
  printNotes(staged);
}

interface RunContext {
  db: NbaClient | null;
  verbose: boolean;
  /** Már mentett meccsek ESPN event ID-i – szezon módban kihagyjuk őket. */
  stored: ReadonlySet<string>;
}

interface RunStats {
  processed: number;
  skippedType: number;
  skippedStored: number;
  failures: string[];
  warned: string[];
}

async function processEvent(event: EspnScoreboardEvent, ctx: RunContext, stats: RunStats): Promise<void> {
  try {
    const raw = await fetchSummary(event.id);
    const staged = mapSummary(parseSummary(raw));
    // A scoreboard szerint már szűrtünk; a summary a mérvadó, ha eltérne.
    if (!isIngestedSeasonType(staged.game.season_type)) {
      stats.skippedType++;
      console.log(`  ℹ ${event.name} (${event.id}): szezontípus ${staged.game.season_type}, kihagyva`);
      return;
    }
    if (!isFranchiseTeam(staged.game.homeEspnTeamId) || !isFranchiseTeam(staged.game.awayEspnTeamId)) {
      stats.skippedType++;
      console.log(`  ℹ ${event.name} (${event.id}): nem NBA-csapatok (All-Star), kihagyva`);
      return;
    }
    if (ctx.verbose) printSummary(staged);
    else printCompact(staged);
    // Dry-runban nincs DB: a tág szezonablakot ellenőrizzük; élesben a writeGame
    // a nba.seasons pontos határaival (T4).
    if (!ctx.db) assertInSeasonWindow(staged.game.game_date, defaultSeasonWindow(staged.season.espn_year));
    if (ctx.db) {
      const result = await writeGame(ctx.db, staged, raw);
      if (ctx.verbose) console.log(`  ✓ mentve (game ${result.gameId})`);
    }
    stats.processed++;
    for (const warning of staged.warnings) stats.warned.push(`${event.name} (${event.id}): ${warning}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.failures.push(`${event.name} (${event.id}): ${message}`);
    console.error(`  ✗ ${event.name} (${event.id}): ${message}`);
  }
}

async function processDate(date: string, ctx: RunContext, stats: RunStats): Promise<void> {
  const events = parseScoreboard(await fetchScoreboard(date.replaceAll('-', '')));
  const finals = events.filter(e => e.state === 'post' && e.completed);
  const todo: EspnScoreboardEvent[] = [];
  for (const event of finals) {
    if (!isIngestedSeasonType(event.seasonType)) stats.skippedType++;
    else if (ctx.stored.has(event.id)) stats.skippedStored++;
    else todo.push(event);
  }
  if (ctx.verbose || todo.length > 0) {
    console.log(`${ctx.verbose ? '' : '\n'}${date}: ${events.length} meccs, lezárt: ${finals.length}, feldolgozandó: ${todo.length}${ctx.db ? '' : ' (dry-run, nincs DB írás)'}`);
  }
  for (const event of todo) await processEvent(event, ctx, stats);
}

const nextDay = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** A szezon határai: élesben a nba.seasons sora (kötelező), dry-runban a tág ablak. */
async function loadSeason(db: NbaClient | null, year: number): Promise<{ id: string | null; window: SeasonWindow }> {
  if (!db) return { id: null, window: defaultSeasonWindow(year) };
  const { data, error } = await db
    .from('seasons')
    .select('id, espn_year, start_date, end_date')
    .eq('espn_year', year)
    .maybeSingle<SeasonWindow & { id: string }>();
  if (error) throw new Error(`seasons select: ${error.message}`);
  if (!data) fail(`A ${year}-es szezon nincs felvéve az nba.seasons-ben.`);
  const fallback = defaultSeasonWindow(year);
  return {
    id: data.id,
    window: { ...data, start_date: data.start_date ?? fallback.start_date, end_date: data.end_date ?? fallback.end_date },
  };
}

/** A szezon már mentett meccsei: amihez nyers JSON is van, az teljesen megíródott (az a writeGame utolsó lépése). */
async function loadStoredEvents(db: NbaClient, seasonId: string): Promise<Set<string>> {
  const rows = await fetchAllRows<{ espn_event_id: string }>((from, to) =>
    db
      .from('games')
      .select('espn_event_id, espn_game_raw!inner(espn_event_id)')
      .eq('season_id', seasonId)
      .order('espn_event_id')
      .range(from, to),
  );
  return new Set(rows.map(row => row.espn_event_id));
}

async function main(): Promise<void> {
  const { mode, dryRun } = parseArgs(process.argv.slice(2));
  const db = dryRun ? null : createScriptClient();
  const stats: RunStats = { processed: 0, skippedType: 0, skippedStored: 0, failures: [], warned: [] };

  if (mode.kind === 'date') {
    await processDate(mode.date, { db, verbose: true, stored: new Set() }, stats);
  } else {
    const season = await loadSeason(db, mode.year);
    const today = easternDate(new Date().toISOString());
    const from = mode.from ?? (season.window.start_date as string);
    const seasonEnd = mode.to ?? (season.window.end_date as string);
    const to = seasonEnd < today ? seasonEnd : today;
    const stored = db && season.id ? await loadStoredEvents(db, season.id) : new Set<string>();
    console.log(`Szezon ${mode.year}: ${from} → ${to}, már mentett meccs: ${stored.size}${dryRun ? ' (dry-run)' : ''}`);
    for (let date = from; date <= to; date = nextDay(date)) {
      try {
        await processDate(date, { db, verbose: false, stored }, stats);
      } catch (error) {
        // Egy nap scoreboard-hibája ne állítsa le a visszatöltést; újrafuttatással pótolható.
        const message = error instanceof Error ? error.message : String(error);
        stats.failures.push(`${date} scoreboard: ${message}`);
        console.error(`  ✗ ${date} scoreboard: ${message}`);
      }
    }
  }

  // Összesítő (T6): az ütemezett futás ne legyen „zöld” hiba vagy figyelmeztetés mellett.
  const skipped = [
    stats.skippedStored > 0 ? `${stats.skippedStored} már mentve` : '',
    stats.skippedType > 0 ? `${stats.skippedType} szezontípus / All-Star miatt kihagyva` : '',
  ].filter(Boolean).join(', ');
  console.log(`\nKész: ${stats.processed} meccs feldolgozva${skipped ? ` (${skipped})` : ''}, ${stats.failures.length} hiba.`);
  if (stats.warned.length > 0) {
    console.warn(`Figyelmeztetés: ${stats.warned.length}`);
    for (const line of stats.warned) console.warn(`  ⚠ ${line}`);
  }
  if (stats.failures.length > 0) {
    console.error(`Hiba: ${stats.failures.length}`);
    for (const line of stats.failures) console.error(`  ✗ ${line}`);
  }
  // 1 = legalább egy meccs (vagy nap) elbukott; 2 = minden lefutott, de volt figyelmeztetés.
  if (stats.failures.length > 0) process.exit(1);
  if (stats.warned.length > 0) process.exit(2);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
