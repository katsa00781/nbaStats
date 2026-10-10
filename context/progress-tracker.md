# Progress Tracker

## Jelenlegi állapot

**0. fázis kész (2026-09-29):** projekt-alap és bizonyított adatút.

- Repó felállítva az ASEStats configjaiból; a függőségek ugyanazok, Playwright nélkül.
- Átmásolva a Dark Command Center design, a `components/ui/*`, az auth és az AI-kliens, valamint a domain-független `lib` modulok. A branding NBAStats-ra cserélve.
- Az app-váz kész (`app/page.tsx`): auth guard, sidebar és topbar. A nézetek helyén „épül” üzenet áll.
- Alapséma: `migrations/001-initial-schema.sql`.
- ESPN adapter (`lib/espn/*`) és `ingest-games.ts --date [--dry-run]`.
  - A dry-run a 2025-03-01-i 6 meccsen 6/6-os eredményt adott, konzisztencia-figyelmeztetés nélkül.
  - Ellenőrizve: pontösszeg, FGA-összeg, dobásszám = FGA, close+mid = kétpontos kísérlet.
- `npx tsc --noEmit`, `eslint` és `npm run build` hibátlan.
- A `CLAUDE.md` tartalmazza az ASEStats teljes, NBA-ra igazított szabályrendszerét.
- A `BACKLOG.md` részei: feladatok, fejlesztési történet és 30 ASEStats-tanulság (T1–T30). A tanulságokból három új teendő lett az ingesthez: szezon-kapu, dobás-dedup, nem-nulla exit figyelmeztetésnél.

**Adatbázis-előkészítés kész (2026-09-29):** migráció 002.

- A nyers ESPN JSON gzip-elt `bytea`-ként tárolódik (`espn_game_raw.payload_gz`, `lib/espn/raw-payload.ts`): kb. 38 KB/meccs 368 KB helyett.
- A szezon az ESPN szezonablakával előre fel van véve; ez a szezon-kapu (T4) alapja.
- Követett csapat: Los Angeles Lakers (ESPN `13`).
- Ellenőrzés: gzip round-trip egy valódi summary-n (azonos JSON, újra-parse figyelmeztetés nélkül), `tsc`, `lint`, `build` hibátlan. A SQL-t helyi Postgres hiányában nem futtattam; az első futás a Supabase-ben lesz.

**Adatbázis-elhelyezés átdöntve (2026-09-30):** `nba` séma a közös `ugkettlebell` projektben.

- Az első futtatás kiderítette, hogy a `.env.local` az ASEStats projektjére (`ugkettlebell`) mutat. A 001 ott `column "game_date" does not exist` hibával elbukott, mert az ASEStats `games` táblája miatt a `create table if not exists` kimaradt. A tranzakció visszagördült, ellenőrizve: NBA-tábla nem maradt a `public` sémában.
- Harmadik Supabase projekt fizetős lenne (kb. 20 USD/hó), ezt a felhasználó nem vállalja; a Synology DS218play adatbázisnak alkalmatlan.
- Döntés (felhasználó): saját `nba` séma az `ugkettlebell` projektben, és csak a 2025/2026-os szezon.
- Mérés: egy summary gzip-elve kb. 38 KB, 150–180 mezőnydobás. Egy szezon kb. 130–170 MB, az ASEStats 129 MB mellett kb. 260–300 MB lesz az 500-ból.
- **Kész:** a 001 + 002 összevonva egy `nba.`-minősített `migrations/001-initial-schema.sql`-be (csak a 2026-os szezon, jogosultságok az `nba` sémára); a 002 törölve.
- **Kész:** `lib/db-schema.ts` (`createNbaClient()`, `NbaClient`); a böngészős, az admin és a CLI kliens ezen át az `nba` sémát használja. A `Database` típus kulcsa `nba`.
- Ellenőrzés: a migráció PGlite-on (Postgres 17.5), Supabase-szerű szerepkörökkel és ütköző `public.games` táblával kétszer lefutott; a `public` érintetlen, az `authenticated` olvas, de nem ír, az `anon` nem olvas, a `service_role` ír (identity táblákba is). `tsc`, `eslint`, `build` hibátlan.
- Első éles import (2026-03-01): idempotens, a projekt 130 MB.
- Heave és ESPN ID nélküli játékos kezelve (2026-09-30): a kihagyott heave nem kerül a dobások közé, az ID és statisztika nélküli sor `ℹ` tájékoztatással kimarad. A 2026-03-01-i nap 11/11 meccse figyelmeztetés nélkül bent van.
- **2025/26-os szezon betöltve és javítva (2026-09-30):** 1322 meccs (alapszakasz 1231 a Cup-döntővel, rájátszás 85, play-in 6), 30 csapat, 234 884 dobás; az `nba` séma kb. 130 MB (projekt: 259 / 500 MB). Az All-Star meccsek törölve, a hosszú dobások javítva, a ±3-ig terjedő dobás/FGA eltérés `ℹ`. Maradék `⚠`: Olbrich hibás ESPN-rekordja (12 CHI-meccs).
- Szezon-kapu, dedup és exit kód kész (T4, T5, T6, 2026-09-30): az import nem hoz létre szezont, a szezonon kívüli meccset írás előtt elutasítja, az előszezont kihagyja; exit 0 / 1 / 2 összesítővel.

