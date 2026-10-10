# Backlog

Utolsó frissítés: 2026-10-10

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
- [ ] **A 003 futtatása (felhasználó):** `migrations/003-player-season-stats-view.sql` a Supabase SQL Editorban (`ugkettlebell`)
- [x] Közös törzsadat-hookok: `useSeasons()`, `useTeams()`, `useFollowedTeam()` (T21) – `hooks/useMasterData.ts` (2026-10-10)
- [x] Szezon- és csapatválasztó az AppShellben (a törzsadat-hookok első fogyasztója). Alapértelmezés: a 2025/26-os szezon (döntés: 2026-10-10, a tesztelés idejére) és a követett csapat – `SeasonTeamSelector` + `useSeasonTeamSelection()` (2026-10-10)
- [ ] **A választó ellenőrzése böngészőben, bejelentkezve (felhasználó):** `npm run dev` → a topbar alatt 2025/2026 + Los Angeles Lakers (csillaggal), 30 csapat a listában, a konzol hibamentes
- [x] `useGameData`: `useTeamGames(seasonId, teamId)` a semleges hazai/vendég sémára (T20) – `hooks/useGameData.ts` + `lib/game-data.ts` (2026-10-10)
- [x] Alapnézet: **Mérkőzések** (`GamesView`, DataTable + StatCard) – 2026-10-10
- [ ] **A Mérkőzések nézet ellenőrzése böngészőben, bejelentkezve (felhasználó):** *Liga → Mérkőzések* → 2025/2026 + Lakers: 53–29, 82 sor logókkal; 2026/2027: 5 kiírt meccs + „Összes megjelenítése”
- [ ] `usePlayerData` a `player_season_stats_by_season` view-ra, `fetchAllRows`-szal (T1, T20) – előfeltétel: a 003 futtatása
- [ ] Alapnézetek: Játékosok, Játékos-részletek, Meccs-részletek (box score), Csapatstatisztika, Tabella (DataTable / StatCard)
- [ ] A `SeasonTeamSelector` hibapanelje a közös `DataLoadError` komponensre cserélhető (most két azonos kinézetű megvalósítás van; külön, tisztán refaktor lépés)
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
- Olbrich (CHI) ESPN-rekordja ID és statisztika nélküli, de 12 meccsen játszott: ezeken a CHI játékossorainak összege kisebb a csapatsornál (a csapatsor helyes). Az ESPN javításáig ez `⚠`.
- Az NBA Cup döntője alapszakasz-meccsként bent van (NY, SA: 83 meccs).

---

## 2. Fejlesztési történet

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
