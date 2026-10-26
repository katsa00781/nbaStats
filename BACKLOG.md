# Backlog

Utolsó frissítés: 2026-10-26

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
- [x] `ingest-schedule.ts`: jövőbeli meccsek `scheduled` státusszal (élesítve 2026-09-30: 1200 meccs a 2026/27-re)
- [ ] A csapatonkénti 2 NBA Cup-függő alapszakasz-meccs (30 meccs) felvétele, amikor az ESPN közzéteszi – a napi `ingest-schedule` futás ezt magától elvégzi (a cronban benne van, 2026-10-01); ellenőrizni kell, hogy a szezon végére csapatonként 82 meccs lett
- [x] `ingest-standings.ts`: konferencia- és divíziómezők kitöltése a `teams`-ben (2026-09-30)
- [x] Döntés a Tabella nézet előtt: a győzelem–vereség a `games`-ből számolható, de a hivatalos kiemelés (seed), GB, sorozat és clinch jelzés csak az ESPN tabellában van. **Döntés (felhasználó, 2026-10-10): kell külön tabella-tábla**
- [ ] Tabella-tábla: új migráció (a séma tervét a megírás előtt egyeztetni kell) + az `ingest-standings.ts` bővítése a tabella-sorok írásával. A Tabella nézet előfeltétele
- [x] GitHub Actions napi cron (az ASEStats `scrape.yml` mintájára, Playwright nélkül, env-ellenőrző lépéssel) + `HOWTO-auto-import.md` (T7) – megírva 2026-10-01
- [ ] **Az ütemezett import élesítése (felhasználó):** két repo secret (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), push, első kézi futás `dry_run`-nal. Az első GitHub-futás igazolja, hogy az ESPN a runner IP-címéről is elérhető (helyből nem ellenőrizhető)

### Adatréteg és alapnézetek (roadmap 2.)

- [x] Migráció 003: `player_season_stats_by_season` view, a `player-stat-mapping` kompatibilis alakjában. A meccsszámból a DNP-t kiszűri, a csapat a meccs-sorból jön (T8, T9) – megírva 2026-10-10
- [x] **A 003 futtatása (felhasználó):** `migrations/003-player-season-stats-view.sql` a Supabase SQL Editorban (`ugkettlebell`) – kész, ellenőrizve 2026-10-10
- [x] Közös törzsadat-hookok: `useSeasons()`, `useTeams()`, `useFollowedTeam()` (T21) – `hooks/useMasterData.ts` (2026-10-10)
- [x] Szezon- és csapatválasztó az AppShellben (a törzsadat-hookok első fogyasztója). Alapértelmezés: a 2025/26-os szezon (döntés: 2026-10-10, a tesztelés idejére) és a követett csapat – `SeasonTeamSelector` + `useSeasonTeamSelection()` (2026-10-10)
- [ ] **A választó ellenőrzése böngészőben, bejelentkezve (felhasználó):** `npm run dev` → a topbar alatt 2025/2026 + Los Angeles Lakers (csillaggal), 30 csapat a listában, a konzol hibamentes
- [x] `useGameData`: `useTeamGames(seasonId, teamId)` a semleges hazai/vendég sémára (T20) – `hooks/useGameData.ts` + `lib/game-data.ts` (2026-10-10)
- [x] Alapnézet: **Mérkőzések** (`GamesView`, DataTable + StatCard) – 2026-10-10
- [ ] **A Mérkőzések nézet ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Liga → Mérkőzések* → 2025/2026 + Lakers: 53–29, 82 sor logókkal; 2026/2027: 5 kiírt meccs + „Összes megjelenítése”
- [x] `usePlayerData`: `useTeamPlayerStats(seasonId, teamId)` a `player_season_stats_by_season` view-ra, `fetchAllRows`-szal (T1, T20) – `hooks/usePlayerData.ts` + `lib/player-data.ts` (2026-10-10)
- [x] Alapnézet: **Játékosok** (`PlayersView`, DataTable) – a kiválasztott csapat játékosai szakaszonként (2026-10-10)
- [ ] **A Játékosok nézet ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Játékosok* → 2025/2026 + Lakers: 20 játékos, legfelül Luka Doncic (33.5 PTS); Rájátszás: 14 játékos; 2026/2027: üres állapot
- [x] `useGameBoxScore(seasonId, gameId)` a `player_game_stats` + `team_game_stats` táblára (T8, T19, T20) – `hooks/useBoxScoreData.ts` + `lib/box-score-data.ts` (2026-10-10)
- [x] Alapnézet: **Meccs-részletek** (`GameDetailsView`, box score) – a Mérkőzések listából nyílik, a nézet saját állapotával (döntés: 2026-10-10)
- [ ] **A Meccs-részletek ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Liga → Mérkőzések* → Rájátszás → 2026. 05. 11. „Box score”: Lakers 110–115 Thunder, 10 Lakers-játékos, legfelül Austin Reaves; Bulls 2026. 02. 01.: figyelmeztetés (PTS 82/91)
- [x] `usePlayerGameLog(seasonId, playerId)` a `player_game_stats` táblára, beágyazott meccs-sorral (T8, T9, T20) – `hooks/usePlayerGameLogData.ts` + `lib/player-game-log-data.ts` (2026-10-10)
- [x] Alapnézet: **Játékos-részletek** (`PlayerDetailsView`, meccsenkénti napló) – a Játékosok tábla nevéből nyílik, a nézet saját állapotával (2026-10-10)
- [ ] **A Játékos-részletek ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Játékosok* → „Luka Doncic”: kártyák 64 / 33.5 / 7.7 / 8.3, 64 sor, legfelül 2026. 04. 02. (OKC, 96–139); LeBron James: Alapszakasz 60 / Rájátszás 10 sor
- [x] `useLeagueTeamStats(seasonId)` a `team_game_stats` táblára (mind a 30 csapat, mindkét oldal), `fetchAllRows`-szal (T1, T14, T17, T20) – `hooks/useTeamStatsData.ts` + `lib/team-stats-data.ts` + `lib/team-stats-metrics.ts` (2026-10-12)
- [x] Alapnézet: **Csapatstatisztika** (`TeamStatsView`, átlagok + fejlett mutatók + ligarangsor) – 2026-10-12
- [ ] **A Csapatstatisztika ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Csapatstatisztika* → 2025/2026 + Lakers: Pont / meccs 116.3 (11. / 30), ORtg 115.4 (8. / 30), DRtg 113.7 (19. / 30); Rájátszás fül: helyezés „x. / 16"; csapatváltás nem tölt újra
- [x] Migráció 004: `nba.standings` + `Database` típus – megírva 2026-10-12
- [x] **A 004 futtatása (felhasználó):** kész 2026-10-12
- [x] `ingest-standings.ts` bővítése: a tabella írása az `nba.standings`-be (`level=2`, szerkezeti ellenőrzés, `--dry-run`) + `ingest:standings` a napi `ingest.yml`-be – 2026-10-12 (a workflow-hoz push kell, T7)
- [x] `useStandings(seasonId)` az `nba.standings` táblára (≤ 30 sor, T20) – `hooks/useStandingsData.ts` + `lib/standings-data.ts` (2026-10-12)
- [x] Alapnézet: **Tabella** (`StandingsView` + `StandingsTable`, konferencia-fülök, a kiválasztott csapat kiemelve) – 2026-10-12
- [ ] **A Tabella ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Liga → Tabella* → 2025/2026 + Lakers: Nyugat fül, 15 sor, OKC 64–18 (`*`) elöl, Lakers #4 (`y`, .646, GB 11, L10 7-3, GY3) kiemelve; Kelet: Detroit 60–22 (`z`); 2026/2027: üres állapot
- [x] Elemző motor 1/4: **situational-analysis** portolva (`lib/situational-analysis.ts`) + adapter (`lib/adapters/situational-adapter.ts`) + `useTeamGameStatRows` + **Szituációk** nézet (`SituationalView`) – 2026-10-12
- [ ] **A Szituációk ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Szituációk* → 2025/2026 + Lakers: Hazai 28–13, Vendég 25–16, Szoros 11–4, Gála 16–16; ORtg 115.4; Rájátszás fül: 10 meccs, ORtg 105.8
- [x] Elemző motor 2/4: **player-analysis** portolva (`lib/player-analysis.ts`) + adapter (`lib/adapters/player-analysis-adapter.ts`) + `useLeaguePlayerTotals` + **Játékos-elemzés** szekció a Játékos-részletekben (`PlayerAnalysisPanel`) – 2026-10-12
- [ ] **A Játékos-elemzés ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Játékosok* → Luka Doncic: szerepkörök „Pontszerző csatár”, „Kiegészítő játéképítő”, skill-sávok (Pontszerzés 100, Lepattanózás 100, Játéképítés 85), öt haladó blokk; Rájátszás fül: „nincs értelmezhető liga-összevetés” üzenet; kis mintájú játékosnál „Kis minta” üzenet
- [x] Elemző motor 3/4: **team-analysis** portolva (`lib/team-analysis.ts`) + adapter (`lib/adapters/team-analysis-adapter.ts`) + **Csapat-elemzés** szekció a Csapatstatisztikában (`TeamAnalysisPanel` / `TeamAnalysisBlocks`) – 2026-10-12
- [ ] **A Csapat-elemzés ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Csapatstatisztika* → 2025/2026 + Lakers, az alsó táblák alatt „Csapat-elemzés": jelvények („Kiegyensúlyozott támadás", „Kevés faultos védekezés", „Perimétervédelem", „Gyors, belső fókuszú"), 11 sávos liga-profil (Tempó 100.7 / 27, FT rate 0.244 / 95, ORtg 115.4 / 85, NetRtg +1.7 / 61), erősségek / limitációk / kockázatok, Védekezési profil és Roster (10 alkalmas játékos, 3&D Wing · 5, Secondary Playmaker · 6); Rájátszás fül: sárga figyelmeztetés a vékony rosterről (2 alkalmas játékos); csapatváltáskor a szekció frissül; képernyőképen is átnézni (T32); a konzol hibamentes
- [ ] **A `team-analysis` NBA-kalibrációja (döntés kell):** a roster-jelzések és néhány szöveges küszöb ASEStats-értéken áll, részletek a progress-tracker „Nyitott kérdések / Csapat-elemzés" pontjában
- [x] Elemző motor 4/6: **pregame-scouting** portolva (`lib/pregame-scouting.ts`) + adapter (`lib/adapters/pregame-adapter.ts`) + **Scouting** nézet (`ScoutingView`, új tab: Analitika → Scouting) – 2026-10-14
- [ ] **A Scouting ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Analitika → Scouting* → 2025/2026 + Lakers: az ellenfél az utolsó lejátszott meccsé (Oklahoma City Thunder), négy kártya (Nyerési esély 35.5%, Várható győztes OKC, Bizonyosság Közepes), profilok, csapatmutató-tábla, 5 poszt-párharc (PG +9.1, PF −6.0), kulcsjátékosok névvel (Shai Gilgeous-Alexander, Luka Doncic), forgatókönyvek; ellenfelet váltva frissül; Rájátszás fül (Lakers–OKC: 8% esély); play-in/kis minta: tájékoztató üzenet; képernyőképen is átnézni (T32); a konzol hibamentes
- [ ] **A `pregame-scouting` NBA-kalibrációja és a nyerési esély tesztelése (döntés kell):** a modell nem kalibrált, részletek a progress-tracker „Nyitott kérdések / Scouting” pontjában
- [x] Elemző motor 5–6/6: **postgame-report** + **player-postgame** portolva (`lib/postgame-report.ts`, `lib/player-postgame.ts`) + adapter (`lib/adapters/postgame-adapter.ts`) + **Meccs utáni riport** szekció a Meccs-részletekben (`PostgameReportPanel`) – 2026-10-14
- [ ] **A Meccs utáni riport ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Liga → Mérkőzések* → Rájátszás → 2026. 05. 11. „Box score”: a box score fölött „Meccs utáni riport” – kártyák (Eredmény 110–115, ORtg 112.0, DRtg 117.1, NetRtg −5.1 a szezonátlag-referenciával), összefoglaló (fő ok: védekezés), kulcsmutató-tábla, döntő tényezők, játékos-tábla (legfelül Jaxson Hayes, „Stabil alappillér (padról)”); alapszakasz-meccsen (2026. 01. 18., Toronto) Ayton „Elsődleges motor”; képernyőképen is átnézni (T32); a konzol hibamentes
- [ ] **A `postgame-report` / `player-postgame` NBA-kalibrációja (döntés kell):** a per-meccs VAL-küszöbök és több szöveges küszöb ASEStats-értéken áll, részletek a progress-tracker „Nyitott kérdések / Meccs utáni riport” pontjában
- [ ] Meccs utáni riport: dobástérkép (NBA-geometria, roadmap 5.), lineup, clutch, pontforrások, negyedek (linescore nincs), X-faktor visszacsatolás (a Scouting riportjának mentése kell hozzá)
- [x] **Markdown export** (vágólapra): meccs utáni riport, box score, csapatstatisztika (+ Csapat-elemzés), játékos szezonértékelés (+ Játékos-elemzés) – `lib/export-to-md.ts`, `components/CopyMarkdownButton.tsx` – 2026-10-14
- [ ] **A Markdown exportok ellenőrzése böngészőben (felhasználó):** Meccs-részletek: „Box score MD” és a riport „Riport MD” gombja; Csapatstatisztika: „Csapat MD”; Játékos-részletek: „Játékos MD” – kattintás után toast, a vágólap tartalma beilleszthető (táblák, nincs `NaN` / `undefined`)
- [ ] Markdown export: Scouting riport (`pregameReportToMd`), Szituációk, Tabella; fájlletöltés; meccsnapló-export
- [x] **Áttekintés nézet** (`overview` → `OverviewView`): csapat-kártyák (mérleg, kiemelés, forma, NetRtg), következő meccs + Scouting-belépő, utolsó 5 meccs, legjobb 5 játékos, konferencia-élmezőny – `components/OverviewView.tsx`, `components/OverviewBlocks.tsx` – 2026-10-14
- [ ] **Az Áttekintés ellenőrzése böngészőben, bejelentkezve (felhasználó):** lásd a progress-tracker Kézi teendők 22. pontját
- [ ] `player-postgame` önálló nézet / játékos-szintű riport a Játékos-részletekben (a motor már megvan, a meccs utáni játékostábla a riportban látszik)
- [ ] Scouting: dobásprofil (`shotProfiles`: saját, ellenfél, liga, kapott zónák a `shot_events`-ből; NBA-geometria döntés kell) és sérülés-kontextus (az adatbázisban nincs sérülésadat)
- [ ] `player-analysis`: forma-trend riport (`PlayerTrend`, utolsó 5 meccs) és hasonlósági mutató – meccsenkénti bemenet kell, külön egység
- [ ] Negyedenkénti eredmény (linescore) a Meccs-részletekbe: a `games` táblában nincs ilyen oszlop → migráció + import-bővítés, **döntés kell**
- [ ] Ligaszintű játékoslista (ranglista a 30 csapatra, a cserélt játékos sorainak összevonásával) – előtte döntés kell a csapatszűrő szerepéről a ligás nézetekben
- [x] Refaktor: a `useTeamGames` a közös `useSeasonScopedResource()`-ra, a `GamesView` szakaszválasztása az `orderSeasonTypes()` / `resolveSeasonType()` helperekre, a közös betöltő semleges átnevezése, a `PlayerCell` / `PositionBadge` saját fájlba – kész 2026-10-12
- [ ] A `SeasonTeamSelector` hibapanelje a közös `DataLoadError` komponensre cserélhető (most két azonos kinézetű megvalósítás van; külön, tisztán refaktor lépés)
- [ ] Követett csapat választó (admin, `app_settings.followed_team_id`)

