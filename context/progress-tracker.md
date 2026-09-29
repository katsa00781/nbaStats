# Progress Tracker

## Jelenlegi állapot

**0. fázis kész (2026-09-29):** projekt-alap és bizonyított adatút.

- Repó felállítva az ASEStats configjaiból; a függőségek ugyanazok, Playwright nélkül.
- Átmásolva a Dark Command Center design, a `components/ui/*`, az auth és az AI-kliens, valamint a domain-független `lib` modulok. A branding NBAStats-ra cserélve.
- Az app-váz kész (`app/page.tsx`): auth guard, sidebar és topbar. A nézetek helyén „épül” üzenet áll.
- Alapséma: `migrations/001-initial-schema.sql`. **Még nincs lefuttatva**: kézzel kell, egy új Supabase projektben.
- ESPN adapter (`lib/espn/*`) és `ingest-games.ts --date [--dry-run]`.
  - A dry-run a 2025-03-01-i 6 meccsen 6/6-os eredményt adott, konzisztencia-figyelmeztetés nélkül.
  - Ellenőrizve: pontösszeg, FGA-összeg, dobásszám = FGA, close+mid = kétpontos kísérlet.
- `npx tsc --noEmit`, `eslint` és `npm run build` hibátlan.
- A `CLAUDE.md` tartalmazza az ASEStats teljes, NBA-ra igazított szabályrendszerét.
- A `BACKLOG.md` részei: feladatok, fejlesztési történet és 30 ASEStats-tanulság (T1–T30). A tanulságokból három új teendő lett az ingesthez: szezon-kapu, dobás-dedup, nem-nulla exit figyelmeztetésnél.

**Adatbázis-előkészítés kész (2026-09-29):** migráció 002.

- A nyers ESPN JSON gzip-elt `bytea`-ként tárolódik (`espn_game_raw.payload_gz`, `lib/espn/raw-payload.ts`): kb. 38 KB/meccs 368 KB helyett. Így 3 szezon belefér a free tierbe.
- A három visszatöltendő szezon (2023/24, 2024/25, 2025/26) az ESPN szezonablakával előre fel van véve; ez a szezon-kapu (T4) alapja.
- Követett csapat: Los Angeles Lakers (ESPN `13`).
- Ellenőrzés: gzip round-trip egy valódi summary-n (azonos JSON, újra-parse figyelmeztetés nélkül), `tsc`, `lint`, `build` hibátlan. A SQL-t helyi Postgres hiányában nem futtattam; az első futás a Supabase-ben lesz.

## Kézi teendők (felhasználó)

1. Új Supabase projekt létrehozása, majd az SQL Editorban sorban: `migrations/001-initial-schema.sql`, `migrations/002-raw-gzip-seasons-followed-team.sql`.
   - Ellenőrzés: `select espn_year, start_date, end_date from seasons;` → 3 sor; `select t.abbreviation from app_settings s join teams t on t.id = s.followed_team_id;` → `LAL`.
2. A `.env.local` kitöltése a `.env.local.example` alapján, a `SUPABASE_SERVICE_ROLE_KEY`-jel együtt.
3. Első éles import: `npm run ingest:games -- --date 2025-03-01`. Ezt egy második futtatással érdemes megismételni; a sorszám nem nőhet.
4. Admin felhasználó: a Supabase Auth-ban `user_metadata.role = "admin"`.

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

- Visszatöltés: az utolsó 3 szezon (2023/24, 2024/25, 2025/26), alapszakasz + play-in + rájátszás, előszezon nélkül.
- Követett csapat: Los Angeles Lakers.
- Nyers JSON: gzip `bytea` (free tier marad).
- A Supabase projektet a felhasználó hozza létre, és ő futtatja a migrációkat.

## Nyitott kérdések

- Nincs.