- **Ütemezett napi import megírva (2026-10-01):** `.github/workflows/ingest.yml` (09:00 UTC = 10:00 CET) + `HOWTO-auto-import.md`. Lépések: `ingest:games --season` (a szezon elejétől a mai napig, a mentett meccset kihagyja), majd `ingest:schedule`. A 2-es kilépési kód is piros futás. Helyben ellenőrizve (tiszta checkout, `.env.local` nélkül); **GitHubon még nem futott**: ehhez secretek és push kell (lásd Kézi teendők 6.).

- **Közös törzsadat-hookok kész (2026-10-10):** `useSeasons()`, `useTeams()`, `useFollowedTeam()` (`hooks/useMasterData.ts`), modul-szintű közös tárolóval (`lib/shared-resource.ts`) és a lekérdezésekkel (`lib/master-data.ts`). Akárhány komponens hívja, egy lekérdezés fut (T21). Ellenőrizve: tároló-teszt, valós DB-olvasás (2 szezon, 30 csapat, Lakers), `tsc`, `eslint`, `build`. **Böngészőben még nem futott:** nincs nézet, ami használná.

- **Migráció 003 kész (2026-10-10):** `nba.player_season_stats_by_season` view (játékos × szezon × szezontípus × csapat, DNP nélkül, csak lezárt meccsekből, `security_invoker`), a `Database` típusban `Views` + `ViewRow`. A felhasználó lefuttatta; a Supabase-ben ellenőrizve (csak olvasva): a view létezik, `security_invoker = true`, 661 / 240 / 92 sor, olvasási jog az `authenticated` és a `service_role` szerepnek.

- **Szezon- és csapatválasztó kész (2026-10-10):** `SeasonTeamSelector` a topbar alatt, minden tabon; állapota a `useSeasonTeamSelection()` hookban (`lib/selection.ts`: alapértelmezés 2025/26 + követett csapat). A választás az oldal szintjén él, frissítés után az alapértelmezés jön vissza. A `page.tsx`-ben a `Home` csak auth guard, a váz (`AppShell`) külön komponens. Ellenőrizve: logika, valós DB-alapértelmezés (2025/2026 + Lakers), headless Chrome (23 állítás, kicsonkolt klienssel), `tsc`, `eslint`, `build`. **Élesben, bejelentkezve még nem futott** (lásd Kézi teendők 8.).

