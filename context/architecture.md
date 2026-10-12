# Architecture Context

## Stack

Azonos az ASEStatsszel, **Playwright nélkül**:
- Next.js 16 (App Router) + React 19 + TypeScript 5 strict
- Tailwind CSS 4 (CSS-first, `@theme inline`) + shadcn/ui (New York) + Radix
- Supabase (PostgreSQL, Auth): saját `nba` séma az ASEStatsszel közös `ugkettlebell` projektben (lásd Storage Model)
- Chart.js / Recharts, Lucide, Sonner
- tsx a CLI-hez
- AI: OpenAI / Claude (`lib/ai-client.ts`)

## System Boundaries

- `app/`: App Router oldalak, API route-ok (mind `force-dynamic`), `globals.css`.
- `components/`: UI. A `components/ui/` shadcn-generált, kivéve a `stat-card.tsx` és a `data-table.tsx` fájlt.
- `hooks/`: adatlekérési hookok, `{ data, loading, error }` alakban. A komponens nem kérdez közvetlenül Supabase-t.
  - `useMasterData.ts`: `useSeasons()`, `useTeams()`, `useFollowedTeam()`. A törzsadat modul-szintű közös tárolóban él (`lib/shared-resource.ts`, `useSyncExternalStore`), így akárhány komponens hívja, egyszer töltődik be; a lekérdezések a `lib/master-data.ts`-ben vannak.
  - `useSeasonTeamSelection.ts`: a globálisan kiválasztott szezon és csapat. Csak a felhasználó választását tárolja, az alapértelmezés (`lib/selection.ts`: 2025/26-os szezon + követett csapat) származtatott érték. Egyszer, az `app/page.tsx` `AppShell` komponensében hívjuk; a nézetek propként kapják. Nincs perzisztencia és nincs URL-paraméter.
  - `useGameData.ts`: `useTeamGames(seasonId, teamId)`, a kiválasztott csapat meccsei a szezonban (`{ data, loading, error, reload }`). A lekérdezés és a nézőpont-leképezés a `lib/game-data.ts`-ben van (`fetchTeamGames()`, `toTeamGame()`: a semleges hazai/vendég sorból `isHome`, `opponentTeamId`, `teamScore`, `result`). Nem közös tároló: a nézet hívja, szezon- vagy csapatváltáskor újra lekérdez; a betöltés állapota a kérés kulcsából származik, a későn érkező régi válasz eldobódik.
  - `useSeasonScopedResource.ts`: a szezonra + csapatra szűrt adat közös betöltője (`{ data, loading, error, reload }`): a kérés kulcsából származtatott állapot, a későn érkező régi válasz eldobása, `null` szezonnal vagy csapattal nincs lekérdezés. A betöltő függvény legyen modul-szintű (stabil). Az új hookok erre épülnek; a `useTeamGames` még a saját, azonos logikájú megvalósítását használja.
  - `usePlayerData.ts`: `useTeamPlayerStats(seasonId, teamId)`, a kiválasztott csapat játékosainak szezon-összesítői a `player_season_stats_by_season` view-ból. A lekérdezés és a leképezés a `lib/player-data.ts`-ben van (`fetchTeamPlayerStats()`: `season_id` + `team_id` + a tárolt szakaszok, `fetchAllRows`-szal; `toPlayerSeasonStats()`: összegek → meccsenkénti átlag, százalék az összesített dobásokból, valuation a `simpleValuation()`-ből). A sorok szakaszonként külön maradnak.
  - `useBoxScoreData.ts`: `useGameBoxScore(seasonId, gameId)`, egy meccs box score-ja csapatonként; a `useSeasonScopedResource()`-ra épül (a második kulcs a meccs). A lekérdezés és a leképezés a `lib/box-score-data.ts`-ben van (`fetchGameBoxScore()`: `player_game_stats` a beágyazott `players` törzsadattal + `team_game_stats`, mindkettő `season_id` + `game_id` szűréssel, párhuzamosan; `toBoxScoreTeams()`: pályára lépett játékosok kezdők-elöl sorrendben, külön DNP-lista, csapatsor, `sumMismatches`). A csapatösszeg forrása a csapatsor; a játékossorok összegének eltérése (az eladott labda kivételével minden összegezhető mutatón) hiányos forrást jelez.
  - `usePlayerGameLogData.ts`: `usePlayerGameLog(seasonId, playerId)`, egy játékos meccsenkénti naplója a szezonban; a `useSeasonScopedResource()`-ra épül (a második kulcs a játékos). A lekérdezés és a leképezés a `lib/player-game-log-data.ts`-ben van (`fetchPlayerGameLog()`: `player_game_stats` a beágyazott `games` sorral, `season_id` + `player_id` szűréssel, legfeljebb kb. 110 sor; `toPlayerGameLog()`: csak lezárt meccsek, külön a pályára lépések és a DNP sorok, a meccs a játékos akkori csapatának nézőpontjából – `toTeamGame()` a sor `team_id`-jával). A csapatra és a szakaszra a nézet szűr.
  - `useSituationalData.ts`: `useTeamGameStatRows(seasonId, teamId)`, a csapat és ellenfelei meccsenkénti csapatsorai a szezonban (`lib/situational-data.ts`: `fetchTeamGameStatRows()`, `team_id` vagy `opponent_team_id` = a csapat, `fetchAllRows`-szal); a `useSeasonScopedResource()`-ra épül.
