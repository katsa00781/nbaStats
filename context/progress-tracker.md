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

## Kézi teendők (felhasználó)

1. Új Supabase projekt létrehozása, majd a `migrations/001-initial-schema.sql` lefuttatása az SQL Editorban.
2. A `.env.local` kitöltése a `.env.local.example` alapján, a `SUPABASE_SERVICE_ROLE_KEY`-jel együtt.
3. Első éles import: `npm run ingest:games -- --date 2025-03-01`. Ezt egy második futtatással érdemes megismételni; a sorszám nem nőhet.
4. Admin felhasználó: a Supabase Auth-ban `user_metadata.role = "admin"`.

## Következő lépések (roadmap)

1. **Ingest teljesítése:**
   - `ingest-games.ts --season` visszatöltés;
   - `ingest-schedule.ts` a jövőbeli meccsekhez;
   - `ingest-standings.ts` a konferencia- és divízióadatokkal;
   - GitHub Actions cron naponta 10:00 CET-kor.
2. **Adat-hookok és alapnézetek:** Mérkőzések, Játékosok, Játékos-részletek, Csapatstatisztika, Tabella. Ide tartozik a `player_season_stats_by_season` view is (migráció 002).
3. **Elemző motorok portolása** (B-lista, lásd `context/megvalosithatosag.md`): adapterek az NBA sémáról a motorok bemeneti típusaira, a percküszöbök 48 percre skálázása.
4. **AI riportok:** pregame, postgame, játékos és csapat. Kell hozzá a riport táblák migrációja (003) és a követett csapatra paraméterezett promptok.
5. **NBA dobástérkép-geometria** és zóna heatmap.
6. **Opcionális:** play-by-play (win probability, run-ok, clutch). Ehhez Supabase tier-döntés kell.

## Nyitott kérdések

- Hány szezont töltsünk vissza? Javaslat: 3, a free tier miatt.
- Melyik legyen a követett csapat (`app_settings.followed_team_id`)?