### Elemzés és AI (roadmap 3–5.)

- [ ] Elemző motorok portolása (B-lista, `context/megvalosithatosag.md`), az ASEStats H10/H12 döntéseivel együtt (T14–T18)
- [ ] `player-postgame`: 48 perces percküszöbök konstansba kiemelve; `situational-analysis`: hosszabbítás-bucket
- [ ] Migráció 004: AI riport táblák és RLS; a `generate-*` route-ok a követett csapatra paraméterezve, `requireAdmin()`-nal (T26)
- [ ] Dobástérkép NBA-geometriával (clamp, nem eldobás – T11), zóna heatmap
- [x] Vercel deploy: `vercel.json` az ASEStats mintájára (T27), 2026-10-26

### Később / ötletek

- [ ] Play-by-play tárolás: win probability, run-ok, clutch. Supabase tier-döntés kell hozzá.
- [x] **Tárhely-döntés a 2026/27-es szezon előtt.** Mérés: egy szezon kb. 130 MB, két szezon kb. 390 / 500 MB → **mindkét szezon marad**; 450 MB fölött a legrégebbi szezon nyers JSON-ja törlődik (döntés: 2026-09-30). A 2027/28-as szezon előtt újra dönteni kell (pl. saját szerver).
- [ ] Tárhely-figyelés: a napi futás írja ki a projekt méretét, és 450 MB fölött figyelmeztessen. A cron kész, de a méret lekérdezéséhez SQL-függvény kell (`pg_database_size` PostgREST RPC-n át) → migráció, **döntés kell** (2026-10-01)
- [ ] GameScore / PIE a FIBA valuation mellé
- [ ] Élő meccsállapot (scoreboard polling)
- [ ] Tartalék adatforrás-adapter (balldontlie), ha az ESPN formátuma eltörik

### Eldöntött kérdések (2026-09-29, módosítva 2026-10-10)

- Alapértelmezett szezon a választóban (2026-10-10): a 2025/26-os, a tesztelés idejére (a 2026/27-nek 2026-10-20-ig nincs lejátszott meccse). Később felül kell vizsgálni.
- Tabella (2026-10-10): külön tabella-tábla készül a hivatalos kiemeléshez, GB-hez, sorozathoz és clinch jelzéshez.
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
- Olbrich (CHI) ESPN-rekordja ID és statisztika nélküli, de 12 meccsen játszott: ezeken a CHI játékossorainak összege kisebb a csapatsornál (a csapatsor helyes). Az ESPN javításáig ez `⚠`. A Meccs-részletek minden összegezhető mutatót egyeztet (nem csak a pontot és az FGA-t), így 17 Bulls-meccsen figyelmeztet (2026-10-10-i mérés: ligaszinten csak ezeken tér el a játékosok összege a csapatsortól).
- Az NBA Cup döntője alapszakasz-meccsként bent van (NY, SA: 83 meccs).

---

## 2. Fejlesztési történet

### 2026-10-26 – Vercel deploy ✓