- `lib/adapters/`: adapterek az NBA sémáról az elemző motorok bemenetére. A motor (`lib/*-analysis.ts`) tiszta függvény, a sémát nem ismeri; az adapter a semleges hazai/vendég sorokat és a csapatsorokat a motor típusaira képezi. Első: `situational-adapter.ts` → `lib/situational-analysis.ts` (az ASEStats-motor portja, negyedenkénti bontás nélkül). Második: `player-analysis-adapter.ts` → `lib/player-analysis.ts` (poszt szerinti liga-benchmark szakaszonként, a játékos elemzése a kiválasztott csapatnál; az adat a `lib/league-player-data.ts` → `hooks/useLeaguePlayerData.ts`: a szezon összes játékosának összegei a `player_season_stats_by_season` view-ból).
- `components/SituationalView.tsx` (+ `SituationalTables.tsx`): a Szituációk nézet. Szakaszonként (`lib/season-types.ts`) külön számolja a `buildSituationalData()`-val; a `useTeamGames()` és a `useTeamGameStatRows()` adatából, az adapteren át. Supabase-t nem hív.
- `components/PlayerDetailsView.tsx` (+ `PlayerGameLogTable.tsx`): a Játékos-részletek. A `PlayersView` rendereli a lista helyén, a saját állapotában tartott játékos-azonosító alapján (nincs URL, nincs AppShell-szintű állapot); szezon- vagy csapatváltáskor a lista jön vissza. A fejléc és a szakasz átlagai a lista soraiból (`PlayerSeasonStats`) jönnek, a napló a hookból. Supabase-t nem hív.
- `components/GameDetailsView.tsx` (+ `BoxScoreTables.tsx`): a Meccs-részletek. A `GamesView` rendereli a lista helyén, a saját állapotában tartott meccs-azonosító alapján (nincs URL, nincs AppShell-szintű állapot); szezon- vagy csapatváltáskor a lista jön vissza. Supabase-t nem hív.
- `components/StandingsView.tsx` (+ `StandingsTable.tsx`): a Tabella nézet. Az `nba.standings` (ESPN-pillanatkép) konferenciánként, két fülön; a kiválasztott csapat kiemelve, a konferenciája nyílik meg elöl. A `useStandings(seasonId)` (`hooks/useStandingsData.ts`, `lib/standings-data.ts`) a `useSeasonScopedResource()`-ra épül, csak a szezon a kulcs (csapatváltáskor nincs új lekérdezés; legfeljebb 30 sor, nincs lapozás). A győzelmi arányt és a meccsenkénti pontot a `toStandingRow()` számolja; Supabase-t a nézet nem hív.
- `components/PlayersView.tsx` (+ `PlayersTable.tsx`): a Játékosok nézet. A kiválasztott csapat játékosai szakaszonként (`lib/season-types.ts`); Supabase-t nem hív.
- `components/GamesView.tsx` (+ `GamesTables.tsx`): a Mérkőzések nézet. Szakaszonként (`lib/season-types.ts`) külön mutatja a mérleget és a meccseket; Supabase-t nem hív.
- `app/page.tsx`: `Home` (auth guard) + `AppShell` (váz). A törzsadat-hookok csak az `AppShell`-ben és alatta futhatnak, mert az RLS bejelentkezés nélkül nem enged olvasni.
- `lib/`: megosztott logika és típusok, valamint elemző motorok (később, az ASEStatsből portolva).
- `lib/espn/`: ESPN adapter. Next.js-független, tiszta modulok:
  - `client.ts`: `fetch`, throttle ≥ 1 mp, retry 429/5xx-re;
  - `schemas.ts`: validálás `unknown` → típusos alak, `EspnSchemaError`;
  - `map-shots.ts`: koordináta → távolság / zóna / close-mid;
  - `map-boxscore.ts`: összefoglaló → „staged” sorok ESPN ID-kkel + konzisztencia-figyelmeztetések;
  - `season-gate.ts`: szezon-kapu (szezontípus + dátumablak, T4);
  - `write-game.ts`: upsert service role klienssel, ESPN ID → UUID feloldás; írás előtt a szezon-kapu (a szezonnak léteznie kell, `requireSeason()`);
  - `write-teams.ts`: konferencia/divízió az ESPN tabellájából (`standings?level=3`, `apis/v2` útvonal), írás előtt 2 × 3 × 5 szerkezeti ellenőrzéssel;
  - `write-schedule.ts`: menetrend-írás (`scheduled` / `postponed` / `canceled`); a lezárt és folyamatban lévő meccs az `ingest-games` hatásköre, ahhoz nem nyúl.
