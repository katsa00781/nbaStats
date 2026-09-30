# Megvalósíthatósági vizsgálat és újrahasznosítási térkép

Készült: 2026-09-29, az ASEStats (`../asestats`) kódbázis és az élő NBA-adatforrások vizsgálata alapján.

## Döntések

| Kérdés | Döntés |
|---|---|
| Fókusz | **Hibrid**: teljes liga (30 csapat) tárolva, egy **követett csapat** nézőpontjából készülnek a riportok |
| Újrahasznosítás | **Másolás + önálló fejlődés**: nincs monorepo és nincs sync-script, a kódbázis az ASEStatstől függetlenül él |
| Nyelv | Magyar UI + magyar AI szöveg |
| Adatmélység v1 | Box score + dobástérkép; teljes play-by-play később |

## Verdikt: megvalósítható, és az adatoldal egyszerűbb, mint az ASEStatsnél

### Adatforrás (élesben ellenőrizve)

| Forrás | Állapot | Szerep |
|---|---|---|
| ESPN site API (`site.api.espn.com/apis/site/v2/sports/basketball/nba/…`) | 200, kulcs nélkül | **Elsődleges** |
| cdn.nba.com / stats.nba.com | 403 / timeout (Akamai bot-védelem) | Nem használható megbízhatóan |
| balldontlie.io | API-kulcs kell, a box score fizetős | Tartalék |
| basketball-reference | A ToS tiltja a scrapinget | Nem használjuk |

Az ESPN `summary` végpont tartalma:
- **Box score:** MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-. Mellette `starter`, `didNotPlay`, `reason` és stabil `athlete.id`.
- **Play-by-play:** meccsenként kb. 440 esemény.
- **Dobások:** kb. 180 mezőnydobás, mindegyik koordinátával.
- **Win probability:** minden eseményhez tartozik érték.

**Dobáskoordináták.** A mértékegység láb, a kosár a (25, 0) pontban van. A mezőnydobások szövegében szereplő távolsággal átlagosan 0,7 láb az eltérés. A büntetők koordinátája érvénytelen (≈ -2^31), ezeket az import kiszűri.

**PoC eredménye (2025-03-01, 6 meccs).**
- 12/12 csapatnál a játékospont-összeg egyezik a csapatponttal.
- A játékosok FGA-összege egyezik a csapat FGA-val.
- A dobás-események száma pontosan az FGA.
- Minden játékosnál close + mid = kétpontos kísérlet.

### Miért könnyebb

- **Nincs Playwright és nincs HTML-parse.** Sima `fetch` elég, így GitHub Actionsben és serverlessben is fut.
- **Stabil ESPN azonosító minden entitásra.** A teljes ASEStats névillesztési réteg elhagyható: `player-name-match`, `cleanPlayerName`, `TEAM_NAME_ALIASES`, tükörsor-linkelés.
- **Egy forrás van kettő helyett.** Nincs Hunbasket↔Kosarstat párosítás.

### Kockázatok

1. **Nem hivatalos API.** A formátum változhat, a felhasználási feltételek sem egyértelműek. Belső, nem publikus appnál ez vállalható. Védekezés:
   - a `lib/espn/schemas.ts` validál, és pontos útvonallal jelzi az eltérést;
   - a nyers JSON az `espn_game_raw` táblába kerül, így formátumváltáskor újra lehet parse-olni letöltés nélkül.
2. **A koordináta felbontása 1 láb.** Zónákhoz és scatter charthoz elég, finom hotspot-elemzéshez nem.
3. **Adatmennyiség.**
   - Egy szezon kb. 1320 meccs, ebből kb. 34e játékos-sor és 225e dobás, összesen kb. 50–60 MB.
   - Mérés (2026-09-30): egy summary gzip-elve kb. 38 KB, 150–180 mezőnydobással. Egy szezon a nyers JSON-nal együtt kb. 130–170 MB.
   - A free tier 500 MB-ja közös az ASEStatsszel (az ASEStats 129 MB). Mérés a betöltés után: egy szezon kb. 130 MB, így két szezon fér el (2026-09-30). Teljes play-by-play-jel már fizetős tier kellene.
4. **Visszatöltés.** Szezononként kb. 1320 hívás; 1 kérés/mp tempóval kb. 25 perc.

## Újrahasznosítási térkép (ASEStats → NBAStats)

**A – átmásolva változtatás nélkül (0. fázisban megtörtént)**
- `app/globals.css`, és az `app/layout.tsx` fontbeállítása
- `components/ui/*`
- `lib/`:
  - `utils`, `chart-theme`, `stat-formulas`, `positions`, `fetch-all-rows`
  - `ai-client`, `api-auth`, `api-fetch`, `auth-context`, `supabase-admin`
  - `terminology`, `style-vocabulary`
- `LoginForm`, `AppSidebar`, `AppTopbar`: ezekben csak a branding cserélődött
- `StatInfoTooltip` (az ORtg/DRtg leírás átírva csapatszintűre), `TerminologyGlossary`

**B – átveendő kis paraméterezéssel (roadmap 3–5. lépés)**
- **Elemző motorok:** `postgame-report`, `pregame-scouting`, `team-analysis`, `player-analysis`.
  - Percentilis-alapúak és per-36 normalizálnak, a `pregame-scouting` már `ownTeamId`-t kap.
  - Kiveendő belőlük: `buildKosarstatPostgameContext` és a Kosarstat clutch importok.
- **`player-postgame`:** a percküszöbök 40 percre vannak hangolva (26/12 perc, MVP ≥ 22 perc). 48 percre ×1,2-vel kell skálázni, konstansba kiemelve.
- **`situational-analysis`:** kell hosszabbítás-negyed bucket, és a `kosarstat_game_id` kulcsot cserélni kell.
- **`dashboard-types`, `player-stat-mapping`:** a close/mid/three bontás marad. A close/mid adat itt a dobáskoordinátákból jön, ≤ 8 láb számít közelinek.
- **Valuation:** a `simpleValuation()` NBA-adatból is számolható, így a `valPct` és a `valPer36` változatlanul működik.
- **Chartok:**
  - `PostgameShotScatterChart`: NBA-geometria kell (sarokhármas 22 láb, ív 23,75 láb);
  - `PostgameZoneHeatmapChart`, `PlayerTrends`: minimális módosítás.
- **`export-to-md`:** a Kosarstat-függés kivétele.
- **AI route-ok (`generate-*`):** a struktúra marad. A promptokban „ASE” → követett csapat, „NB I” → „NBA”.

**C – csak minta, újraírandó**
- `useGameData`, `useFilterData`, `season-tables`: itt egy tábla van `season_id`-val, és a séma semleges hazai/vendég.
- Az összes scraper és `*Import.tsx`, valamint `kosarstat-*`, `player-movements`, `player-name-match`.
- A `our_team_id` / `is_primary` köré épült komponensek: `TeamSelector`, `GameManagement`, `TeamComparison`, `SituationalAnalysis`, `GameDetails`, `PlayerDetails`, `StandingsView`.
- A `SeasonComparison.tsx` (17 941 sor) nem kerül át; kisebb nézetekre bontva épül újra.