- **Mérkőzések nézet kész (2026-10-10):** `useTeamGames()` (`hooks/useGameData.ts`, `lib/game-data.ts`) + `GamesView` a `games` tabon – a szezon- és csapatválasztó első fogyasztója. Szakaszonként (alapszakasz / play-in / rájátszás) külön mérleg-kártyák, a le nem zárt meccsek (első 5, kibontható) és a lejátszott meccsek táblája. Ellenőrizve: valós DB (Lakers 2025/26: 82 meccs, 53–29; rájátszás 4–6), headless Chrome valós adatokkal (37 állítás), képoptimalizáló az ESPN-logókra, `tsc`, `eslint`, `build`. **Élesben, bejelentkezve még nem futott** (lásd Kézi teendők 9.).

- **Játékosok nézet kész (2026-10-10):** `useTeamPlayerStats()` (`hooks/usePlayerData.ts`, `lib/player-data.ts`) + `PlayersView` a `players` tabon – a szezon-összesítő view első fogyasztója. A kiválasztott csapat játékosai szakaszonként (alapszakasz / play-in / rájátszás) külön: meccsenkénti átlagok, dobószázalékok az összesített dobásokból, TS%, eFG%, valuation, +/-. Új közös betöltő a szezonra + csapatra szűrt adathoz: `useSeasonTeamResource()`. Ellenőrizve: valós DB (Lakers 2025/26: 20 + 14 játékos, Dončić 33.5 pont; a 30 csapatra 993 sor = a view teljes szezonja), headless Chrome valós adatokkal (54 állítás), képoptimalizáló az ESPN-headshotokra, `tsc`, `eslint`, `build`. **Élesben, bejelentkezve még nem futott** (lásd Kézi teendők 10.).

- **Meccs-részletek kész (2026-10-10):** `useGameBoxScore()` (`hooks/useBoxScoreData.ts`, `lib/box-score-data.ts`) + `GameDetailsView` a Mérkőzések nézeten belül – az első lekérdezés a `player_game_stats` és a `team_game_stats` táblára. A „Lejátszott mérkőzések” sor végi „Box score” gombja a lista helyén nyitja meg: eredmény-fejléc, csapatstatisztika (a csapatsorból), a két csapat box score-ja (kezdők elöl), DNP-sor, hiányos forrásnál figyelmeztetés. Döntések (felhasználó): Meccs-részletek a Játékos-részletek előtt; a részletnézet a nézet saját állapota (nincs URL). Ellenőrizve: valós DB (Lakers 92, Bulls 82, Knicks 102 meccs: mindenhol 2 csapat, 5–5 kezdő, csapatsor = végeredmény; ligaszinten 2644 csapatsorból 17-nél tér el a játékosok összege, mind Bulls), headless Chrome valós adatokkal (67 állítás), `tsc`, `eslint`, `build`. **Élesben, bejelentkezve még nem futott** (lásd Kézi teendők 11.).

## Kézi teendők (felhasználó)

