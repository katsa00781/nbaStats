# Backlog

Utolsó frissítés: 2026-09-30

Szerkezet:
1. Nyitott feladatok
2. Fejlesztési történet (időrendben, legújabb felül)
3. Tanulságok az ASEStatsből (T1–T30): ezeket egy terület fejlesztése előtt el kell olvasni

---

## 1. Nyitott feladatok

### Következő – Ingest teljesítése (roadmap 1.)

- [x] **Adatbázis-előkészítés (migráció 002):** gzip-elt nyers JSON, a 3 szezon határai, Lakers követett csapat.
- [x] **Áthelyezés az `nba` sémába** a közös `ugkettlebell` projektben: a 001 + 002 összevonása egy `nba.`-minősített migrációba (csak a 2026-os szezon), jogosultságok, `createNbaClient()`, `Database` típus. **Kézi futtatás + Exposed schemas beállítás hátravan.**
- [x] **ESPN ID nélküli játékos a box score-ban** (2026-03-01, MIL–CHI, ESPN `401810725`: `athletes[10]` „Olbrich”, `athlete` csak `shortName`-mel, COACH'S DECISION). Most a teljes meccs elbukik `EspnSchemaError`-ral. Döntés kell (névpárosítás tilos, T2): a sor kihagyása figyelmeztetéssel és a csapat-összeg ellenőrzése, vagy a meccs elutasítása. **Döntés:** statisztika nélkül kihagyjuk `ℹ` tájékoztatással, statisztikával továbbra is hiba
- [x] **Dobásszám ≠ FGA: a „Heave Jump Shot” nem számít FGA-nak** (2026-03-01: 5 meccsen csapatonként +1). Kivizsgálva a nyers JSON-on: játékosszinten minden eltérés pontosan egy `type.text = "Heave Jump Shot"` dobás (pl. Brunson 2. negyed 0.4, Wembanyama 3. negyed 0.3, MPJ 4. negyed 0.1); az ESPN box score FGA-ja ezeket nem tartalmazza. Döntés kell: a heave kimaradjon a `shot_events`-ből / a close-mid bontásból, vagy flaggel tároljuk, és az egyeztetés vonja le. A figyelmeztetést nem szabad elnémítani (T6, T19). **Döntés:** a kihagyott heave kimarad, a bedobott marad
- [x] **Dobás-deduplikálás a batch upsert előtt** a `(game_id, espn_play_id)` kulcsra, és ugyanígy a játékos-sorokra (T5)
- [x] **Konzisztencia-figyelmeztetésnél nem-nulla exit kód**, futás végi összesítővel, hogy az ütemezett futás ne legyen „zöld” adathiány mellett (T6)
- [x] **Szezon-kapu:** a `game_date` a `seasons.start_date`/`end_date` közé essen, ha be vannak állítva. Az ESPN `season.year` és a dátum összevetése (T4)
- [x] `ingest-games.ts --season <év>` visszatöltés (throttle 1 mp, kb. 25–30 perc/szezon), folytatható módon: a már `final` + nyers JSON-nal rendelkező meccset kihagyja. Scope: 2026 (2025/26); `season_type` 2, 3, 5 (előszezon nélkül)
- [x] **A visszatöltés utáni adatminőségi döntések** (2026-09-30, részletek a történetben):
  - All-Star meccsek (4) és álcsapatok (3) az alapszakaszban (ESPN `season.type = 2`);
  - NBA Cup döntő (`401809839`, NY–SA) a hivatalos alapszakasz-statisztikán kívül esik;
  - hosszú (> 60 láb) dobások a pályán-kívüli koordináta-szűrő miatt kiesnek (5 eset) – hiba;
  - Olbrich (CHI) ESPN-rekordja ID és statisztika nélküli, de 13 meccsen játszott (csapatösszeg-eltérés);
  - play-by-play ↔ box score ±1–3 dobás/FGA eltérés kb. 50 csapat-meccsen (kb. 2%), nem duplikáció, nem shooting foul
  - **Döntés (felhasználó):** All-Star kihagyás + törlés; a Cup-döntő marad; ±3-ig `ℹ`, fölötte `⚠`. A > 60 láb hibát javítottam; Olbrich marad `⚠` (a forrás hibás)
- [ ] `ingest-schedule.ts`: jövőbeli meccsek `scheduled` státusszal. **Kód kész; élesítés a migráció 002 kézi futtatása után.**
- [ ] `ingest-standings.ts`: konferencia- és divíziómezők kitöltése a `teams`-ben
- [ ] GitHub Actions napi cron (az ASEStats `scrape.yml` mintájára, Playwright nélkül, env-ellenőrző lépéssel) + `HOWTO-auto-import.md` (T7)

### Adatréteg és alapnézetek (roadmap 2.)

- [ ] Migráció 003: `player_season_stats_by_season` view, a `player-stat-mapping` kompatibilis alakjában. A meccsszámból a DNP-t kiszűri, a csapat a meccs-sorból jön (T8, T9)
- [ ] Közös törzsadat-hookok: `useSeasons()`, `useTeams()`, `useFollowedTeam()` (T21)
- [ ] `useGameData` / `usePlayerData` semleges hazai/vendég sémára, `fetchAllRows`-szal (T1, T20)
- [ ] Alapnézetek: Mérkőzések, Játékosok, Játékos-részletek, Csapatstatisztika, Tabella (DataTable / StatCard)
- [ ] Követett csapat választó (admin, `app_settings.followed_team_id`)

### Elemzés és AI (roadmap 3–5.)

- [ ] Elemző motorok portolása (B-lista, `context/megvalosithatosag.md`), az ASEStats H10/H12 döntéseivel együtt (T14–T18)
- [ ] `player-postgame`: 48 perces percküszöbök konstansba kiemelve; `situational-analysis`: hosszabbítás-bucket
- [ ] Migráció 004: AI riport táblák és RLS; a `generate-*` route-ok a követett csapatra paraméterezve, `requireAdmin()`-nal (T26)
- [ ] Dobástérkép NBA-geometriával (clamp, nem eldobás – T11), zóna heatmap
- [ ] Vercel deploy: `vercel.json` az ASEStats mintájára (T27)

### Később / ötletek

- [ ] Play-by-play tárolás: win probability, run-ok, clutch. Supabase tier-döntés kell hozzá.
- [x] **Tárhely-döntés a 2026/27-es szezon előtt.** Mérés: egy szezon kb. 130 MB, két szezon kb. 390 / 500 MB → **mindkét szezon marad**; 450 MB fölött a legrégebbi szezon nyers JSON-ja törlődik (döntés: 2026-09-30). A 2027/28-as szezon előtt újra dönteni kell (pl. saját szerver).
- [ ] Tárhely-figyelés: a napi futás írja ki a projekt méretét, és 450 MB fölött figyelmeztessen (a GitHub Actions cronnal együtt)
- [ ] GameScore / PIE a FIBA valuation mellé
- [ ] Élő meccsállapot (scoreboard polling)
- [ ] Tartalék adatforrás-adapter (balldontlie), ha az ESPN formátuma eltörik

### Eldöntött kérdések (2026-09-29, módosítva 2026-09-30)

- Tárhely (2026-09-30): a 2025/26 és a 2026/27 szezon is marad (kb. 390 / 500 MB); 450 MB fölött a legrégebbi szezon nyers JSON-ja törlődik.
- Adatbázis (2026-09-30): saját `nba` séma az ASEStats `ugkettlebell` Supabase projektjében. A harmadik projekt fizetős lenne; a közös `public` sémában 6 táblanév ütközik.
- Visszatöltés (2026-09-30): a 2025/26-os szezon, alapszakasz + play-in + rájátszás, előszezon nélkül. Régebbi szezon nem kerül be; a 2026/27 napi importtal épül.
- Követett csapat: Los Angeles Lakers (ESPN `13`).
- Nyers JSON: gzip `bytea`, hogy 3 szezon beleférjen a free tierbe.

### Ismert korlátok

- Az ESPN API nem hivatalos. Formátumváltáskor a `lib/espn/schemas.ts` pontos útvonallal hibát dob, a nyers JSON pedig az `espn_game_raw`-ból újra-parse-olható.
- A dobáskoordináta 1 láb felbontású.
- Ha az ESPN utólag töröl egy dobás-eseményt, az a `shot_events`-ben megmarad (upsert, törlés nincs).
- A play-by-play és a box score az ESPN-adatban kb. 2% csapat-meccsen ±1–3 dobással eltér; ezért kb. 0,3% játékossornál `close + mid ≠ FGA − 3PA`. Kísérletszámhoz a box score, zónaarányhoz a dobás-események a forrás.
- Olbrich (CHI) ESPN-rekordja ID és statisztika nélküli, de 12 meccsen játszott: ezeken a CHI játékossorainak összege kisebb a csapatsornál (a csapatsor helyes). Az ESPN javításáig ez `⚠`.
- Az NBA Cup döntője alapszakasz-meccsként bent van (NY, SA: 83 meccs).

---

## 2. Fejlesztési történet

### 2026-09-30 – Menetrend-import (`ingest-schedule.ts`)

- **Tárhely-döntés (felhasználó):** két szezon marad; `migrations/002-season-2027.sql` felveszi a 2026/27-es szezonsort (ESPN ablak: 2026-09-30 – 2027-06-25). Commit `8b4124e`.
- **Kód:** `fetchTeamSchedule()` (`client.ts`, `seasontype` paraméterrel – nélküle az ESPN csak az előszezont adja); `parseTeamSchedule()` (`schemas.ts`); `lib/espn/write-schedule.ts`: `stageSchedule()` (dedup az event ID-re, mert minden meccs két csapat menetrendjében szerepel; státusz; szezon-kapu) és `writeSchedule()` (500-as batch upsert; a `final` / `in_progress` sorokhoz nem nyúl); `requireSeason()` közös a `write-game.ts`-ben; `ingest-schedule.ts` + `npm run ingest:schedule`.
- **Ellenőrzés:** dry-run `--season 2027`: 1200 alapszakasz-meccs (2026-10-20 → 2027-04-11) = 30 × 80 / 2 – a csapatonkénti 2 NBA Cup-függő meccset az ESPN később teszi közzé; exit 0. `tsc`, `eslint` hibátlan.

### 2026-09-30 – Adatminőségi javítások a visszatöltés után ✓ (commit `ce438a3`)

- **Kód:** `isFranchiseTeam()` (ESPN ID 1–30) a `season-gate.ts`-ben, az ingest ez alapján hagyja ki az All-Start; `SHOT_FGA_TOLERANCE = 3` a `map-boxscore.ts`-ben; `isCourtCoordinate` y ≤ 95 (eddig 60) a `schemas.ts`-ben.
- **Újraparse a nyers JSON-ból** (mind az 1326 meccs, letöltés nélkül): 19 `⚠` marad, mind az Olbrich-féle CHI-meccsekről; 4 meccs dobásszáma +1.
- **Adatjavítás:** 4 All-Star meccs (cascade-del a soraik) és 3 álcsapat törölve; a 4 érintett nap (2025-10-27, 2025-11-17, 2026-01-17, 2026-03-18) újraimportálva, exit 0.
- **Ellenőrzés:** 30 csapat; 28 × 82 + 2 × 83 alapszakasz-meccs; 1231 + 85 + 6 = 1322 meccs; 234 884 dobás; árva játékos nincs; a 4 javított meccs dobásszáma +1. `tsc`, `eslint` hibátlan.
- **Tanulság:** a saját elemző szkriptben is előjött a T1 (1000 soros csonkolás) – ott is `fetchAllRows` kell.

### 2026-09-30 – 2025/26-os szezon visszatöltése ✓ (figyelmeztetésekkel)

- **Kód (`c62af9e`):** `ingest-games.ts --season <év> [--from] [--to]`; a napok a `nba.seasons` határai között (legfeljebb a mai napig); a már mentett meccs (van nyers JSON) kimarad; a scoreboard `season.type`-ja alapján az előszezonra summary sem megy; egy nap scoreboard-hibája nem állítja le a futást; egysoros kiírás.
- **Futás:** `--season 2026`, kb. 25 perc: 1311 új meccs (+ 15 korábban), 71 szezontípus miatt kihagyva, 0 hiba, 72 figyelmeztetés, exit 2.
- **DB:** 1326 meccs (alapszakasz 1235, rájátszás 85, play-in 6), 33 csapat, 591 játékos, 34 850 játékos-sor, 235 131 dobás; minden meccshez van nyers JSON. Az `nba` séma 130 MB, a projekt 259 MB / 500 MB.
- **Vizsgálat (nyers JSON-ból, letöltés nélkül):**
  - 1235 alapszakasz = 1230 + NBA Cup döntő (NY–SA 2025-12-16) + 4 All-Star meccs (2026-02-15, Team Stars / Team Stripes / World);
  - 12 játékos-FGA- és 7 pontösszeg-eltérés, mind Chicago: az ID nélküli Olbrich-sor csupa nullát mutat, de a csapatösszegből hiányzik (pl. 82 vs 91 pont) → az ESPN-rekord hibás, a játékos valójában játszott. A csapatsor helyes, a játékossora hiányzik;
  - dobás/FGA: 5 × > 60 láb távoli dobás (köztük 2 bedobott hármas) a `isCourtCoordinate` y ≤ 60 feltétele miatt kiesett (**hiba**); 1 dobó nélküli „No Shot (Default Shot)”; a többi ±1–3 a play-by-play és a box score eltérése (62 játékos-többlet, ebből 1 azonos szövegű ismétlés; shooting foul-lal egy sem magyarázható).

### 2026-09-30 – Szezon-kapu, dedup, exit kód (T4, T5, T6) ✓

- **`lib/espn/season-gate.ts` (új):** `isIngestedSeasonType()` (2, 3, 5), `assertInSeasonWindow()`, `defaultSeasonWindow()` a dry-runhoz, `SeasonGateError`.
- **`lib/espn/write-game.ts`:** az `ensureSeason` helyett `resolveSeason`: a szezonnak léteznie kell az `nba.seasons`-ben (nem hoz létre újat, mert egyszerre egy szezon fér a keretbe), és a `game_date` a határai közé esik. Írás előtt fut.
- **`lib/espn/map-boxscore.ts`:** `dedupeShots()`: azonos tartalmú ismétlés → `ℹ`, eltérő tartalom azonos play ID-val → `⚠`; duplikált játékossor → `⚠`, az első marad.
- **`ingest-games.ts`:** előszezon kihagyása `ℹ`-vel; dry-run szezonablak; összesítő a futás végén; exit 0 / 1 (hiba) / 2 (figyelmeztetés).
- **Ellenőrzés:**
  - célzott tesztek valódi summary-n: azonos dup → 145 dobás marad + `ℹ`; eltérő dup → `⚠`; duplikált játékossor → 26 sor + `⚠`; dátumablak 2025-09-15 / 2026-07-01 → hiba, 2026-03-01 → rendben;
  - éles 2026-03-01 → 11/11, exit 0; éles 2025-03-01 → 6/6 szezon-kapu hiba, exit 1, a DB változatlan (1 szezon, 11 meccs, 1909 dobás); dry-run 2025-10-05 → 2 előszezoni meccs kihagyva, exit 0;
  - `tsc`, `eslint` hibátlan.

### 2026-09-30 – Heave-dobás és ESPN ID nélküli játékos ✓

- **Döntés (felhasználó):** a heave-dobások kimaradnak; az ESPN ID és statisztika nélküli játékos sora kihagyható.
- **`lib/espn/map-shots.ts`:** `isMissedHeave()`: csak a *kihagyott* heave esik ki (a bedobott pontot ér, így FGM/FGA-része).
- **`lib/espn/map-boxscore.ts`:** a close/mid bontás, a dobásszám = FGA ellenőrzés és a `shots` csak az FGA-dobásokból; új `heavesExcluded` és `notices` mező.
- **`lib/espn/schemas.ts`:** az ID nélküli sor csak akkor esik ki (`skippedAthletes`), ha nincs statisztikája (üres, vagy minden érték 0 / `0-0` / `--`); statisztikával továbbra is `EspnSchemaError`.
- **`ingest-games.ts`:** kiírja a kihagyott heave-ek számát és az `ℹ` tájékoztatást.
- **Adatjavítás:** az első importból maradt 5 kihagyott heave törölve az `nba.shot_events`-ből (az upsert nem töröl).
- **Ellenőrzés:**
  - dry-run és éles import 2026-03-01: 11/11 meccs, figyelmeztetés nélkül, `ℹ` az Olbrich-sorra;
  - DB: 11 meccs, 287 játékos-sor, 1909 dobás; 22/22 csapatsor dobásszám = FGA; minden játékosnál close + mid = kétpontos kísérlet;
  - célzott teszt: statisztikával rendelkező ID nélküli sor → `EspnSchemaError`; bedobott heave megmarad;
  - `tsc`, `eslint` hibátlan.

### 2026-09-30 – Első éles import az `nba` sémába ✓

- A felhasználó lefuttatta a 001-et és kitette az `nba` sémát a Data API-ra. REST-ellenőrzés: `service_role` olvassa a `nba.seasons`-t (1 sor, 2026), `anon` → `42501`, az ASEStats `public.games` továbbra is 200.
- `npm run ingest:games -- --date 2026-03-01`: 10/11 meccs mentve (MIL–CHI: ESPN ID nélküli játékos). A második futás után a sorszám változatlan (10 meccs, 263 játékos-sor, 20 csapat-sor, 1735 dobás, 10 nyers JSON): idempotens.
- A nyers payload bináris gzip (`1f 8b`), 37–40 KB/meccs. A projekt 130 MB-on áll.
- 5 dobás/FGA figyelmeztetés: az ok a heave-dobás (új nyitott feladat).

### 2026-09-30 – Áthelyezés az `nba` sémába ✓

- **`migrations/001-initial-schema.sql`:** a korábbi 001 + 002 összevonva, minden objektum `nba.`-minősítve; csak a 2026-os szezon; Lakers követett csapat; jogosultságok (`authenticated`: SELECT, `service_role`: minden + szekvenciák, default privileges); RLS. A `002-raw-gzip-seasons-followed-team.sql` törölve (soha nem futott le sikeresen).
- **`lib/db-schema.ts`:** `DB_SCHEMA`, `createNbaClient()`, `NbaClient`. A `lib/supabase.ts`, a `lib/supabase-admin.ts` és az `ingest-games.ts` ezen át hoz létre klienst; a `write-game.ts` `NbaClient`-et kap. A `Database` típus kulcsa `public` → `nba`.
- **Ellenőrzés:**
  - PGlite (Postgres 17.5, csak a scratchpadben, a projektbe nem került): Supabase-szerű szerepkörök és ütköző `public.games` / `public.seasons` mellett a migráció kétszer lefutott; a `public` táblák érintetlenek; `authenticated` olvas, INSERT-je elutasítva; `anon` SELECT elutasítva; `service_role` ír, identity táblákba is;
  - `tsc`, `eslint`, `npm run build` hibátlan;
  - dry-run 2026-03-01: 10/11 meccs; a hibás egy meccs és egy dobás/FGA figyelmeztetés új nyitott feladat (a változtatástól független, a 2025/26-os adat hozta elő).

### 2026-09-30 – Döntés: `nba` séma a közös projektben, egy szezon

- **Hiba:** a 001 az SQL Editorban `42703: column "game_date" does not exist` hibát adott. Ok: a `.env.local` az ASEStats `ugkettlebell` projektjére mutat, ott már van `games` tábla (más oszlopokkal), így a `create table if not exists` kimaradt, és az első index elbukott. A tranzakció visszagördült; Supabase MCP-vel ellenőrizve, NBA-tábla nem maradt.
- **Felmérés** (csak olvasás): 2 aktív free projekt (`familyBudget` 19 MB, `ugkettlebell` 129 MB); a 9 NBA-táblából 6 névre létezik az ASEStats `public` sémájában.
- **Mérés:** 3 valódi summary (2026-03-01): nyersen 373–411 KB, gzip-pel 37–39 KB, 147–179 mezőnydobás. Egy szezon becslése kb. 130–170 MB.
- **Döntés (felhasználó):** `nba` séma az `ugkettlebell` projektben, csak a 2025/26-os szezon. A CLAUDE.md és a context fájlok frissítve.

### 2026-09-29 – Adatbázis-előkészítés a visszatöltéshez ✓

- **Mérés:** egy ESPN summary 368 KB (ebből a `plays` 243 KB), gzip-pel 38 KB. 3 szezon (kb. 3 950 meccs) jsonb-ben kb. 350–400 MB lenne, a dobásokkal (kb. 680e sor, kb. 150 MB) együtt túllépné a free tier 500 MB-ját.
- **`migrations/002-raw-gzip-seasons-followed-team.sql`:**
  - `espn_game_raw.payload` (jsonb) → `payload_gz` (bytea). Nem-üres táblán hibával megáll, nem veszít adatot;
  - a `seasons` 2024–2026 sorai az ESPN szezonablakával (`leagues[0].season`), a szezon-kapuhoz (T4);
  - `app_settings.followed_team_id` = Los Angeles Lakers, ESPN ID alapján (`13`).
- **`lib/espn/raw-payload.ts`:** `encodeRawPayload` / `decodeRawPayload` (node:zlib, bytea hex literál), új csomag nélkül. A `write-game.ts` ezzel ír; a `Database` típus frissítve.
- **Ellenőrzés:**
  - gzip round-trip egy valódi summary-n: azonos JSON, az újra-parse figyelmeztetés nélkül fut;
  - `tsc` és `lint` hibátlan, a `build` dummy Supabase env-vel is hibátlan (`.env.local` nélkül a HEAD is elbukik a prerendernél);
  - a SQL-t helyi Postgres hiányában nem futtattam.

### 2026-09-29 – Teljes szabályrendszer és ASEStats-tanulságok ✓

- **`CLAUDE.md`:** kiegészítve az ASEStats teljes szabályrendszerével, NBA-ra igazítva:
  - fejlesztési filozófia, döntési szabályok;
  - a Dark Command Center UI-szabályai (színek, tipográfia, komponensek, radius, glow, háttér, animációk);
  - styling-, state-, TypeScript-, API- és ESPN import szabályok, titkok, RBAC, kommunikáció, commit.
- **`BACKLOG.md`:** új szerkezet (feladatok / történet / tanulságok). Az ASEStats hotfix- és sprinttörténetéből 30 tanulság (T1–T30) került át.
- Az új teendők (T4, T5, T6) bekerültek a nyitott feladatok közé.

### 2026-09-29 – 0. fázis: projekt-alap + ESPN import PoC ✓ (commit `5eb3e37`)

- **Megvalósíthatósági vizsgálat:** `context/megvalosithatosag.md`.
  - Adatforrás: ESPN site API; a cdn.nba.com és a stats.nba.com Akamai-blokkolt.
  - A/B/C újrahasznosítási térkép az ASEStats kódjára.
- **Döntések (felhasználó):** hibrid fókusz (teljes liga + követett csapat), másolás + önálló fejlődés, magyar UI és AI, v1 = box score + dobástérkép.
- **Átvéve az ASEStatsből:**
  - `globals.css`, a font-setup, `components/ui/*`;
  - auth (`auth-context`, `api-auth`, `api-fetch`, `supabase-admin`), `ai-client`;
  - `stat-formulas`, `positions`, `terminology`, `style-vocabulary`, `chart-theme`, `fetch-all-rows`;
  - AppShell (`AppSidebar`, `AppTopbar`), `LoginForm`, `StatInfoTooltip`, `TerminologyGlossary`.
  - Branding: NBAStats. Az ORtg/DRtg tooltip csapatszintű per-100 definícióra átírva.
- **`migrations/001-initial-schema.sql`:** semleges hazai/vendég séma, ESPN-ID dedup kulcsok, `shot_events`, `espn_game_raw`, `app_settings`, RLS. **Kézi futtatás még hátravan.**
- **`lib/espn/*` + `ingest-games.ts`:**
  - Koordináta-rendszer meghatározva: láb, kosár a (25, 0) pontban, 144 szöveges távolság alapján 0,7 láb átlagos eltéréssel.
  - Ellenőrzés: 2025-03-01, 6/6 meccs dry-run. Figyelmeztetés nélkül egyezik a pontösszeg, az FGA-összeg és a dobásszám = FGA, és close + mid = kétpontos kísérlet.
  - `tsc`, `eslint` és `npm run build` tiszta.

---

## 3. Tanulságok az ASEStatsből

Forrás: az ASEStats `BACKLOG.md` hotfixei (H1–H12), javítási sprintje (2026-07-18) és ismert hibái.
- A zárójelben lévő hivatkozás az ASEStats-beli eredetet jelöli.
- Az **Állapot** azt mutatja, érvényesül-e már az NBAStatsben.

### Adat és import

| # | Mi történt az ASEStatsben | Szabály az NBAStatsben | Állapot |
|---|---|---|---|
| T1 | A PostgREST **némán 1000 sornál csonkol**. A liga-átlagok csonkolt adatból számolódtak (javítási sprint, 1. fázis) | 1000 sor fölött kötelező a `fetchAllRows()`. NBA-méretben ez szinte minden szezon-lekérdezés | Helper átvéve; a hookoknál kötelező |
| T2 | Név alapú párosítás miatt duplikált `teams` és `players` sorok, a névdrift („OSE Lions”) új csapatot hozott létre (H3, H7) | Csak ESPN-ID alapú upsert, DB-szintű UNIQUE kulccsal. Név alapján semmit nem hozunk létre és nem párosítunk | ✓ séma + `write-game.ts` |
| T3 | Az import félúton szállt el, félig megírt állapotot hagyva. A 0 kiolvasott sor „sikeres” futás volt (H3) | Minden ID-t írás előtt feloldunk; az üres vagy hibás forrás hiba, nem siker | Részben: az upsert idempotens, egy meccs újrafuttatása rendbe tesz. Az üres nap nem hiba (az NBA-ban van ilyen) |
| T4 | Rossz slug/szezon párosítás miatt 276 meccs rossz `season_id` alá került, a szezonátlagok két szezont kevertek (ismert hiba 6, H3 szezon-kapu) | A szezon az ESPN `header.season.year`-ből jön, és a dátumot a szezon határaihoz vetjük | ✓ `season-gate.ts` + `write-game.ts` |
| T5 | A forrás ugyanazt a dobást 2–3-szor küldte (309 elem, 125 egyedi), a teljes batch insert elbukott, a meccs dobástérképe elveszett (H9). A tabellát is duplán renderelte (H5) | Batch upsert előtt deduplikálunk a kulcsra, mert kulcsütközés esetén a teljes batch elbukik | ✓ dedup a `map-boxscore.ts`-ben |
| T6 | A dobástérkép-hiba csak `console.warn` volt, a GitHub Actions futás zöld maradt adatvesztés mellett (H9, nyitott) | Konzisztencia-figyelmeztetésnél nem-nulla exit és összesítő a futás végén | ✓ exit 2 + összesítő |
| T7 | Az importjavítás csak helyben volt commitolva, az Actions a régi `origin` kódot futtatta: `NULL` `opponent_team_id`, elveszett dobások (H11, H12) | Import-író változásnál a push is a lezárás része | Szabály a CLAUDE.md-ben |
| T8 | A 0 perces DNP sorok egyik import útvonalon megjelentek, a másikon nem, és torzították a meccsszámot (H5, legacy) | A DNP-t explicit `did_not_play` flaggel tároljuk; minden aggregáció kiszűri | ✓ séma; view-nál kötelező |
| T9 | A `players` (szezon, csapat, név) kulcsa nem tudta ábrázolni a szezon közbeni igazolást (legacy adattisztítás) | A csapat meccs-soronként a `player_game_stats.team_id`-ben van; a játékos-törzs csapatfüggetlen | ✓ séma |
| T10 | A corner-3 zóna feltétele fordítva volt (`x >= 25` helyett `x <= 14`), és a zónalogika több helyen volt másolva (javítási sprint, 1. fázis) | A zónadefiníció csak a `lib/espn/map-shots.ts`-ben él, és teszttel védjük | ✓ központosítva; teszt a roadmapban |
| T11 | A scatter chart a pályán kívüli dobásokat némán eldobta (javítási sprint, 1. fázis) | A pálya szélére szorítjuk (clamp), nem dobjuk el | Dobástérkép portolásakor |
| T12 | A százalékok egy része meccsenkénti százalékok átlagából jött | Csak összegzett dobásokból számolunk, `lib/stat-formulas.ts` | ✓ invariáns |

### Elemzés és riport

| # | Mi történt az ASEStatsben | Szabály az NBAStatsben | Állapot |
|---|---|---|---|
| T13 | Három különböző „rating” futott azonos néven (Hunbasket-féle egyéni, saját képletű szezon, csapat per-100), és a UI összekeverte őket (ismert hiba 2) | Egyértelmű metrikanevek. Az ORtg/DRtg kizárólag csapatszintű, 100 birtoklásra vetített érték | ✓ tooltip átírva |
| T14 | A tempó és a két rating eltérő birtoklásszámot használt, így az ASE DRtg ≠ a Pécs ORtg (H12, C1) | Közös birtoklásszám: `(saját + ellenfél) / 2` a tempóhoz és mindkét ratinghez. TO% = Oliver: `TOV / (FGA + 0,44·FTA + TOV)` | Portoláskor |
| T15 | Egymeccses szezonban a „szezonátlag” maga a meccs volt: minden delta 0, és a célok önmagukra mutattak (H10, H12 A) | 3 meccs alatt a liga-medián a referencia. A cél lépéskorlátos, és nem mutathat önmagára | Portoláskor |
| T16 | A fókuszszabályok pontos szövegegyezést kerestek számot tartalmazó sorokra, ezért soha nem aktiválódtak (H10) | A szabályok strukturált kulcson / `tone` / `source` mezőn illesztenek, nem megjelenített szövegen | Portoláskor |
| T17 | Egy táblában két OREB%-definíció szerepelt, az FT rate-ből FTA/FGA és FTM/FGA is előfordult (H12 A, C1) | Egy metrika, egy definíció. Az ASEStats döntése: FT-mutató = FTM/FGA a postgame-ben; eltérés csak rákérdezés után | Portoláskor |
| T18 | A „usage share” nem volt perc-normalizált, és torz rangsort adott (H12 C2) | Standard, perc-normalizált USG% (felső korlát 60%): alacsony ≤ 15%, magas ≥ 25% | Portoláskor |
| T19 | A dobástérkép és a box score FGA eltért, és a riport ezt nem jelezte (H12 D) | Már importkor ellenőrizzük (dobásszám = FGA); a riport „Adatminőség” blokkot kap | ✓ importkor |

### Kódszerkezet

| # | Mi történt az ASEStatsben | Szabály az NBAStatsben | Állapot |
|---|---|---|---|
| T20 | A `SeasonComparison.tsx` 18k sorra nőtt, 38 közvetlen DB-hívással; Babel 500KB warning, kockázatos minden módosítás. 16 komponens 125 közvetlen `supabase.from()` hívást tartalmazott | Komponensben nincs közvetlen Supabase-hívás, minden a `hooks/`-ban van. Nézetenként külön komponens, tabonként külön fájl | Az első hooktól kötelező |
| T21 | A `seasons` / `teams` törzsadatot 7 komponens kérte le külön-külön | Közös `useSeasons()` / `useTeams()` hook, `{ data, loading, error }` hármassal, `.skeleton-shimmer` töltésjelzéssel | Roadmap 2. |
| T22 | A TS% / eFG% / valuation képlet 6 helyen volt másolva (javítási sprint, 3. fázis) | A formula csak a `lib/stat-formulas.ts`-ben lehet | ✓ átvéve |

### UI

| # | Mi történt az ASEStatsben | Szabály az NBAStatsben | Állapot |
|---|---|---|---|
| T23 | A sidebar bevezetése után a széles táblák vízszintesen túlcsordultak, mert a grid-cella min-content szélességű (elemzések reszponzivitás) | A `.app-shell > main` és a `.grid > *` `min-width: 0` szabályát nem szabad kivenni | ✓ `globals.css` |
| T24 | Redesign után maradtak `slate-*` / `sky-*` / `violet-*` osztályok. 10 helyen hiányzott a szóköz két class között (`border-border-subtlebg-…`), így egyik sem hatott (token audit) | Csak tokenek; minden class-lista `cn()`-en át, szóközzel | Szabály |

### Auth és infrastruktúra

| # | Mi történt az ASEStatsben | Szabály az NBAStatsben | Állapot |
|---|---|---|---|
| T25 | A Fast Refresh több `GoTrueClient`-et hozott létre: „Invalid Refresh Token” (H1) | A Supabase kliens globalThis singleton; hibás session esetén `signOut({ scope: 'local' })` | ✓ átvéve |
| T26 | Olvasó felhasználó is tudott írni és generálni (RBAC sprint) | Minden írás admin-only: `requireAdmin()` + RLS, írás csak service role-lal | ✓ séma és guard átvéve |
| T27 | Vercel build: az npm cache a nem írható home könyvtárba ment (H6) | `vercel.json`: `npm install --cache /tmp/.npm …`, `NEXT_TELEMETRY_DISABLED=1 next build` | Deploykor |
| T28 | A Deno Edge Function importjai eltörték a `next build` típusellenőrzését (H4) | Ha lesz `supabase/functions/`, azt fel kell venni a `tsconfig.json` `exclude` listájába | Edge Function esetén |
| T29 | A spawn-alapú import route-ok serverlessben nem működtek (Vercel deploy) | Nincs spawn. Az import CLI / Actions, vagy a route közvetlenül a `lib/espn/*`-t hívja | ✓ architektúra |
| T30 | Gép-szintű függőség (Playwright böngésző-bináris) hiányzott, és az import „1 kóddal” állt le, ok nélkül (H2) | Nincs Playwright. Hibánál a teljes kimenet (stdout/stderr) mindig látszik a UI-ban és az Actions logban | ✓ nincs bináris-függőség |
| T31 | *(NBAStats, 2026-09-30)* Az ASEStatsből átvett `.env.local` az ASEStats projektjére mutatott; a `create table if not exists` az ott meglévő, más szerkezetű `games` táblán csendben kihagyott, és csak egy későbbi index bukott el | Közös projektben minden SQL sémával minősített (`nba.`). Migráció előtt ellenőrizni kell, melyik projektre mutat a `.env.local` | ✓ `nba` séma |
