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
- Első éles import (2026-03-01): 10/11 meccs, idempotens, a projekt 130 MB. Két ingest-probléma nyitott (lásd `BACKLOG.md`): ESPN ID nélküli játékos (MIL–CHI), és a heave-dobás, ami nem számít FGA-nak (5 figyelmeztetés).

## Kézi teendők (felhasználó)

1. ~~A 001 futtatása és az `nba` séma kitétele a Data API-ra~~: kész (2026-09-30). Az Exposed schemas a Project Settings → Data API oldalon van.
2. ~~Első éles import + ismétlés~~: kész (2026-03-01, 10/11 meccs, idempotens).
3. A `.env.local` 8. sorának javítása: az `ANTHROPIC_API_KEY` értéke után hiányzik a sortörés, a végére ragadt `NEXT_PUBLIC_SUPABASE_URL=` maradékot törölni kell. A Supabase-változók maradhatnak (`ugkettlebell`).
4. Admin felhasználó: az Auth közös az ASEStatsszel, így a meglévő ASEStats admin (`user_metadata.role = "admin"`) itt is admin.

## Következő lépések (roadmap)

1. **Ingest teljesítése:**
   - előbb a T4/T5/T6 teendők (`BACKLOG.md`);
   - `ingest-games.ts --season` visszatöltés;
   - `ingest-schedule.ts` a jövőbeli meccsekhez;
   - `ingest-standings.ts` a konferencia- és divízióadatokkal;
   - GitHub Actions cron naponta 10:00 CET-kor.
2. **Adat-hookok és alapnézetek:** Mérkőzések, Játékosok, Játékos-részletek, Csapatstatisztika, Tabella. Ide tartozik a `player_season_stats_by_season` view is (migráció 002).
3. **Elemző motorok portolása** (B-lista, lásd `context/megvalosithatosag.md`): adapterek az NBA sémáról a motorok bemeneti típusaira, a percküszöbök 48 percre skálázása.
4. **AI riportok:** pregame, postgame, játékos és csapat. Kell hozzá a riport táblák migrációja (003) és a követett csapatra paraméterezett promptok.
5. **NBA dobástérkép-geometria** és zóna heatmap.
6. **Opcionális:** play-by-play (win probability, run-ok, clutch). Ehhez Supabase tier-döntés kell.

## Eldöntött kérdések (2026-09-29)

- Visszatöltés: ~~az utolsó 3 szezon~~ → **csak a 2025/26-os szezon** (2026-09-30), alapszakasz + play-in + rájátszás, előszezon nélkül.
- Követett csapat: Los Angeles Lakers.
- Nyers JSON: gzip `bytea` (free tier marad).
- Adatbázis: ~~önálló Supabase projekt~~ → **`nba` séma az ASEStats `ugkettlebell` projektjében** (2026-09-30). A migrációkat a felhasználó futtatja.

## Nyitott kérdések

- A 2026/27-es NBA-szezon (október vége) előtt tárhely-döntés kell: a régi szezon törlése, vagy költözés (pl. saját szerver, lásd `BACKLOG.md`).