- Gyökér `ingest-*.ts`: CLI import szkriptek (dotenv `.env.local`), mindegyik `--dry-run` móddal.
- `.github/workflows/ingest.yml`: ütemezett napi futás (09:00 UTC) és kézi indítás. A CLI szkripteket hívja (`ingest:games --season`, majd `ingest:schedule`), saját import-logikája nincs. A Supabase-értékek repo secretből, a szezonév az `NBA_SEASON_YEAR` repo variable-ből jön. Leírás: `HOWTO-auto-import.md`.
- `migrations/`: SQL, **csak kézzel** futtatva a Supabase SQL Editorban.

## Storage Model

A séma a `migrations/` fájljaiban él (001: táblák, 002: a 2027-es szezonsor, 003: szezon-összesítő view), a TS-tükre a `lib/supabase.ts` `Database` típusa.

**Elhelyezés (döntés: 2026-09-30):**
- A free tier 2 projektes korlátja miatt nincs önálló projekt. Az NBAStats az ASEStats `ugkettlebell` projektjében él, **saját `nba` Postgres sémában**.
- A `public` sémában az ASEStats táblái vannak, 6 azonos névvel (`seasons`, `teams`, `players`, `games`, `player_game_stats`, `team_game_stats`). Ezért minden SQL `nba.`-minősített, és minden kliens `db: { schema: 'nba' }` beállítással jön létre.
- Az Auth (`auth.users`) közös: ugyanazok a felhasználók és ugyanaz az admin szerepkör.
- Tárhely: a 500 MB közös (ASEStats 129 MB, 2026-09-30). Egy NBA szezon mérten kb. 130 MB; két NBA szezon marad (2025/26 + 2026/27, döntés: 2026-09-30), kb. 390 / 500 MB a szezon végére. **Ha a projekt átlépi a 450 MB-ot, a legrégebbi szezon nyers JSON-ját (`espn_game_raw`, kb. 50 MB) töröljük.**

- `seasons`: `espn_year` UNIQUE, a szezon záró éve (2025 = 2024/2025).
- `teams`: `espn_team_id` UNIQUE. `players`: `espn_athlete_id` UNIQUE. A csapattagság meccsenként a `player_game_stats.team_id`-ben él, így a cserék is követhetők.
- `games`: `espn_event_id` UNIQUE.
  - Semleges hazai/vendég modell: `home_team_id`, `away_team_id`, `home_score`, `away_score`. **Nincs `our_team_id`.**
  - `game_date` = amerikai keleti parti helyi nap.
  - `season_type`: 1 előszezon, 2 alapszakasz, 3 rájátszás, 5 play-in.