1. ~~A 001 futtatása és az `nba` séma kitétele a Data API-ra~~: kész (2026-09-30). Az Exposed schemas a Project Settings → Data API oldalon van.
2. ~~Első éles import + ismétlés~~: kész (2026-03-01, 11/11 meccs, idempotens).
3. A `.env.local` 8. sorának javítása: az `ANTHROPIC_API_KEY` értéke után hiányzik a sortörés, a végére ragadt `NEXT_PUBLIC_SUPABASE_URL=` maradékot törölni kell. A Supabase-változók maradhatnak (`ugkettlebell`).
4. ~~Migráció 002 + menetrend-import~~: kész (2026-09-30).
5. Admin felhasználó: az Auth közös az ASEStatsszel, így a meglévő ASEStats admin (`user_metadata.role = "admin"`) itt is admin.
6. **Ütemezett import élesítése** (`HOWTO-auto-import.md`, 1. pont):
   - két repo secret a GitHubon: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`;
   - ~~push a `master` ágra (a workflow csak az `origin`-on él, T7)~~: kész (2026-10-10);
   - első próba kézzel, `dry_run` bepipálva (Actions → *Adatimport (ESPN)* → Run workflow).
7. ~~Migráció 003 futtatása~~: kész (2026-10-10; a view él, 2: 661, 3: 240, 5: 92).
8. **A szezon- és csapatválasztó kipróbálása böngészőben:** `npm run dev`, bejelentkezés → a topbar alatt 2025/2026 és Los Angeles Lakers (csillaggal) az alapértelmezés, a csapatlistában 30 csapat, a konzol hibamentes.

9. **A Mérkőzések nézet kipróbálása böngészőben:** `npm run dev`, bejelentkezés → *Liga → Mérkőzések*. Várt: 2025/2026 + Lakers mellett Alapszakasz / Rájátszás fül, mérleg 53–29 (hazai 28–13, idegenben 25–16), 82 sor csapatlogókkal; 2026/2027-re váltva 5 kiírt meccs és „Összes megjelenítése”; a konzol hibamentes.

10. **A Játékosok nézet kipróbálása böngészőben:** `npm run dev`, bejelentkezés → *Analitika → Játékosok*. Várt: 2025/2026 + Lakers mellett Alapszakasz / Rájátszás fül, 20 játékos headshottal, legfelül Luka Doncic (33.5 PTS); Rájátszás: 14 játékos, legfelül LeBron James (23.2 PTS); 2026/2027-re váltva üres állapot („még nincs lejátszott mérkőzése”); a konzol hibamentes.

11. **A Meccs-részletek kipróbálása böngészőben:** `npm run dev`, bejelentkezés → *Liga → Mérkőzések* → Rájátszás fül → a 2026. 05. 11-i sor végén „Box score”. Várt: fejléc Lakers 110–115 Thunder (V), csapatstatisztika (LAL mezőny 38/75, 50.7%), a Lakers táblájában 10 játékos, legfelül Austin Reaves (43 perc, 27 pont, „K” jelvény), alatta 4 név a „Nem lépett pályára” sorban; „Vissza a mérkőzésekhez” → a Rájátszás fül marad; csapatot váltva a lista jön vissza; a konzol hibamentes. Chicago Bulls → 2026. 02. 01.: sárga figyelmeztetés a tábla fölött (PTS 82/91).

## Következő lépések (roadmap)

1. **Ingest teljesítése:**
   - ~~előbb a T4/T5/T6 teendők~~: kész (2026-09-30);
   - ~~`ingest-games.ts --season` visszatöltés~~: kész, 2025/26 betöltve;
   - ~~`ingest-schedule.ts` a jövőbeli meccsekhez~~: kész, a 2026/27 menetrendje (1200 meccs) bent van;
   - ~~`ingest-standings.ts` a konferencia- és divízióadatokkal~~: kész (2026-09-30);
   - ~~GitHub Actions cron naponta 10:00 CET-kor~~: megírva (2026-10-01), élesítés a felhasználónál (secretek + push).
2. **Adat-hookok és alapnézetek:** Mérkőzések, Játékosok, Játékos-részletek, Csapatstatisztika, Tabella. Ide tartozik a `player_season_stats_by_season` view is (migráció 003).
   - ~~közös törzsadat-hookok (`useSeasons`, `useTeams`, `useFollowedTeam`)~~: kész (2026-10-10);
   - ~~migráció 003 (`player_season_stats_by_season` view)~~: megírva (2026-10-10), futtatás a felhasználónál;
   - ~~szezon- és csapatválasztó az AppShellben (alapértelmezés: 2025/26 + követett csapat)~~: kész (2026-10-10), éles böngészős próba a felhasználónál;
   - ~~`useGameData` + Mérkőzések nézet (a választó első fogyasztója)~~: kész (2026-10-10), éles böngészős próba a felhasználónál;
   - ~~`usePlayerData` + Játékosok nézet (a `player_season_stats_by_season` view első fogyasztója)~~: kész (2026-10-10), éles böngészős próba a felhasználónál;
   - ~~Meccs-részletek (box score) a Mérkőzések nézetben~~: kész (2026-10-10), éles böngészős próba a felhasználónál;
   - következő: Játékos-részletek (meccsenkénti napló a `player_game_stats`-ból; a Játékosok tábla nevéből nyílik, a Meccs-részletek mintájára a nézet saját állapotával);
   - külön refaktor lépés: a `useTeamGames` és a `GamesView` szakaszválasztása a közös `useSeasonTeamResource()` / `orderSeasonTypes()` / `resolveSeasonType()` helperekre; a közös betöltő semleges átnevezése (már meccsre is használjuk); a `PlayerCell` / `PositionBadge` saját fájlba;
   - a Tabella nézet előtt: tabella-tábla (új migráció, a séma egyeztetése után) + az `ingest-standings.ts` bővítése.
3. **Elemző motorok portolása** (B-lista, lásd `context/megvalosithatosag.md`): adapterek az NBA sémáról a motorok bemeneti típusaira, a percküszöbök 48 percre skálázása.
4. **AI riportok:** pregame, postgame, játékos és csapat. Kell hozzá a riport táblák migrációja (004) és a követett csapatra paraméterezett promptok.
5. **NBA dobástérkép-geometria** és zóna heatmap.
6. **Opcionális:** play-by-play (win probability, run-ok, clutch). Ehhez Supabase tier-döntés kell.

## Eldöntött kérdések (2026-09-29)

- Visszatöltés: ~~az utolsó 3 szezon~~ → **a 2025/26-os szezon** (2026-09-30); a 2026/27 napi importtal épül, mindkettő marad, alapszakasz + play-in + rájátszás, előszezon nélkül.
- Követett csapat: Los Angeles Lakers.
- Nyers JSON: gzip `bytea` (free tier marad).
- Adatbázis: ~~önálló Supabase projekt~~ → **`nba` séma az ASEStats `ugkettlebell` projektjében** (2026-09-30). A migrációkat a felhasználó futtatja.

## Eldöntött kérdések (2026-10-10)

- Alapértelmezett szezon a választóban: **2025/26**, a tesztelés idejére (a 2026/27-nek 2026-10-20-ig nincs lejátszott meccse). Az alapértelmezett csapat a követett csapat.
- Migráció 003 megírható; a felhasználó futtatja.
- Tabella: **kell külön tabella-tábla** (kiemelés, GB, sorozat, clinch).

- Sorrend: **Meccs-részletek** a Játékos-részletek előtt.
- Részletnézet megnyitása: **a nézet saját állapota** (ASEStats-minta) – a lista helyén, „Vissza” gombbal; nincs URL routing és nincs AppShell-szintű állapot.

## Nyitott kérdések

- **A választás megőrzése:** most frissítés után az alapértelmezés jön vissza (az ASEStats is így működik). Ha kell, hogy a böngésző megjegyezze (localStorage), az külön döntés.
- **Ligaszintű nézetek és a csapatszűrő:** a csapat most mindig ki van választva. A Tabella és a ligás Játékosok nézetnél el kell dönteni, hogy a szűrő ott rejtve van, kiemelésre szolgál, vagy kap „összes csapat” opciót.
- **Mérkőzések nézet – megvalósítási döntések, felülbírálhatók:**
  - a „Következő mérkőzések” alapból az első 5 meccset mutatja; az elhalasztott és a törölt meccs is itt szerepel (státusz-jelvénnyel), nem tűnik el;
  - a kezdés a böngésző helyi idejében látszik, a dátum az amerikai keleti parti nap (`game_date`);
  - a hosszabbítás jele „HU” / „2HU” (hosszabbítás után);
  - a kártyák: Mérleg, Hazai, Idegenbeli, Pontkülönbség / meccs (győzelmi arány nincs, az a Tabellára kerül);
  - a sorok nem kattinthatók: a meccs-részletek (box score) külön egység;
  - az NBA Cup döntője (semleges helyszín) az ESPN szerinti pályaválasztónál „Hazai” meccsként számít.
- **Játékosok nézet – megvalósítási döntések, felülbírálhatók:**
  - a nézet a kiválasztott csapat játékosait mutatja (nem ligás ranglista); a szezon közben igazolt játékosnál csak az adott csapatnál játszott meccsek számítanak. A ligaszintű játékoslista a fenti „ligaszintű nézetek” kérdés eldöntése után külön egység;
  - 19 oszlop (M, K, MIN, PTS, REB, AST, STL, BLK, TOV, FG%, 3P%, FT%, TS%, eFG%, VAL, +/-), mind meccsenkénti átlag, a +/- is. A tábla kb. 1380 px széles: 1440 px-es ablakban az utolsó négy oszlop (TS%, eFG%, VAL, +/-) vízszintes görgetéssel érhető el;
  - alaprendezés: PTS csökkenő (az ASEStatsben VAL; itt a VAL oszlop keskenyebb ablakban nem látszik görgetés nélkül);
  - nincs percküszöb: a 2 meccset játszó játékos is szerepel, és a százalékoknál elöl is végezhet (kis minta, T15);
  - az ASEStats „Pont hat.” / „Véd. idx” saját mutatói (T13) és a „Forma” sparkline nem került át; a névkereső sem (egy csapatnak 15–33 sora van);
  - a név nem kattintható: a játékos-részletek külön egység;
  - a poszt-jelvény színe az ESPN G / F / C rövidítésének első illeszkedő posztját követi (G → PG, F → SF színe);
  - a mezszám, a poszt és a kép a játékos-törzsadat aktuális értéke, nem a csapatnál töltött időszaké.
- **Meccs-részletek – megvalósítási döntések, felülbírálhatók:**
  - a nézet a kiválasztott csapat nézőpontjából mutat mindent (a csapat áll elöl a fejlécben, a csapatstatisztikában és a box score-ok sorrendjében), nem a hagyományos vendég–hazai sorrendben;
  - csak lejátszott meccs nyitható meg; a megnyitó a sor végi „Box score” gomb, nem a teljes sor;
  - a csapatösszeg a csapatsorból jön (külön „Csapatstatisztika” tábla), a box score táblának nincs összesítő sora;
  - a box score 17 oszlopa: MIN, PTS, FG, 3P, FT (bedobott/kísérlet), OREB, REB, AST, STL, BLK, TOV, PF, +/-, VAL; DREB, százalék és TS% / eFG% nincs benne;
  - a nulla perces, de pályára lépett játékos (szezononként kb. 130 sor) a táblában marad, a DNP külön sorban áll a tábla alatt;
  - a DNP indoka az ESPN angol szabad szövege kisbetűvel (228-féle); csak a „COACH'S DECISION” van lefordítva („edzői döntés”);
  - negyedenkénti eredmény nincs: a `games` táblában nincs linescore (séma-bővítés + import-változtatás kellene – külön döntés);
  - dobástérkép nincs a nézetben (roadmap 5.);
  - a játékosnév nem kattintható (a játékos-részletek külön egység);
  - a box score nem gyorsítótárazott: minden megnyitás 2 lekérdezés (kb. 30 sor).
- **Meccs-lekérdezés gyorsítótára:** a `useTeamGames` nem tárol; csapat- vagy szezonváltáskor (és a tabra visszalépve) újra lekérdez (kb. 100 sor). Ha zavaró, kulcsolt közös tároló kell – az adatréteg-döntés.
- **Tabella-tábla sémája:** a döntés megvan (kell külön tábla, 2026-10-10), de az oszlopokat (kiemelés, GB, sorozat, clinch, hazai/idegen mérleg, utolsó 10) a migráció megírása előtt egyeztetni kell.
- **Alapértelmezett szezon hosszú távon:** most a 2025/26-os (tesztelés); a 2026/27 indulása (2026-10-20) után felül kell vizsgálni.
- **Tárhely-figyelés a napi futásban:** a projektméretet (`pg_database_size`) a service role csak SQL-függvényen át tudja lekérdezni (PostgREST RPC). Ehhez új migráció kell (pl. `nba.project_size_bytes()`), ami séma-változtatás → döntés kell. Alternatíva: marad a kézi ellenőrzés a Supabase dashboardon.