- **`vercel.json`** az ASEStats mintájára (T27): `npm install --cache /tmp/.npm --prefer-offline --no-audit --no-fund`, `NEXT_TELEMETRY_DISABLED=1 next build`.
- **Vercel projekt:** `katsa00781s-projects/nbastats` (`prj_BXt6Hhfbu6JDLmdGmJZQNvk17QCs`), a `katsa00781/nbaStats` GitHub repóhoz kötve: a `master` push production deployt indít. A projekt a Vercel CLI-vel jött létre (`vercel link`); a Vercel MCP-nek nincs írási joga a teamhez (403).
- **Környezeti változók (production + preview):** csak `NEXT_PUBLIC_SUPABASE_URL` és `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`--type config`: az anon kulcs a böngészőbe kerül, az adatot az RLS védi). A service role és az AI-kulcsok nincsenek fent: API route nincs, a futó app nem használja őket. Ha lesz `app/api/*` route, akkor kellenek (csak `secret` típussal).
- **Ellenőrzés:** `tsc`, `eslint`, `next build` helyben hibátlan.

### 2026-10-24 – Poszt-finomítás: a G → PG / SG illesztés kalibrálása ✓

- **Ok:** a Meccs utáni riportban Dončić SG-ként szerepelt. Az ESPN csak G / F / C-t ad, a G → PG / SG a `computePositionFitScore()` illesztésből jön; az SG pontszerző-súlya (PTS × 0,6 + 3PA × 0,8) legyőzte a PG-t a nagy pontszerző irányítóknál. Alapszakaszban 25 PG / 153 SG volt.
- **`lib/player-analysis.ts`:** `PG_AST_WEIGHT = 4` (volt 2), `PG_MIN_AST_PER36 = 6`, `PG_LOW_AST_PENALTY = 6`. A puszta súlyemelés (3,5) alacsony AST-ú védekező hátvédeket (Smart, Caldwell-Pope, Konchar, DeRozan) is PG-be tett (11 játékos < 4 AST/36), ezért kell az alsó határ.
- **Kalibráció (valós adat, 2025/26 alapszakasz, 178 alkalmas G-vödrös játékos, scratchpad-szkript, csak olvasás):** 71 PG / 107 SG; Dončić, Young, Harden, Gilgeous-Alexander, Brunson, Cunningham, Ball, Garland, Fox PG; Edwards, Mitchell, Curry, LaVine, Green SG; egyetlen PG sincs 4,5 AST/36 alatt. Ismert határeset: Booker és Maxey PG-be kerül.
- **Hatókör:** a Játékos-elemzés, Csapat-elemzés (roster), Scouting és a Meccs utáni riport használja a motort. Alapszakasz-pool: SG 107, SF 76, PG 71, C 49, PF 40. Rájátszás: SG 19, PG 9, C 9, SF 8, PF 3 (a PG 10 alatt: nincs PG-benchmark; előtte nem volt PG sem).
- **Ellenőrzés:** `tsc`, `eslint` hibátlan; 5 Lakers-meccs riportja előtte / utána: csak a posztok változnak (Dončić, Reaves, Smart, Kennard PG / SG), a címkék és a rangsor nem. **Böngészőben nem néztem** (T32).

### 2026-10-24 – Meccs utáni riport: a Riport MD anomáliáinak javítása ✓

- **Kiváltó ok:** egy korai szezonmeccs (a csapatnak 1 másik meccse a szakaszban, nincs liga-benchmark) riportja önellentmondó volt. Felhasználói döntések: „enyhe” sáv a döntő tényezőkben; rögzített NBA-referencia a TO-hangsúlyhoz referencia nélkül; új „Hatékonysági deficit” címke; poszt-finomítás (külön commit, még hátravan).
- **`lib/postgame-report.ts`:**
  - **Liga medián 0,0%:** a `buildPostgameMetrics` a `getBenchmarkThreshold()`-ot (`?? 0`) használta; most `getLeagueMedian()` → benchmark nélkül `undefined`, az export „Liga medián” oszlopa elmarad.
  - **Referencia nélküli ág:** új `hasSeasonReference()` (`kind === 'season' && comparable`). A szezon-delta Erősség / Probléma sorok és a fókusz célértékei (`seasonRef()`) nem használják az 1 másik meccset referenciának.
  - **Tartalék TO-referencia:** `NBA_FALLBACK_TURNOVER_RATE` = 12,8% (a 2025/26-os alapszakasz 30 csapatának TO rate mediánja, 2462 csapat-meccs, csapatonként 11,1–14,6%). Csak `!comparable` és liga medián híján él, „NBA-átlag becslés” jelöléssel (probléma-sor és TO-fókusz). Nem kalibrált benchmark.
  - **Enyhe sáv:** a négy párharc-faktor második küszöbe (eFG 2, TO 2, OREB 1,5, FT 3 pp), `severity: 'minor'`, „Enyhe …” címke. Az enyhe sor csak hézagot tölt ki (ha a témát döntő vagy referencia-sor már lefedi, elmarad), a kulcsmomentumokba, a „ki döntött” megítélésbe és a kapcsolt bontásba / fókuszba nem számít.
  - **Közös adatminőségi megjegyzés:** `describePostgameBaselineNote()` (web és MD azonos szöveg); referencia nélkül már nem állítja, hogy „a szezonátlaghoz mér”.
  - `focusTopic()`: a „Labdabiztonság”, „TO-rate” sor a TO témához tartozik (nincs dupla TO-fókusz, és a TO prioritása érvényesül).
- **`lib/player-postgame.ts`:** `isInefficientHighUsage()` + `INEFFICIENT_LABEL` / `INEFFICIENT_MAX_TS_PCT` (kezdő, USG ≥ 25%, alappillér-szintű játékidő, TS% ≤ 50): az `engine` / `support` osztály címkéje „Hatékonysági deficit” (az osztály és a sorrend nem változik); bekerül a „Limitált hatás (magas usage)” kiemelésbe is.
- **`lib/export-to-md.ts`, `components/PostgameReportPanel.tsx`, `PostgameReportBlocks.tsx`:** közös megjegyzés, lábjegyzet-magyarázat, `badge-warning` a új címkére (új token nincs).
- **Ellenőrzés:** `tsc`, `eslint` hibátlan. Szintetikus eset (1 másik meccs, üres benchmark, Dončić-szerű sor) 11 állításra zöld. Valós adat: 5 Lakers-meccs (2025/26) riportja előtte / utána: a különbség az enyhe sorok, a TO-fókusz előrébb kerülése és a Dončić-meccsen (34 perc, USG 38%, TS 49,6%) az új címke; minden más változatlan. Egy első változat az enyhe sávval kiszorította / előjelben ellentmondta a referencia-sorokat (FTM rate), ezt a valós diff fogta meg: javítva. **Böngészőben nem néztem** (T32).
- **Nyitott:** poszt-finomítás: lásd a következő bejegyzést.

### 2026-10-24 – Nem használt navigációs fülek törlése ✓

- **Döntés (felhasználó):** a pregame (Analitika → Scouting) és a postgame (Mérkőzések → Box score → Meccs utáni riport) marad ahol van; az üres „Elemzések” és „Meccs Log” fül törlődik.
- **`components/AppSidebar.tsx`:** a két `NAV_GROUPS` elem és az ikon-importjuk (`Sparkles`, `ClipboardList`) kikerült. Az `Import` (Admin) fül maradt. A `NavItem.tone` támogatás a komponensben megmaradt (jelenleg nincs használója).
- **`context/project-overview.md`:** a navigáció felsorolása a valós fülekre javítva.
- **Ellenőrzés:** `tsc`, `eslint` hibátlan. Böngészőben nem néztem.

### 2026-10-14 – Áttekintés nézet ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a context fájlok nem definiálták a tartalmát; négy blokk: csapat-kártyák, következő / utolsó meccsek, top játékosok, liga-pillanatkép. Új lekérdezés nincs.
- **`components/OverviewView.tsx` (új):** a `useStandings`, `useLeagueTeamStats`, `useTeamGames`, `useTeamPlayerStats` hookokból. Kártyák: Mérleg, Kiemelés, Forma (L10 + sorozat), NetRtg (ORtg / DRtg, helyezés). A mutatók és a játékosok az alapszakaszból (annak híján az első elérhető szakaszból) jönnek.
- **`components/OverviewBlocks.tsx` (új):** `NextGameCard` (Scouting gombbal), `RecentGamesTable`, `TopPlayersTable` (pontátlag, min. 10 meccs, T15), `ConferenceSnapshot` (top 5 konferenciánként).
- **`app/page.tsx`:** az `overview` tab az `OverviewView`-t rendereli, az `onNavigate` a Scouting gombnak adja a tab-váltást.
- **Ellenőrzés:** `tsc`, `eslint`, `build` hibátlan. **Nem ellenőrzött:** böngésző, valós adat, képernyőkép (T32).

### 2026-10-14 – Markdown export (vágólapra) ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** AI riport nem kell, csak az MD export; kell: meccs utáni riport, csapatstatisztika, játékos és box score; a Scouting nem; csak vágólapra másolás (nincs fájlletöltés).
- **`lib/export-to-md.ts` (új):** négy tiszta függvény az ASEStats `export-to-md` szakaszszerkezetét követve, de az NBA adattípusaira írva (az ASEStats-függvények Kosarstat-típusokra épülnek, szó szerinti port nem lett volna értelmes): `postgameReportToMd` (kulcsmutatók ▲/▼ iránnyal és liga mediánnal, ellenfél, box score, dobásprofil, döntő tényezők, játékos bontás, erősségek / problémák / fókusz, kiemelések, adatminőség, összefoglalás), `gameBoxScoreToMd` (csapatstatisztika, fejlett mutatók, mindkét csapat játékostáblája, DNP, összeg-eltérés), `teamStatsToMd` (alap- és fejlett mutatók a liga átlaggal és helyezéssel + Csapat-elemzés: liga-profil, erősségek, limitációk, kockázatok, védekezési profil, roster), `playerSeasonToMd` (átlagok és /36, százalékok, Játékos-elemzés skill-pontokkal és haladó blokkokkal, utolsó 10 meccs). A lábjegyzetek a kódbeli küszöbökből (`player-postgame` konstansai, exportálva) és a mi definícióinkból (T14, T17) épülnek; az Impact küszöbök NBA-kalibrációjára hivatkoznak.
- **`components/CopyMarkdownButton.tsx` (új):** `navigator.clipboard`, a szöveg kattintáskor épül fel; toast és rövid pipa. Bekötés: `GameDetailsView` („Box score MD”), `PostgameReportPanel` („Riport MD”, csak kész riportnál), `TeamStatsView` („Csapat MD”, a liga játékosainak betöltéséig letiltva; a Csapat-elemzést kattintáskor számolja), `PlayerDetailsView` („Játékos MD”). A `GamesView` / `PlayersView` a `seasonName` propot adja tovább.
- **Dokumentáció:** `CLAUDE.md`, `context/architecture.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26): a Lakers–Thunder 2026. 05. 11-i meccs riportja és box score-ja, a Lakers alapszakasz csapatexportja (Csapat-elemzéssel), Luka Doncic játékos-exportja: nincs `NaN` / `undefined` / `[object`, minden táblasor oszlopszáma egyezik; `tsc`, `eslint`, `build` hibátlan.
- **Nem ellenőrzött:** a vágólap böngészőben (a `navigator.clipboard` biztonságos környezetet kér: `localhost` vagy https), képernyőkép (T32).
- **Ismert korlát:** nincs Scouting-, Szituációk- és Tabella-export; a játékos-export a meccsnaplóból csak az utolsó 10 meccset adja; negyedek, lineup, dobástérkép nincs.

### 2026-10-14 – Meccs utáni riport: a `postgame-report` és a `player-postgame` motor portja ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a két motor egy lépésben (a riport a játékos-riportot hívja); a kimenet a Meccs-részletek új szekciója (nincs új tab); dobástérkép, lineup, clutch és pontforrás-kiegészítés nélkül.
- **`lib/postgame-report.ts` (új, 3651 → 2667 sor):** az ASEStats motor portja: referencia (szezonátlag vagy kis mintánál liga medián), ratingek közös birtoklásszámból, döntő tényezők (meccs-párharc + referencia-delta + védekezés a liga mediánhoz), erősségek / problémák / következő fókusz, játékos-hatás, ellenfél profil, X-faktor visszacsatolás (bemenet megvan, az adapter nem tölti), összefoglaló. Kivéve: a Kosarstat-rész (negyedek, clutch, pontforrások, összefűzés), a dobástérkép (FIBA-geometria), a lineup-elemzés. A `buildPostgameAutoFocus` csak a riport fókuszait adja. Az ASEStats postgame a T14/T17 definíciókat már követte (Oliver-féle TO%, FTM / FGA, közös birtoklás).
- **`lib/player-postgame.ts` (új):** az ASEStats motor portja: USG%, Impact score, osztályok (elsődleges motor / alappillér / rotáció / limitált hatás). Percküszöbök 48 percre (×1,2, `MINUTES_SCALE`); a dobástérkép-jelzések kimaradtak. **NBA-kalibráció (valós adaton mérve, 5 csapat × 40 alapszakasz-meccs, 1615 játékos-meccs ≥ 15 percből):** az ASEStats Impact score küszöbei (alappillér 52, rotáció 38) a pontszámok P78 / P50 értékére estek, így a ≥ 15 percet játszók 52%-a (a ≥ 30 percesek 37%-a) „Limitált hatás” lett → 47 / 25 (P70 / P25); a Lakers-szezonon 30% / 14%. A „gyenge meccs” kiemelésbe csak rotációs percet kapó játékos kerül (előtte 2 perces játékosok); a „limitált hatás” lista legalább 10 perces mintát kér (előtte 28 eset < 8 perccel).
- **`lib/adapters/postgame-adapter.ts` (új):** `buildGameReport()`: a box score csapatsora → `TeamGameStat` (mindkét oldal), a szakasz-összesítő a vizsgált meccs levonásával → `TeamSeasonStat` (különben a meccs önmagához mérné magát), liga-benchmark a szakasz ≥ 10 meccset játszott csapataiból (min. 8, különben csak szezonátlag), játékosok meccssora a Játékos-elemző motor posztjával. Eredmény: `ready` / `no-team-stats` / `no-season-stats`.
- **`components/PostgameReportPanel.tsx`, `PostgameReportBlocks.tsx` (új):** négy kártya, figyelmeztetések, összefoglaló szakaszai, kulcsmutató-tábla (meccs / referencia / eltérés / liga medián), döntő tényezők és erősségek / problémák, játékos-tábla. **`components/GameDetailsView.tsx`:** a szekció a box score tábla fölött.
- **Dokumentáció:** `CLAUDE.md`, `context/architecture.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26): Lakers–Thunder rájátszás 2026. 05. 11. (110–115, ORtg 112.0 / DRtg 117.1, fő ok: védekezés), Lakers–Warriors 2025. 10. 21. (Doncic 43 pont, „Elsődleges motor”), Lakers–Raptors 2026. 01. 18. (Ayton MVP); az Impact osztályok eloszlása a Lakers 82 meccsén (649 játékos-meccs ≥ 15 perc); 6 meccs szerveroldali renderje (Lakers, Pelicans; nincs `NaN` / `undefined`); `tsc`, `eslint`, `build` hibátlan.
- **Nem ellenőrzött:** böngészős futás, képernyőkép (T32), play-in meccs (a Lakers/Pelicans 2025/26-ban nem játszott).
- **Ismert korlát:** a szezon- és játékos-összesítő minden Meccs-részletek megnyitáskor újra lekérdeződik (kb. 2650 + 1000 sor, nincs gyorsítótár); a hook modul-szintű tárolója nem őrzi meg a nézet váltása után.

### 2026-10-14 – Scouting: a `pregame-scouting` motor portja ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a következő motor a `pregame-scouting`; új tab (*Analitika → Scouting*), az ellenfelet a nézetben lehet választani; az első körben dobásprofil és sérülés-kontextus nélkül.
- **`lib/pregame-scouting.ts` (új):** az ASEStats motor portja (2266 sor): csapatstílus, nyerési esély (rating-különbség + poszt-párharc korrekció), poszt-párharc, kulcsjátékosok, X-faktor, forgatókönyvek, kockázati forgatókönyvek, szabály-alapú összefoglaló. Eltérések: a csapatmutatók a Csapatstatisztika definícióit követik (T14 közös birtoklásszámból számolt, 48 percre vetített tempó; Oliver-féle TO%; T17 FT-mutató = FTM / FGA; `lib/stat-formulas.ts`, T22); nincs magasság; a dobásprofil és a sérülés-kontextus bemenete megvan, de az adapter nem tölti; a magyar névelő javítva („az irányító”, az ASEStats „a irányító” hibája helyett); a `POSITION_LABELS` exportált.
- **`lib/adapters/pregame-adapter.ts` (új):** `scoutStageOpponent()`: a `TeamStageStats` → a motor `TeamSeasonStat`-ja (a benchmark-pool a szakasz ≥ 10 meccset játszott csapatai, min. 8 csapat; liga = „NBA”, szezon = a szakasz kódja); a rotáció (≥ 5 meccs, ≥ 10 perc/meccs) a `LeaguePlayerTotals`-ból a Játékos-elemzés posztjaival és szerepköreivel. **A poszt-vödör egyetlen, a statisztikailag illesztett poszt:** az ESPN G / F / C jelölésének vödrei (G → PG + SG, F → SF + PF) a PG és SG, illetve SF és PF sorát azonos adattal, dupla súllyal számolták (valós adaton: azonos VAL/36 a két posztra). Eredmény: `ready` / `no-data` / `small-sample` / `no-benchmark`.
- **`components/ScoutingView.tsx`, `ScoutingSummaryBlocks.tsx`, `ScoutingMatchupBlocks.tsx` (új):** ellenfél-választó (alapból a csapat következő le nem játszott meccsének ellenfele, lezárt szezonban az utolsó lejátszotté), szakasz-fülek (ahol mindkét csapatnak van meccse), négy kártya, összefoglaló (profilok, veszélyek, sebezhetőségek, fókuszpontok, játékterv, tartalék terv), csapatmutató-tábla, poszt-párharcok, kulcsjátékosok, a rotáció legjobbjai, forgatókönyvek, „ha bekövetkezik”; skeleton / `DataLoadError` / tájékoztató üzenet. **`components/AppSidebar.tsx`, `app/page.tsx`:** új `scouting` tab.
- **Dokumentáció:** `CLAUDE.md`, `context/architecture.md`, `context/project-overview.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26): Lakers–Thunder alapszakasz 35.5% / 64.5% (Közepes), rotáció 14 / 16 játékos, 5 különálló poszt-párharc, a kulcsjátékosok névvel; Lakers–Celtics 46.9% (Alacsony); rájátszás 8% / 92%; play-in: nincs adat. A komponensek szerveroldali renderje valós adatból (45 kB, nincs `NaN` / `undefined`); `tsc`, `eslint`, `build` hibátlan.
- **Nem ellenőrzött:** böngészős futás, képernyőkép (T32).
- **Ismert korlát:** a nyerési esély nem kalibrált (a logisztikus skála ASEStats-érték), rájátszásban 8 csapatos poolnál szélsőséges lehet (a 8% / 92% a modell alsó/felső határa); a kulcsjátékos-küszöbök (AST ≥ 2.5/meccs, 3PA ≥ 1.5/meccs) ASEStats-értéken állnak.

### 2026-10-12 – Csapat-elemzés: a `team-analysis` motor portja ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a kimenet a Csapatstatisztika új szekciója (nincs új tab); a benchmark a szakasz csapatai között készül (alapszakasz / play-in / rájátszás külön), a Csapatstatisztika rangsorához hasonlóan.
- **`lib/team-analysis.ts` (új):** az ASEStats motor portja: normalizált csapatmutatók, percentilis-benchmark (P10–P90), stílus-felismerés, erősségek / limitációk, védekezési profil, roster-összegzés (poszt szerinti percmegoszlás, szerepkörök, használat-koncentráció), kockázati sorrend, liga-klaszterek, összefoglaló. Eltérések: a fejlett mutatók a Csapatstatisztika definícióit követik (T14 közös birtoklásszám a tempóhoz és mindkét ratinghez, 48 percre vetített tempó; Oliver-féle TO%; T17 FT-mutató = FTM / FGA; mind a `lib/stat-formulas.ts`-ből, T22); egyszintű benchmark (nincs `league` / `season` kulcs); nincs magasság és nincs hiányzó-ellenfél-adat ág; a forma / clutch / dobástérkép / lineup / impact profil kimaradt; a „Liga-klaszter: …” címke nem kerül a támadási stílusok közé (az ASEStatsben ez az összefoglaló első mondatába szivárgott); az összefoglaló nem tartalmazza a „Legmagasabb kockázat:” fejlécet, és stílus híján nem mond „… fókuszú” suta mondatot.
- **NBA-kalibráció (valós adaton mérve, 30 csapat, alapszakasz):** az ASEStats abszolút küszöbei közül három értelmetlen lett volna, ezeket átírtam: a `scorerDependency` (top-2 használat ≥ 0,55) 0/30 csapaton teljesült volna → a liga használat-percentilise ≥ 80 (10/30); a `weakReboundingPresence` (magas posztok perce < 35%) 27/30-on teljesült volna → percentilis ≤ 20 (9/30); a védelmi lepattanó (0,74 / 0,63) soha nem adott „gyengét” → a `dreb_rate` benchmark-percentilise (≥ 60 erős, ≤ 40 gyenge). Az „FT rate ≥ 0,30” szabály FTA / FGA-ra szólt, az FTM / FGA skálájára 0,23 (liga ~77% FT%). A többi küszöb változatlan (lásd Nyitott kérdések).
- **`lib/adapters/team-analysis-adapter.ts` (új):** `analyzeStageTeam()`: a `TeamStageStats` (mindkét oldal) → `TeamSeasonStat`; a rostert a Játékos-elemzés motorja adja (poszt, szerepkörök, `usageProxyPer36` – csak az alkalmas, 8 meccs / 18 perc mintájú játékosra, a perc mindenkire); a benchmark-pool a szakasz legalább 10 meccset játszott csapataiból áll (min. 8 csapat). Eredmény: `ready` (+ az alkalmas játékosok száma) / `small-sample` / `no-benchmark`. **`lib/adapters/player-analysis-adapter.ts`:** a `toRawPlayerStat()` exportálva.
- **`components/TeamAnalysisPanel.tsx`, `components/TeamAnalysisBlocks.tsx` (új):** szekció az alap- és fejlett mutatók alatt: stílus- és klaszter-jelvények, összefoglaló, 11 sávos liga-profil (érték + percentilis), erősségek / limitációk / kockázatok, Védekezési profil, Roster (percmegoszlás, szerepkör-jelvények, jelzések, megfigyelések); vékony rosternél (< 6 alkalmas játékos) figyelmeztetés; skeleton / `DataLoadError` / tájékoztató üzenet. **`components/TeamStatsView.tsx`:** a `useLeaguePlayerTotals()` és a `useTeamPlayerStats()` (nevek) hívása és a szekció bekötése.
- **Dokumentáció:** `CLAUDE.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26): Lakers alapszakasz – ORtg 115.4 (85. percentilis, azonos a Csapatstatisztikával), NetRtg +1.7, klaszter „Gyors, belső fókuszú” (8/30), 10 alkalmas játékos, poszt-percek PG 14.3 / SG 26.5 / SF 25.4 / PF 17.7 / C 16.1; a 30 csapatra lefut (8 klaszter-/stílus-ág, nincs NaN); a két komponens szerveroldali renderje valós adatból (17 kB, nincs `NaN` / `undefined`); `tsc`, `eslint`, `build` hibátlan. A számítás kb. 50 ms.
- **Nem ellenőrzött:** böngészős futás, képernyőkép (T32).
- **Ismert korlát:** rájátszásban csak 8 csapat játszott ≥ 10 meccset (a pool épp a minimum), és csapatonként 2–5 játékos alkalmas (a poszt-poolok kicsik): a roster-alapú megállapítások ott vékonyak, a nézet figyelmeztet. Play-inben nincs elemzés (nincs csapat ≥ 10 meccsel).

### 2026-10-12 – Játékos-elemzés: a `player-analysis` motor portja ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a kimenet a Játékos-részletek új szekciója (nincs új tab); a benchmark a liga azonos posztú játékosaiból épül, szakaszonként, 36 percre normalizálva, küszöb 8 meccs / 18 perc (az ASEStats 15 perce ×1,2 a 48 percre); a használati arány marad `usageProxyPer36` (FGA + 0,44·FTA + TOV), nem USG% (T18 eltérés, nem vezettük be).
- **`lib/player-analysis.ts` (új):** az ASEStats motor portja: per-36 normalizálás, poszt szerinti percentilisek (P10–P90), szerepkör-felismerés (16 szerepkör), skill-pontok, erősségek / limitációk / fejlesztendők, összefoglaló, öt haladó blokk. Eltérések: nincs `league` / `season` kulcs (a hívó szakaszonként építi a poolt); `MIN_BENCHMARK_POOL = 10` (kisebb poszt-poolból nem készül benchmark); a `fouls.received` kimaradt (az ESPN nem adja); az ESPN „G” / „F” jelölése nem rendezett, ezért ott a statisztikai illesztés dönt (az ASEStats a lista első elemét vette volna, így minden hátvéd PG lett volna); a forma-trend riport és a hasonlósági mutató kimaradt (meccsenkénti bemenet kell); a forrásban lévő cirill betűs elírás („dобás”) javítva.
- **`lib/league-player-data.ts`, `hooks/useLeaguePlayerData.ts` (új):** `fetchLeaguePlayerTotals()` a szezon összes játékosának összegeit adja a `player_season_stats_by_season` view-ból (close / mid / hármas bontás, lepattanó-bontás, személyi hiba; `fetchAllRows`), `useLeaguePlayerTotals(seasonId)` a `useSeasonScopedResource()`-ra, csak a szezon a kulcs (játékos- és csapatváltáskor nem kérdez újra).
- **`lib/adapters/player-analysis-adapter.ts` (új):** `buildStageBenchmarks()` (a cserélt játékos csapatonkénti sorai egy játékossá összegződnek a poolban), `analyzeStagePlayer()` (a játékost a kiválasztott csapatnál elemzi, a lista átlagaival azonos meccsek). Eredmény: `ready` / `small-sample` / `no-benchmark` / `no-shot-data`.
- **`components/PlayerAnalysisPanel.tsx`, `components/PlayerAnalysisBlocks.tsx` (új):** szekció a szakasz átlag-kártyái alatt: szerepkör-jelvények, összefoglaló, hat skill-sáv, erősségek / limitációk / fejlesztendő, öt haladó blokk (dobás, játéképítés, védekezés, pontszerzés, hatékonyság); skeleton / `DataLoadError` / tájékoztató üzenet. **`components/PlayerDetailsView.tsx`:** a hívás és a szekció bekötése.
- **Dokumentáció:** `CLAUDE.md`, `context/architecture.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26: 993 view-sor, egyiknél sincs hiányzó dobásbontás; alapszakasz: mind az 5 poszt-poolban van benchmark – alkalmas játékos PG 25, SG 153, SF 76, PF 40, C 49; Luka Doncic SG: Pontszerzés 100, Játéképítés 85, Lepattanózás 100, TS% 61.6%; LeBron James SF, Deandre Ayton C), a két komponens szerveroldali renderje valós adatból (6 skill-sáv, 7 kártya, magyar szövegek), `tsc`, `eslint`, `build` hibátlan.
- **Nem ellenőrzött:** böngészős futás, képernyőkép (T32).
- **Ismert korlát:** a rájátszásban csak az SG pool éri el a 10 játékost (8 meccs / 18 perc mellett), a play-inben egy sem – ott a szekció tájékoztató üzenetet ad.

### 2026-10-12 – Szituációk nézet: a `situational-analysis` motor portja ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** az első portolt motor a `situational-analysis` (a legkisebb); az adapter külön fájlban él (`lib/adapters/*.ts`), a motor kódja a lehető legkevésbé tér el az ASEStatsétől.
- **`lib/situational-analysis.ts` (új):** `buildSituationalData()`: hazai / vendég, szoros (≤ 5 pont), gálameccs (≥ 15 pont), hosszabbításos meccsek mérlege, forma (gördülő 5 meccses győzelmi arány), fejlett mutatók. A küszöbök az ASEStats-döntések változatlanul (`CLOSE_GAME_MARGIN`, `BLOWOUT_MARGIN`), de az NBA-ban a pontszám-skála nagyobb: ha a 15 pont túl alacsony, az külön döntés.
- **Ami kimaradt:** a negyedenkénti bontás (negyedek mérlege, félidei vezetés, az 1. negyed megnyerése): a `games` táblában nincs linescore. A hosszabbítás-bucket helyett a „Hosszabbítás” szituáció került be (`games.periods` > 4).
- **T12 / T14 / T17:** a fejlett mutatók nem meccsenkénti értékek átlagai (ahogy az ASEStats motor számolta), hanem az összesített box score-ból, a Csapatstatisztika `TEAM_METRICS` képleteivel. Így az ORtg a két nézetben azonos.
- **`lib/adapters/situational-adapter.ts` (új):** `toSituationalInput()`: `TeamGame[]` + csapatsorok → a motor bemenete egy szakaszra; a hazai / vendég részhalmaz külön összegződik.
- **`lib/situational-data.ts`, `hooks/useSituationalData.ts` (új):** `fetchTeamGameStatRows()` (a csapat és az ellenfelei csapatsorai a szezonban, `fetchAllRows`), `useTeamGameStatRows()` a `useSeasonScopedResource()`-ra. **`lib/team-stats-data.ts`:** a `STAT_COLUMNS` és a `TeamGameRow` exportált.
- **`components/SituationalView.tsx`, `components/SituationalTables.tsx` (új):** szakasz-fülek, négy `StatCard`, szituációk / fejlett mutatók / forma táblák, kis minta jelzés (T15), hiányzó csapatsor figyelmeztetés, skeleton / `DataLoadError` / üres állapot. **`app/page.tsx`:** a `situational` tab a `SituationalView`-ra köt.
- **Dokumentáció:** `CLAUDE.md`, `context/architecture.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26 Lakers: alapszakasz 82 meccs, Hazai 28–13, Vendég 25–16 = a Mérkőzések mérlege; Szoros 11–4, Gála 16–16, Hosszabbítás 1–0; ORtg 115.41 = a Csapatstatisztika értéke mindkét szakaszban; rájátszás 10 meccs, ORtg 105.76), `tsc`, `eslint`, `build` hibátlan.
- **Nem ellenőrzött:** böngészős futás, képernyőkép (T32).

### 2026-10-12 – `useStandings` + Tabella nézet ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** két konferencia-fül (Keleti / Nyugati), teljes oszlopkészlet. A fül-választás a csapathoz kötött (származtatott érték, nem effect).
- **`lib/standings-data.ts` (új):** `fetchStandings()` (az `nba.standings` egy szezonra, ≤ 30 sor, nincs lapozás) + `toStandingRow()` (win%, meccsenkénti PF / PA) + `CLINCHER_LABELS` (az ESPN saját leírásai: `*` `z` `y` `x` `xp` `pb` `e`, valós válaszból).
- **`hooks/useStandingsData.ts` (új):** `useStandings(seasonId)` a `useSeasonScopedResource()`-ra, csak a szezon a kulcs.
- **`components/StandingsView.tsx`, `components/StandingsTable.tsx` (új):** négy `StatCard` a csapatról, konferencia-fülök, 15 oszlopos `DataTable` (kiemelés szerint, `activeRowId`), clincher-jelvény `title`-lel, a jelölések magyarázata a tábla alatt, skeleton / `DataLoadError` / üres állapot.
- **`app/page.tsx`:** a `standings` tab a `StandingsView`-ra köt. **`components/TeamStatsTable.tsx`:** a `formatSigned` exportált (a Különbség oszlop ezt használja, nem másoltam).
- **Dokumentáció:** `CLAUDE.md`, `context/architecture.md`, `context/ui-context.md`, `context/progress-tracker.md`.
- **Ellenőrzés:** valós DB (2025/26: 30 sor, 15 + 15, seed 1–15; Lakers 53–29, #4, `y`, GB 11, 28-13 / 25-16, L10 7-3, GY3, PF 116.3 / PA 114.6; 2026/27: 0 sor), a Nyugati tábla szerveroldali renderje valós adatból (kiemelt sor, rendezett kiemelés, OKC `*` elöl), `tsc`, `eslint`, `build` hibátlan.
- **Nem ellenőrzött:** böngészős futás, képernyőkép (T32), a GitHub Actions tabella-lépése.

### 2026-10-12 – Tabella-import (`nba.standings`) + napi futás ✓ (GitHub Actions-ben nem futott)

- **`lib/espn/client.ts`:** `fetchConferenceStandings()` (`level=2`: itt a GB és a kiemelés konferenciára vonatkozik; a `level=3` GB-je a divízióé).
- **`lib/espn/schemas.ts`:** `parseConferenceStandings()` – a mutatókat név szerint olvassa; kötelező a csapat, a W, L, GB (hiány: `EspnSchemaError` pontos útvonallal), a többi nullable (a `clincher` hiányzik, amíg nincs eldöntött helyzet).
- **`lib/espn/write-standings.ts` (új):** `checkStandings()` (30 NBA-csapat egyszer, konferenciánként 15) és `writeStandings()` (szezon a `requireSeason()`-nel, ESPN ID → UUID, upsert `(season_id, team_id)`).
- **`ingest-standings.ts`:** a besorolás mellett a tabellát is írja; `--dry-run` DB nélkül.
- **`.github/workflows/ingest.yml` + `HOWTO-auto-import.md`:** új „Tabella-import” lépés a menetrend után; nem nyeli el a kilépési kódot.
- **Ellenőrzés:** dry-run 2026 és 2027; éles írás 2026-ra kétszer (30 sor, idempotens); visszaolvasás: Lakers 53–29, seed 4, `y`, GB 11, 28-13 / 25-16, L10 7-3, W3, PF 9540 / PA 9395; clincher-értékek: `z * y x xp pb e`; `tsc`, `eslint`.
- **Megfigyelés:** az ESPN pont-kapott pontja 9395, a `team_game_stats`-ból számolt 9396 (1 pont eltérés, az ESPN saját adata). A 2027-es tabella az ESPN-nél már 2–0 / 0–2 mérleget mutat, nálunk nincs lejátszott meccs.
- **Utólagos döntés (felhasználó):** a `writeStandings()` nem ír, amíg a szezonnak nincs lezárt meccse a `games`-ben (`ℹ`); ellenőrizve: 2027 → nem írt, 2026 → 30 sor.
- **Nem ellenőrzött:** a GitHub Actions futás (a felhasználó dry-run próbája hátravan).

### 2026-10-12 – Migráció 004: tabella-tábla – megírva, futtatás hátravan

- **Döntések (felhasználó):** az ESPN `standings?level=2` mezőiből 13 oszlop (W-L, seed, clincher, GB, hazai / idegen / divízió / konferencia mérleg, utolsó 10, sorozat, pont+/−); a származtatott mutatókat a nézet számolja; az `ingest:standings` bekerül a napi futásba.
- **`migrations/004-standings.sql` (új):** `nba.standings`, kulcs `(season_id, team_id)`, idempotens; `select` az `authenticated`-nek (RLS), írás a `service_role`-nak.
- **`lib/supabase.ts`:** `standings` a `Database` típusban.
- **Ellenőrzés:** `tsc`, `eslint` hibátlan; az ESPN mezőneveket valós `level=2` válaszon néztem meg. **A SQL-t nem futtattam** (a felhasználó futtatja).

### 2026-10-12 – Refaktor: közös betöltő, szakaszválasztás, PlayerCell ✓

- **Viselkedés nem változott**, csak az ismétlések szűntek meg.
- **`hooks/useSeasonTeamResource.ts` → `hooks/useSeasonScopedResource.ts`:** semleges név és paraméter (`scopeId`), mert a második kulcs már csapat, játékos, meccs és szezon is lehet. Minden hívó és a dokumentáció követi (`CLAUDE.md`, `context/architecture.md`).
- **`hooks/useGameData.ts`:** a `useTeamGames` a közös betöltőre épül (a saját state-gép kiesett).
- **`lib/game-data.ts` / `components/GamesView.tsx`:** a `seasonTypesOf()` megszűnt, a nézet az `orderSeasonTypes()` / `resolveSeasonType()` párost használja, mint a többi nézet.
- **`components/PlayerCell.tsx` (új):** `PlayerCell`, `PositionBadge`, `playerInitials` a `PlayersTable.tsx`-ből; a `BoxScoreTables` és a `PlayerDetailsView` innen importál.
- **Ellenőrzés:** `tsc`, `eslint`, `npm run build` hibátlan. Böngészőben nem futott.

### 2026-10-12 – `useLeagueTeamStats` + Csapatstatisztika nézet ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a nézet a kiválasztott csapat szezon-átlagait és a 30 csapatos ligarangsort mutatja; a fejlett mutatók (tempó, ORtg / DRtg, TO%, OREB%, FT-mutató) az ASEStats-döntésekkel kerülnek be; a szakaszok külön, a rangsor azonos szakaszon belül készül.
- **`lib/stat-formulas.ts`:** új `estimatePossessions()`, `ratingPer100()`, `turnoverPct()` (Oliver), `offensiveReboundPct()`, `freeThrowRate()` (FTM / FGA) – a képletek egy helyen (T22).
- **`lib/team-stats-data.ts` (új):** `fetchLeagueTeamStats(db, seasonId)` – a szezon összes `team_game_stats` sora a beágyazott meccs-sorral (`season_type`, `status`, `periods`), `fetchAllRows`-szal, `id` szerinti rendezéssel (T1). `toLeagueTeamStats()`: csak lezárt meccsek, csapatonként és szakaszonként összegezve a saját és az ellenfél oldalt (az ellenfél-sor a `game_id` + `opponent_team_id` párról); az ellenfél-sor nélküli meccs kimarad és számolódik (`incompleteGames`). Játékperc: 48 meccsenként + 5 hosszabbításonként.
- **`lib/team-stats-metrics.ts` (új):** `TEAM_METRICS` (17 alap + 7 fejlett mutató, irány: jobb a több / kevesebb / nincs) és `buildTeamMetricRows()`: érték, liga átlag, helyezés (holtversenynél azonos).
- **`hooks/useTeamStatsData.ts` (új):** `useLeagueTeamStats(seasonId)` a `useSeasonScopedResource()`-ra építve, csak a szezon a kulcs (a szezon azonosítója a második helyen is) – csapatváltáskor nincs új lekérdezés.
- **`components/TeamStatsView.tsx` + `TeamStatsTable.tsx` (új):** szakasz-fülek, négy `StatCard` (Pont / meccs, ORtg, DRtg, NetRtg, a helyezéssel), „Alapmutatók” és „Fejlett mutatók” `DataTable`, kis minta és hiányos adat figyelmeztetés, skeleton, hibapanel, üres állapot. **`components/AppSidebar.tsx`:** új nav elem (`teamstats`, Analitika csoport); **`app/page.tsx`:** a `teamstats` tabon a `TeamStatsView`.
- **Megvalósítási döntések (jelezve a felhasználónak, részletek a progress-trackerben):** súlyozatlan liga átlag; a helyezés felső / alsó harmada színezett (6 csapat alatt és a tempónál nem); a festékpont / gyorsindítás / eladott labdából szerzett pont csak az ESPN által megadott meccsekből átlagolódik; nincs trend, forma és ellenfél-oldali bontás. Új token, új csomag, séma-változás nincs.
- **Ellenőrzés:**
  - valós DB (service role, csak olvasás), a tényleges `fetchLeagueTeamStats`: 2025/26 alapszakasz 30 csapat / 2462 csapat-meccs (= 2 × 1231), rájátszás 16 csapat / 170 (= 2 × 85), play-in 8 csapat / 12 (= 2 × 6); a szerzett és a kapott pont összege szakaszonként egyezik; hiányos meccs nincs. Lakers: 82 meccs, 9540 : 9396 pont (egyezik a Mérkőzések nézet mérlegével), 116.3 pont, FG% 50.2% (1.), TS% 60.9% (2.), tempó 100.7, ORtg 115.4, DRtg 113.7;
  - a `TeamStatsTable` szerveroldali renderje valós adatból (alap- és fejlett csoport, alapszakasz és rájátszás): sorok száma, értékek, helyezés-színezés (6 csapat alatt nincs), formázás;
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** böngészőben (headless Chrome-ban sem) és az éles alkalmazásban, bejelentkezve nem futott; a mobil elrendezés képen nincs átnézve (T32). A hosszabbításos meccsek percszámítása (5 perc / hosszabbítás) a `games.periods`-ra épül.
- **Megfigyelés:** a csapatsor eladott labdája a csapatszintűeket is tartalmazza, ezért a TO% és a tempó a játékosok összegéből számolva kicsit más lenne; a liga átlagos NetRtg-je nem pontosan 0 (0.04), mert a csapatok közös birtoklásszáma különbözik.

### 2026-10-10 – `usePlayerGameLog` + Játékos-részletek (meccsenkénti napló) ✓ (éles böngészős próba hátravan)

- **`lib/player-game-log-data.ts` (új):** `fetchPlayerGameLog(db, seasonId, playerId)` – a játékos összes `player_game_stats` sora a szezonra, a `game_id` idegen kulcsán át beágyazott meccs-sorral; `season_id` + `player_id` szűrés, legfeljebb kb. 110 sor, lapozás nem kell (T1). `toPlayerGameLog()`: csak lezárt meccsek (ahogy a szezon-összesítő view-ban), külön a pályára lépések és a DNP sorok (T8), időrendben; a meccs a játékos akkori csapatának nézőpontjából (`toTeamGame()` a sor `team_id`-jával, T9). Valuation a `simpleValuation()`-ből (T22). **`lib/game-data.ts`:** a `GAME_COLUMNS` és a `GameRow` exportálva (a napló ugyanazokat a meccs-oszlopokat ágyazza be).
- **`hooks/usePlayerGameLogData.ts` (új):** `usePlayerGameLog(seasonId, playerId)` a közös `useSeasonScopedResource()`-ra építve (a második kulcs itt a játékos).
- **`components/PlayerDetailsView.tsx` + `PlayerGameLogTable.tsx` (új):** fejléc (kép vagy monogram, mez, poszt, csapat) és négy `StatCard` a szakasz átlagaival – mindkettő a lista már betöltött soraiból, lekérdezés nélkül azonnal látszik; szakasz-fülek (csak ha a játékos több szakaszban játszott); a meccsenkénti napló 19 oszloppal; a tábla alatt a DNP meccsek indokonként összevonva. Skeleton, hibapanel újrapróbálással, üres állapot. Supabase-hívás a komponensekben nincs (T20).
- **`components/PlayersView.tsx`:** `openedPlayerId` állapot; a megnyitott játékost szezon- vagy csapatváltáskor renderelés közben ejti el (nem effectből). A szakasz-választás közös a listával. **`components/PlayersTable.tsx`:** a név gomb (`onOpenPlayer`), a meglévő `.dt-player-name` osztállyal; a `PlayerCell` opcionális `onOpen` propot kapott (a box score-ban a név továbbra sem kattintható), a monogram-képzés exportálva. **`components/GamesTables.tsx`:** az `OpponentCell` exportálva (viselkedés nem változott).
- **Megvalósítási döntések (jelezve a felhasználónak, részletek a progress-trackerben):** csak a kiválasztott csapat színeiben játszott meccsek; közös szakasz-választás a listával; a kártyák a lista soraiból; a DNP a tábla alatt, indokonként; a meccs-sor nem kattintható; nincs OREB oszlop, összesítő sor és forma-grafikon. Új token, új csomag, séma-változás nincs.
- **Ellenőrzés:**
  - valós DB (service role, csak olvasás), a tényleges `fetchTeamPlayerStats` + `fetchPlayerGameLog`: Lakers 20, Knicks 20, Bulls 28 játékos (68, ebből 21 több csapatnál is játszott) – a napló meccsszáma, kezdéseinek száma és pontösszege minden játékosnál és szakaszban egyezik a szezon-összesítő view sorával; egy játékosnak legfeljebb 102 sora van. Kézzel egyeztetve: Dončić 64 alapszakasz-meccs + 1 DNP („suspended by league”), LeBron James 60 + 10, Reaves 51 + 6 és 3 DNP; a 2026-05-11-i LAL–OKC sorok (Reaves 43 perc, 27 pont, 8/16, 3/7, 8/9) a Meccs-részletek korábbi ellenőrzésével azonosak;
  - **headless Chrome** (csak a scratchpadben; a valódi hook + nézet + a build CSS-e, kicsonkolt Supabase-klienssel, a valós adatbázisból mentett 993 view- és 5655 játékossorral; a csonk csak a kért oszlopokat adja vissza), 64 állítás: a listán minden név gomb, a naplóra megnyitásig nincs lekérdezés; megnyitás → fejléc és kártyák azonnal, skeleton → adat; 1 lekérdezés `season_id` + `player_id` szűréssel; a teljes Dončić-tábla (64 sor × 19 oszlop) és LeBron rájátszás-táblája a nyers sorokból, a nézettől függetlenül újraszámolva; a PTS oszlop átlaga = a kártya; rendezés (szám, bedobott dobás, előjeles +/-, pontkülönbség, harmadik kattintásra időrend); fülváltás lekérdezés nélkül, a szakaszok nem keverednek; vissza → a lista ugyanazon a szakaszon, új lekérdezés nélkül; DNP-összesítő egy és több indokkal; megnyitás billentyűzetről (Enter); csapat- és szezonváltáskor a lista jön vissza, és visszaváltva sem nyílik meg újra; cserélt játékos (Koloko: 2 Lakers-meccs a 27-ből) – csak a Lakers-meccsek; hiba → panel (a fejléc és a kártyák maradnak) → újrapróbálás; verseny (lassú régi válasz eldobva); kép nélküli játékos → monogram; fókusz a vissza gombon, a lap a tetejére ugrik; a konzolban csak a szándékos hiba. Képernyőkép 1440 és 390 px-en átnézve (T32): az oldal nem csordul túl, a tábla a saját konténerében görög (T23);
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** az éles alkalmazásban, bejelentkezve nem futott (nincs teszt-bejelentkezésem). A böngészős tesztben a `next/image` helyén sima `<img>` állt. Le nem zárt meccshez tartozó játékossor és `plus_minus = NULL` pályára lépett játékos a valós adatban nincs, ezek kezelése csak kódból ismert.
- **Megfigyelés:** a DNP-sorok nem fedik le a kihagyott meccseket: az ESPN csak a meccs keretébe nevezett játékost sorolja fel (LeBron James 22 kihagyott alapszakasz-meccséhez egyetlen sor sincs) – ezért a nézet nem ír „kihagyott meccsek” számot. A napló szélesebb az 1440 px-es ablak tartalmi részénél: az utolsó hat–hét oszlop görgetéssel érhető el.

### 2026-10-10 – `useGameBoxScore` + Meccs-részletek (box score) ✓ (éles böngészős próba hátravan)

- **Döntések (felhasználó):** a Meccs-részletek készül el a Játékos-részletek előtt; a részletnézet a nézet saját állapotában él (ASEStats-minta: a lista helyén, „Vissza” gombbal), nincs URL routing és nincs AppShell-szintű állapot.
- **`lib/box-score-data.ts` (új):** `fetchGameBoxScore(db, seasonId, gameId)` – a `player_game_stats` (beágyazott `players` törzsadattal) és a `team_game_stats` sorai, mindkettő `season_id` + `game_id` szűréssel, párhuzamosan; egy meccs kb. 30 sor, lapozás nem kell (T1). `toBoxScoreTeams()`: csapatonként a pályára lépett játékosok (kezdők elöl, majd perc szerint), külön DNP-lista (T8), a csapatsor mint hiteles összeg, és `sumMismatches`: ahol a játékossorok összege eltér a csapatsortól (T19). Valuation a `simpleValuation()`-ből (T22).
- **`hooks/useBoxScoreData.ts` (új):** `useGameBoxScore(seasonId, gameId)` a közös `useSeasonScopedResource()`-ra építve (a második kulcs itt a meccs).
- **`components/GameDetailsView.tsx` + `BoxScoreTables.tsx` (új):** eredmény-fejléc (a `TeamGame`-ből, lekérdezés nélkül azonnal látszik), „Csapatstatisztika” (a két csapatsor mutatónként), csapatonként box score tábla 17 oszloppal, alatta a „Nem lépett pályára” sor, hiányos forrásnál figyelmeztetés. Skeleton, hibapanel újrapróbálással, üres állapot. Supabase-hívás a komponensekben nincs (T20).
- **`components/GamesView.tsx`:** `openedGameId` állapot; a megnyitott meccset szezon- vagy csapatváltáskor renderelés közben ejti el (nem effectből). **`components/GamesTables.tsx`:** sor végi „Box score” gomb a lejátszott meccseknél; a kimenetel-jelvény kiemelve (`GameResultBadges`), a fejléc is ezt használja. **`components/PlayersTable.tsx`:** a `PlayerCell` és a `PositionBadge` exportálva (viselkedés nem változott).
- **Megvalósítási döntések (jelezve a felhasználónak, részletek a progress-trackerben):** minden a kiválasztott csapat nézőpontjából (a csapat áll elöl); csak lejátszott meccs nyitható; a csapatösszeg külön táblában, a csapatsorból; nincs negyedenkénti eredmény (nincs linescore a sémában) és nincs dobástérkép; a DNP indoka az ESPN angol szövege. Új token, új csomag, séma-változás nincs.
- **Ellenőrzés:**
  - valós DB (service role, csak olvasás), a tényleges `fetchTeamGames` + `fetchGameBoxScore`: Lakers 92, Bulls 82, Knicks 102 lezárt meccs – mindenhol 2 csapat, csapatonként 5 kezdő, a kezdők elöl, a csapatsor pontszáma = a meccs végeredménye. A 2026-05-11-i LAL–OKC (110–115) sorai kézzel egyeztetve (Reaves 43 perc, 27 pont, 8/16, 3/7, 8/9; csapat: 38/75, 10/28, 24/27, 37 lepattanó, 19 eladott labda);
  - ligaszintű mérés (34 777 játékossor, 2644 csapatsor): az eladott labdán kívül (1387 eltérés – csapatszintű eladott labdák) a játékossorok összege minden mutatón egyezik a csapatsorral, kivéve 17 csapat-meccset, mind Bulls → a figyelmeztetés nem ad hamis riasztást;
  - **headless Chrome** (csak a scratchpadben; a valódi hook + nézet + a build CSS-e, kicsonkolt Supabase-klienssel, a valós adatbázisból mentett 2522 meccs-, 4432 játékos- és 344 csapatsorral), 67 állítás: a listán 82 „Box score” gomb, lekérdezés nélkül; megnyitás → a fejléc azonnal, skeleton → adat; 1–1 lekérdezés a két táblára `season_id` + `game_id` szűréssel; a fejléc, a csapatstatisztika (a Thunder-oszlop a nyers csapatsorból újraszámolva) és a teljes Reaves-sor; sorrend, kezdő-jelvények, nulla perces játékos, DNP-sor; a PTS oszlop összege = csapatpont; rendezés (szám, bedobott dobás, előjeles +/-, harmadik kattintásra az alapsorrend); vissza → a szakasz megmarad, nincs új lekérdezés; csapatváltáskor a lista jön vissza, és visszaváltva sem nyílik meg újra a meccs; hosszabbításos és idegenbeli meccs; Bulls: figyelmeztetés pont- és csak-gólpassz-eltérésnél is; hiba → panel → újrapróbálás; verseny (lassú régi válasz eldobva); fókusz a vissza gombon, a lap a tetejére ugrik; a konzolban csak a szándékos hiba. Képernyőkép 1440 és 390 px-en: az oldal nem csordul túl, a táblák a saját konténerükben görögnek (T23);
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **A képernyőkép fogta meg:** 390 px-en a fejléc eredménye rálógott a csapatnevekre (javítva: `sm` alatt logó + rövidítés egymás alatt, kisebb eredmény), és a rövidítés „láthatatlan” volt, mert a `text-base` itt szín (új tanulság: T32).
- **Nem ellenőrzött:** az éles alkalmazásban, bejelentkezve nem futott (nincs teszt-bejelentkezésem). A böngészős tesztben a `next/image` helyén sima `<img>` állt. Csapatsor nélküli meccs, logó nélküli csapat és `plus_minus = NULL` pályára lépett játékos a valós adatban nincs, ezek megjelenítése csak kódból ismert.
- **Megfigyelés:** a box score tábla kb. 1250–1330 px széles: 1440 px-es ablakban az utolsó egy-két oszlop (+/-, VAL) görgetéssel érhető el. Az import figyelmeztetése (pontösszeg, FGA-összeg) a 17 hiányos Bulls-meccsből 12-t jelez; a maradék 5-ön a pont és az FGA egyezik, más mutató tér el (a megnézett négy meccsen gólpassz, egyszer személyi hiba is).

### 2026-10-10 – `useTeamPlayerStats` + Játékosok nézet ✓ (éles böngészős próba hátravan)

- **Előfeltétel:** a 003-as migrációt a felhasználó lefuttatta. A Supabase-ben csak olvasva ellenőrizve: a view létezik, `security_invoker = true`, 661 / 240 / 92 sor, 284 604 alapszakasz-pont (egyezik a megírás előtti méréssel), olvasási jog az `authenticated` és a `service_role` szerepnek.
- **`lib/player-data.ts` (új):** az ASEStats `player-stat-mapping` NBA-megfelelője. `fetchTeamPlayerStats(db, seasonId, teamId)` – a view sorai `season_id`-ra, `team_id`-ra és a tárolt szakaszokra szűrve, `fetchAllRows`-szal (T1). `toPlayerSeasonStats()`: összegek → meccsenkénti átlag; FG% / 3P% / FT% / TS% / eFG% az összesített dobásokból (T12), kísérlet nélkül `null`; a kísérletszám a box score-ból jön (`total_fgm` / `total_fga`), nem a close + mid + three összegéből, mint az ASEStatsben; valuation a `simpleValuation()`-ből.
- **`lib/stat-formulas.ts`:** új `shootingPct()` (a dobószázalék is egy helyen él, T22). **`lib/season-types.ts`:** új `orderSeasonTypes()` és `resolveSeasonType()`.
- **`hooks/useSeasonScopedResource.ts` (új):** a szezonra + csapatra szűrt adat közös betöltője – a `useTeamGames` logikája általánosítva (kulcsból származtatott állapot, eldobott régi válasz, `reload()`). **`hooks/usePlayerData.ts` (új):** `useTeamPlayerStats(seasonId, teamId)` erre építve.
- **`components/PlayersView.tsx` + `PlayersTable.tsx` (új):** szakasz-fülek (csak ha több szakasz van), címsor a játékosok számával, magyarázó sor, egy `DataTable` 19 oszloppal. Játékos-cella ESPN-headshottal (`next/image`), kép híján monogram; poszt-jelvény; előjeles, színezett +/-. Skeleton, hibapanel, üres állapot. Supabase-hívás a komponensekben nincs (T20).
- **`app/page.tsx`:** a `players` tabon a `PlayersView`.
- **Megvalósítási döntések (jelezve a felhasználónak, részletek a progress-trackerben):** csapatra szűrt nézet, nem ligás ranglista; minden érték meccsenkénti átlag; alaprendezés PTS csökkenő; nincs percküszöb; az ASEStats saját „Pont hat.” / „Véd. idx” mutatói (T13), a „Forma” sparkline és a névkereső nem került át; a név nem kattintható. Új token, új csomag, séma-változás nincs.
- **Ellenőrzés:**
  - valós DB (service role, csak olvasás), a tényleges `fetchTeamPlayerStats`: Lakers 2025/26 alapszakasz 20 játékos (Dončić: 64 meccs, 35.8 perc, 33.5 pont, FG 47.6%, 3P 36.6%, FT 78.0%, TS 61.6%, eFG 56.3%, VAL 33.5 – kézzel utánaszámolva az összegekből), rájátszás 14; Knicks 20 + 18; Bulls 28; a 30 csapat sorainak összege 993 = a view teljes 2025/26-os tartalma; 2026/27: 0 sor. A PostgREST a `numeric` percösszeget számként adja;
  - **headless Chrome** (csak a scratchpadben; a valódi hook + nézet + a build CSS-e, kicsonkolt Supabase-klienssel, a valós adatbázisból mentett 993 view-sorral), 54 állítás: skeleton → adat; a lekérdezés szűrői (`season_id`, `team_id`, `season_type in (2,5,3)`, `range 0–999`); a teljes Dončić-sor; rendezés (szám, előjeles +/-, név, kísérlet nélküli százalék a végén); fülváltás lekérdezés nélkül, a rájátszás nem keveredik az alapszakasszal; csapatváltáskor a régi sorok eltűnnek, a választott szakasz megmarad, ha van (Knicks), különben alapszakasz, fülek nélkül (Bulls); három szakasz sorrendje (76ers); headshot nélküli játékos → monogram (Grizzlies); 2026/27 → üres állapot; hiba → panel → újrapróbálás; verseny (lassú régi válasz eldobva); törzsadat-betöltés és -hiba alatt nincs lekérdezés; a konzolban csak a szándékos hiba. Képernyőkép 1440 px-en és valódi 390 px-es viewportban (iframe): az oldal nem csordul túl, a tábla a saját konténerében görög (T23);
  - `next start`: a `/_next/image` az `a.espncdn.com` headshotot kiszolgálja (200), más hostot elutasít (400);
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** az éles alkalmazásban, bejelentkezve nem futott (nincs teszt-bejelentkezésem). A böngészős tesztben a `next/image` helyén sima `<img>` állt. `total_plus_minus = NULL` és poszt nélküli játékos a valós adatban nincs, ezek megjelenítése (gondolatjel) csak kódból ismert.
- **Megfigyelés:** a headless Chrome ablaka nem megy 500 px alá – a 390 px-es képhez iframe kell, különben a képernyőkép egy szélesebb elrendezést vág le. A 19 oszlopos tábla kb. 1380 px: 1440 px-es ablakban (240 px-es sidebar mellett) négy oszlop görgetéssel érhető el.

### 2026-10-10 – `useTeamGames` + Mérkőzések nézet ✓ (éles böngészős próba hátravan)

- **`lib/game-data.ts` (új):** `fetchTeamGames(db, seasonId, teamId)` – a csapat összes meccse a szezonban, `season_id`-ra és a csapatra szűrve (`.or(home…, away…)`), időrendben. Egy csapatnak szezononként legfeljebb kb. 110 sora van, ezért nincs lapozás (T1). `toTeamGame()`: a semleges hazai/vendég sorból a csapat nézőpontja (`isHome`, `opponentTeamId`, `teamScore`, `opponentScore`, `result`, `overtimes`). `summarizeRecord()`: mérleg és pontösszeg csak lezárt meccsekből; `seasonTypesOf()`.
- **`lib/season-types.ts` (új):** szezontípus-konstansok, megjelenítési sorrend (alapszakasz → play-in → rájátszás), magyar címkék. **`lib/format-date.ts` (új):** `formatGameDate()` (a keleti parti nap, időzóna-eltolás nélkül), `formatLocalStart()` (kezdés a böngésző helyi idejében).
- **`hooks/useGameData.ts` (új):** `useTeamGames(seasonId, teamId)` → `{ data, loading, error, reload }`. A betöltés állapota a kérés kulcsából (szezon + csapat + próbálkozás) származtatott érték, nincs effectből indított szinkron `setState`; váltáskor a régi adat nem látszik tovább, a későn érkező régi válasz eldobódik. `null` szezonnal vagy csapattal nem kérdez.
- **`components/GamesView.tsx` + `GamesTables.tsx` (új):** szakasz-fülek (csak ha több szakasz van), négy `StatCard` (Mérleg, Hazai, Idegenbeli, Pontkülönbség / meccs), „Következő mérkőzések” (első 5, a láblécben kibontható) és „Lejátszott mérkőzések” `DataTable`. Ellenfél-cella ESPN-logóval (`next/image`). Skeleton, hibapanel, üres állapot. Supabase-hívás a komponensekben nincs (T20). **`components/DataLoadError.tsx` (új):** nézet-szintű hibapanel + toast.
- **`app/page.tsx`:** a `games` tabon a `GamesView`, a többin továbbra is az „épül” kártya.
- **Megvalósítási döntések (jelezve a felhasználónak):** a szakaszok nem keverednek (fülek); a le nem zárt meccsek közül alapból 5 látszik, az elhalasztott / törölt is itt van; a kezdés helyi időben; „HU” a hosszabbítás jele; a sorok nem kattinthatók (a meccs-részletek külön egység); a hook nem gyorsítótáraz. Új token, új csomag, séma-változás nincs.
- **Ellenőrzés:**
  - valós DB (service role, csak olvasás), a tényleges `fetchTeamGames` + `summarizeRecord`: Lakers 2025/26 – 92 meccs, alapszakasz 82 (53–29, hazai 28–13, idegenben 25–16, 9540:9396), rájátszás 10 (4–6); Knicks 83 + 19 (54–29, 16–3, a Cup-döntővel); Bulls 82 (31–51); 2026/27: csapatonként 80 kiírt meccs. Mindenhol időrendben, kezdési idővel és csarnokkal;
  - **headless Chrome** (csak a scratchpadben; a valódi hook + nézet + a build CSS-e, kicsonkolt Supabase-klienssel, a valós adatbázisból mentett 2522 meccs-sorral), 37 állítás: skeleton → adat; kártyaértékek; fülek és fülváltás lekérdezés nélkül; rendezés; hosszabbítás-jelvény; csapatváltáskor a választott szakasz megmarad, ha van (Knicks), különben alapszakasz, fülek nélkül (Bulls); 2026/27: nincs kártya, 5 / 80 sor, kibontás; meccs nélküli csapat → üres állapot; hiba → panel → újrapróbálás; verseny (lassú régi válasz eldobva); a konzolban csak a szándékos hiba. Képernyőképek 1440 és 390 px-en, vízszintes túlcsordulás nélkül (T23);
  - `next start`: a `/_next/image` az `a.espncdn.com` logót kiszolgálja (200), más hostot elutasít (400);
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** az éles alkalmazásban, bejelentkezve nem futott (nincs teszt-bejelentkezésem). A böngészős tesztben a `next/image` helyén sima `<img>` állt; folyamatban lévő, elhalasztott és törölt meccs a valós adatban nincs, ezek jelvénye csak kódból ismert.

### 2026-10-10 – Szezon- és csapatválasztó az AppShellben ✓ (éles böngészős próba hátravan)

- **`lib/selection.ts` (új):** `DEFAULT_SEASON_ESPN_YEAR = 2026` (a tesztelés idejére, döntés: 2026-10-10), `resolveSeason()` (választás → alapértelmezett szezon → legújabb), `resolveTeam()` (választás → követett csapat → első). Tiszta függvények.
- **`hooks/useSeasonTeamSelection.ts` (új):** a törzsadat-hookokra épül; csak a felhasználó választását tárolja (`useState`), a tényleges szezon és csapat ebből és a törzsadatból **származtatott érték** – nincs effectből indított `setState` (az ASEStats `SeasonSelector`-a így állította be az alapértelmezést). Egy `{ seasons, teams, followedTeamId, season, team, selectSeason, selectTeam, loading, error, reload }` objektumot ad; a `reload()` csak a hibás erőforrást tölti újra.
- **`components/SeasonTeamSelector.tsx` (új):** megjelenítő komponens, Supabase-hívás nélkül (T20). Két shadcn `Select` címkével; a követett csapat narancs csillagot kap (Lucide `Star`). Betöltéskor `.skeleton-shimmer` (T21), hibánál inline panel „Újrapróbálás” gombbal + `toast.error`, üres törzsadatnál magyarázó üres állapot. Új token, új csomag nincs.
- **`app/page.tsx`:** a `Home` csak auth guard; a váz (`AppShell`) külön komponens ugyanabban a fájlban, mert a törzsadat-hookok bejelentkezés előtt nem iratkozhatnak fel (anon kulccsal `permission denied`, és a hibaállapot a `reload()`-ig megmaradna). A választó a topbar alatt van, minden tabon.
- **Megvalósítási döntések (jelezve a felhasználónak):** az állapot az ASEStats mintájára az oldal szintjén él (nincs Context, nincs URL-paraméter, nincs localStorage – frissítés után az alapértelmezés jön vissza); a csapat mindig ki van választva (nincs „összes csapat” opció); a csapatok név szerint, logó nélkül.
- **Ellenőrzés:**
  - tiszta logika (11 állítás): 2026-os szezon az alapértelmezés akkor is, ha a 2027 a legújabb; ismeretlen ID → alapértelmezés; nincs követett csapat → az első;
  - valós DB (service role, csak olvasás): 2 szezon (2026/2027, 2025/2026), 30 csapat → alapértelmezés 2025/2026 + Los Angeles Lakers (ESPN `13`);
  - szerveroldali render: betöltés (2 skeleton), hiba (panel + gomb), üres állapot, címke ↔ trigger összekötés;
  - **headless Chrome** (csak a scratchpadben; a valódi hook + komponens + a build CSS-e, kicsonkolt Supabase-klienssel), 23 állítás: elbukó szezon-lekérdezés → hibapanel → újrapróbálás csak a szezonokat kéri újra; két fogyasztó mellett törzsadatonként egy lekérdezés; alapértelmezés a triggerekben; szezon- és csapatváltás billentyűzetről, egymástól függetlenül; váltás nem indít lekérdezést; a konzolban csak a szándékos hiba. Képernyőképen a tokenek rendben (surface, mono trigger, narancs csillag);
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** az éles alkalmazásban, bejelentkezve nem futott (nincs teszt-bejelentkezésem; a közös Auth-hoz nem nyúltam). A 30 csapatos lista görgetése és a mobil elrendezés képen nincs ellenőrizve.
- **Megfigyelés:** a Radix `Select` a kiválasztott értéket szerveroldalon nem rendereli (kliensen, portálon át tölti ki), és a lista bezárása a kilépő animáció végére vár – teszteléskor valós idő kell, a headless Chrome virtuális ideje alatt a lista „nyitva marad”.

### 2026-10-10 – Migráció 003: játékos szezon-összesítő view – megírva, futtatás hátravan

- **Döntések (felhasználó):** a migráció megírható; az alapértelmezett szezon a tesztelés idejére a 2025/26-os; kell külön tabella-tábla. Az előző commitok pusholva (`origin/master` naprakész).
- **`migrations/003-player-season-stats-view.sql` (új):** `nba.player_season_stats_by_season`, `security_invoker = true`, olvasás az `authenticated` és a `service_role` szerepnek. Újrafuttatható (drop + create), táblához nem nyúl.
  - Egy sor = játékos × szezon × szezontípus × csapat: a csapat a meccs-sorból jön (T9), a cserélt játékosnak csapatonként külön sora van; az alapszakasz, a rájátszás és a play-in nem keveredik.
  - DNP sorok nélkül (T8), csak `final` meccsekből.
  - Az összegek neve az ASEStats view-jával egyezik (`total_*`, `games_played`); új: `games_started`, `total_fgm` / `total_fga` (box score), `total_plus_minus`, `season_type`, `team_abbreviation`, `headshot_url`.
  - Kimaradt: `total_valuation` / `avg_valuation` (lineáris, az összegekből a `simpleValuation()` számolja – a képlet egy helyen marad, T22) és `total_fouls_drawn` (az ESPN nem adja).
- **`lib/supabase.ts`:** `Database['nba']['Views']` + `ViewRow<'…'>`.
- **Ellenőrzés:**
  - a view lekérdezése csak olvasva, a valós adatbázison (Supabase MCP, DDL nélkül): 2025/26 alapszakasz 661 sor (582 játékos, 72 több csapatos), rájátszás 240, play-in 92; a pontösszeg és a meccsszám a nyers, nem-DNP sorokéval egyezik (284 604 pont, 26 658 sor); kulcs-duplikáció nincs; a csapatpont-összeg 29 csapatnál egyezik a `team_game_stats`-szal, az egyetlen eltérés a CHI (9509 vs 9537 – az ismert Olbrich-hiány);
  - PGlite (csak a scratchpadben), Supabase-szerű szerepkörökkel, 001 + 002 + 003 (kétszer): 14 állítás – csere → külön sor, rájátszás külön sor, DNP és folyamatban lévő meccs kimarad, csak-DNP játékosnak nincs sora; `authenticated` olvas, `anon` elutasítva, írás a view-n át nem megy, RLS policy nélkül a view üres (invoker jogai); a `public` sémába nem került semmi;
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** a migráció a Supabase-ben még nem futott (Postgres 15; a teszt PGlite-on, Postgres 18-on ment).
- **Megfigyelés:** egy szezon a view-ban 993 sor, közvetlenül az 1000-es PostgREST-limit alatt → a view-ra is kötelező a `fetchAllRows` (T1). Szezonszinten a 661 alapszakasz-sorból 81-nél `close + mid ≠ FGA − 3PA` (a meccsenkénti ±1–3 eltérés összeadódik): kísérletszámhoz a `total_fga` a forrás.

### 2026-10-10 – Közös törzsadat-hookok (T21) ✓

- **`lib/shared-resource.ts` (új):** `createSharedResource()` – React-független, modul-szintű tároló `{ data, loading, error }` állapottal. Az első feliratkozó indítja a betöltést, a többi ugyanazt az állapotot kapja; `reload()` újratölt, a későn érkező régi válasz eldobódik. Hiba után nincs automatikus újrapróbálás (a hibaállapot a `reload()`-ig marad).
- **`lib/master-data.ts` (új):** `fetchSeasons()` (legújabb elöl), `fetchTeams()` (név szerint), `fetchAppSettings()`; a kliens paraméter. Típusok: `Season`, `Team`, `AppSettings` a `Database` típusból (`TableRow<'…'>`, új helper a `lib/supabase.ts`-ben).
- **`hooks/useMasterData.ts` (új):** `useSeasons()`, `useTeams()`, `useFollowedTeam()` – `useSyncExternalStore`-ral olvassák a közös tárolót, `{ data, loading, error, reload }` alakban. A követett csapat a csapat-törzsadatból oldódik fel (`data: null`, ha nincs beállítva).
- **Megvalósítási döntés (jelezve a felhasználónak):** a megosztás modul-szintű tárolóval történik, nem Context providerrel – így nem kell az `app/layout.tsx`-hez nyúlni, és nincs prop-láncolás.
- **Ellenőrzés:**
  - célzott teszt a tárolóra (17 állítás): 3 feliratkozás → 1 betöltés; stabil snapshot-referencia; hiba → magyar hibaüzenet, új feliratkozó nem indít kérést; `reload()` javít; verseny (lassú régi válasz eldobva); újratöltés alatt a régi adat megmarad;
  - valós DB (service role): 2 szezon (2027, 2026), 30 csapat 6 × 5 felosztásban, mindnek van logója, követett csapat: Los Angeles Lakers (ESPN `13`); anon kulccsal mindhárom lekérdezés `permission denied` → hibaág;
  - szerveroldali render: mindhárom hook `loading` állapotot ad, hálózati kérés nélkül;
  - `tsc`, `eslint`, `npm run build` hibátlan.
- **Nem ellenőrzött:** böngészőben, bejelentkezve a hookok még nem futottak – nincs nézet, ami használná őket (a következő egység, a szezon- és csapatválasztó lesz az első).

### 2026-10-01 – Ütemezett napi import (GitHub Actions) – megírva, élesítés hátravan

- **`.github/workflows/ingest.yml` (új):** napi cron 09:00 UTC-kor (10:00 CET) + kézi indítás (`season`, `from`, `to`, `dry_run`).
  - Lépések: env-ellenőrzés (secretek megléte, érték kiírása nélkül) → `npm ci` → `ingest:games --season` → `ingest:schedule`.
  - A meccs-import szezon módban fut (a szezon elejétől a mai napig, a mentett meccset kihagyja), így a kimaradt nap magától pótlódik; a szezon végén kb. 270 scoreboard-kérés, kb. 4,5 perc.
  - A kilépési kódot a workflow nem nyeli el: 1 és 2 is piros futás (T6), a run oldalán `::error` / `::warning` annotációval. A menetrend-lépés a meccs-import hibája után is lefut, hiányzó secret után nem.
  - Szezonév: `NBA_SEASON_YEAR` repo variable, default `2027`. `concurrency` csoport, hogy a kézi és az ütemezett futás ne írjon egyszerre. Node 22, `actions/checkout@v5`, `actions/setup-node@v5`.
  - Az `ingest:standings` kimaradt a napi futásból (a besorolás szezon közben nem változik).
- **`HOWTO-auto-import.md` (új):** beállítás, kézi futtatás, kilépési kódok, gyakori hibaokok, szezonváltás.
- **Ellenőrzés (helyben):**
  - a YAML parse-olható (js-yaml); a lépések szkriptjei a fájlból kiemelve futtatva: hiányzó secret → `::error` + exit 1; stub importtal a 0 / 1 / 2 kód változatlanul továbbmegy, a 2 `::warning`-ot kap;
  - tiszta checkout (`git archive`, `.env.local` nélkül), a két érték csak környezeti változóként: `ingest:games --season 2027` → `2026-09-30 → 2026-10-01`, 0 meccs, exit 0 (előszezon); secret nélkül exit 1;
  - `ingest:schedule --season 2027` élesben: 1200 meccs, exit 0 (idempotens, harmadik futás);
  - az `npm run` a 2-es kódot változatlanul adja tovább.
- **Nem ellenőrzött:** GitHubon a workflow még nem futott (a `gh` nincs bejelentkezve, a secretek nincsenek beállítva, push nem történt). Az első futás dönti el, hogy az ESPN a runner IP-címéről is válaszol.
- **Kimaradt, döntés kell:** tárhely-figyelés (SQL-függvény kellene a projektmérethez → migráció).

### 2026-09-30 – Konferencia és divízió (`ingest-standings.ts`) ✓

- **Kód:** `fetchDivisionStandings()` (`client.ts`, második alap-URL: `apis/v2`); `parseDivisionStandings()` (`schemas.ts`: konferencia → divízió → csapat, üres divízió hiba); `lib/espn/write-teams.ts`: `checkAlignment()` (30 NBA-csapat, egyszer, 2 × 3 × 5 – eltérésnél nincs írás) és `writeTeamAlignment()` (csak a változott sort frissíti, új csapatot nem hoz létre); `ingest-standings.ts` + `npm run ingest:standings`.
- **Értékek:** `conference` = ESPN rövid név (`East` / `West`), `division` = név (`Atlantic`, `Central`, `Southeast`, `Northwest`, `Pacific`, `Southwest`).
- **Ellenőrzés:** célzott teszt (hiányzó + duplikált csapat, All-Star csapat → hibák); dry-run és éles `--season 2027`: 30 csapat változott, a második futás 0 (idempotens); a DB-ben 6 × 5 csapat, a valós NBA-felosztással egyezik. `tsc`, `eslint` hibátlan.

### 2026-09-30 – Menetrend-import (`ingest-schedule.ts`)

- **Tárhely-döntés (felhasználó):** két szezon marad; `migrations/002-season-2027.sql` felveszi a 2026/27-es szezonsort (ESPN ablak: 2026-09-30 – 2027-06-25). Commit `8b4124e`.
- **Kód:** `fetchTeamSchedule()` (`client.ts`, `seasontype` paraméterrel – nélküle az ESPN csak az előszezont adja); `parseTeamSchedule()` (`schemas.ts`); `lib/espn/write-schedule.ts`: `stageSchedule()` (dedup az event ID-re, mert minden meccs két csapat menetrendjében szerepel; státusz; szezon-kapu) és `writeSchedule()` (500-as batch upsert; a `final` / `in_progress` sorokhoz nem nyúl); `requireSeason()` közös a `write-game.ts`-ben; `ingest-schedule.ts` + `npm run ingest:schedule`.
- **Élesítés:** a felhasználó lefuttatta a 002-t; `--season 2027` kétszer: 1200 meccs mindkétszer (idempotens), csapatonként 80, mind `scheduled`, mindnek van kezdési időpontja; a 2025/26 érintetlen (1322 `final`).
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
| T21 | A `seasons` / `teams` törzsadatot 7 komponens kérte le külön-külön | Közös `useSeasons()` / `useTeams()` hook, `{ data, loading, error }` hármassal, `.skeleton-shimmer` töltésjelzéssel | ✓ `hooks/useMasterData.ts`; töltésjelzés a választóban, a nézeteknél kötelező |
| T22 | A TS% / eFG% / valuation képlet 6 helyen volt másolva (javítási sprint, 3. fázis) | A formula csak a `lib/stat-formulas.ts`-ben lehet | ✓ átvéve |

### UI

| # | Mi történt az ASEStatsben | Szabály az NBAStatsben | Állapot |
|---|---|---|---|
| T23 | A sidebar bevezetése után a széles táblák vízszintesen túlcsordultak, mert a grid-cella min-content szélességű (elemzések reszponzivitás) | A `.app-shell > main` és a `.grid > *` `min-width: 0` szabályát nem szabad kivenni | ✓ `globals.css` |
| T24 | Redesign után maradtak `slate-*` / `sky-*` / `violet-*` osztályok. 10 helyen hiányzott a szóköz két class között (`border-border-subtlebg-…`), így egyik sem hatott (token audit) | Csak tokenek; minden class-lista `cn()`-en át, szóközzel | Szabály |
| T32 | *(NBAStats, 2026-10-10)* A `text-base` osztály betűméret helyett a szöveg színét állította a háttérszínre: a `@theme inline` `--color-base` tokenje miatt itt ez szín-utility. A felirat „eltűnt”, a `tsc`, az `eslint` és a DOM-alapú teszt nem jelezte, csak a képernyőkép | A `text-base` kizárólag színként használható (pl. sötét szöveg narancs gombon). Új nézetnél a képernyőképet is át kell nézni, nem elég a DOM-állítás | ✓ szabály a CLAUDE.md-ben |
| T33 | *(NBAStats, 2026-10-24)* A hiányzó liga-benchmark `?? 0`-val 0-ként átment a `Number.isFinite` őrön: „Liga medián 0,0%”, „vs liga +67 pp”. A `baseline.kind === 'season'` kis mintánál, referencia nélkül is igaz volt, így az 1 másik meccs „szezonátlagként” szerepelt | Hiányzó értéket nem pótolunk 0-val: `null` / `undefined`, és az oszlop elmarad. A referencia-ágat a `comparable` kapuzza, nem a `kind`. A tartalék referencia mindig jelölt becslés | ✓ `getLeagueMedian`, `hasSeasonReference` |
| T34 | *(NBAStats, 2026-10-24)* Az új, alacsonyabb küszöbű „enyhe” tényező szintetikus teszten jónak látszott, de a valós adaton kiszorította vagy ellentmondta a referencia-alapú tényezőt (FTM rate előjele megfordult) | Új küszöb / szabály előtt-után diff valós meccseken; az enyhe jelzés csak hézagot tölt ki | ✓ |
| T35 | *(NBAStats, 2026-10-26)* A `vercel link` kérdés nélkül hozzáfűzött egy `VERCEL_OIDC_TOKEN` sort a `.env.local`-hoz; a `NEXT_PUBLIC_*` + kulcs-szerű érték `vercel env add`-dal `--type` nélkül nem mentődik (action_required) | Link után a `.env.local` végét ellenőrizni kell (a CLI-blokkot a felhasználó törli). Böngészőbe szánt kulcs `--type config`, szerveroldali titok `--type secret` | Szabály |

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