- `player_game_stats`: UNIQUE `(game_id, player_id)`.
  - **Egyetlen tábla** `season_id`-val, nincs szezononkénti tábla-szétvágás.
  - Explicit `fgm/fga/fg3m/fg3a`.
  - A `close_*`/`mid_*` a dobás-eseményekből számolódik (≤ 8 láb = close).
- `team_game_stats`: UNIQUE `(game_id, team_id)`. A `tov` a csapatszintű eladott labdákat is tartalmazza, ez a possession-becsléshez kell.
- `shot_events`: UNIQUE `(game_id, espn_play_id)`.
  - Nyers koordináta lábban, a kosár a (25, 0) pontban.
  - A `distance_ft` és a `zone` (rim/paint/mid/corner3/above_break3) számított.
  - Büntető és kihagyott heave-dobás nem kerül ide (egyik sem FGA).
- `espn_game_raw`: a nyers summary JSON gzip-elt `bytea`-ként (`payload_gz`, kb. 38 KB/meccs), újra-parse-oláshoz. Kódolás/dekódolás: `lib/espn/raw-payload.ts`.
- `player_season_stats_by_season` (view, migráció 003): játékos szezon-összesítő.
  - Egy sor = játékos × szezon × `season_type` × csapat; a csapat a meccs-sorból jön, a cserélt játékosnak csapatonként külön sora van.
  - DNP nélkül, csak `final` meccsekből; `security_invoker = true`, így az alaptáblák RLS-e érvényes.
  - Kísérletszám: `total_fgm` / `total_fga` (box score). A `total_close_*` / `total_mid_*` a dobás-eseményekből jön, szezonszinten néhány dobással eltérhet.
  - Valuation nincs benne: az összegekből a `simpleValuation()` számolja.
  - Egy szezon kb. 1000 sor → `fetchAllRows` kötelező.
- `app_settings`: egysoros tábla, `followed_team_id` = követett csapat: **Los Angeles Lakers** (ESPN `13`).
- `seasons` start/end: a migráció tölti ki az ESPN szezonablakából (001: 2026, 002: 2027); ehhez veti a szezon-kapu a `game_date`-et. Az import szezont nem hoz létre.
- **RLS:** minden táblán SELECT a bejelentkezett felhasználóknak. Írni csak a service role tud.

## Data Flow

```
ESPN site API (scoreboard → summary)
   ↓ lib/espn/client.ts (throttle, retry)
   ↓ lib/espn/schemas.ts (validálás)
   ↓ lib/espn/map-boxscore.ts + map-shots.ts (staged sorok, konzisztencia-ellenőrzés)
   ↓ lib/espn/write-game.ts (upsert ESPN ID-kre)
Supabase (games, player_game_stats, team_game_stats, shot_events, espn_game_raw)
   ↓ hookok → lib/*-analysis (portolandó) → components → app/page.tsx
```

## Auth and Access Model

- Supabase email/jelszó. `AuthProvider` (`lib/auth-context.tsx`), a `page.tsx` root guard.
- Admin: `user_metadata.role === 'admin'`. Az API route-ok a `lib/api-auth.ts` `requireAdmin()` guardját használják, kliens oldalon az `authFetch()`-et.

## Invariants

1. Minden adat csak bejelentkezés után látható.
2. `components/ui/`: csak shadcn CLI-vel módosítható, kivéve a `stat-card` és a `data-table` fájlt.
3. A `migrations/*.sql` csak kézzel futtatható.
4. A lekérdezések `season_id` szerint szűrtek. 1000 sor fölött kötelező a `lib/fetch-all-rows.ts`.
5. Minden író ESPN-azonosítóra épülő kulcsra upsertel. Név alapján soha nem párosítunk entitást.
6. Az ESPN-választ csak a `lib/espn/schemas.ts` validálása után használjuk.
7. A kanonikus stat-formulák a `lib/stat-formulas.ts`-ben vannak. A százalékok összegzett dobásokból számolódnak.
8. TypeScript strict, `any` tilos.
9. Egyetlen böngészős Supabase kliens van (`lib/supabase.ts`). Szerveren a `getSupabaseAdmin()`, CLI-ben a szkript saját service role kliense fut. Mindegyik a `createNbaClient()`-tel készül (`lib/db-schema.ts`).
10. Az NBAStats csak az `nba` sémát írja és olvassa; a közös projekt `public` sémájához (ASEStats) nem nyúl.
