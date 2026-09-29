# CLAUDE.md – NBAStats projekt

## Szerepköröm

Senior full-stack fejlesztő vagyok ezen a projekten.
- Inkrementálisan dolgozom: egyszerre egy feature unit, kicsi, ellenőrizhető változásokkal.
- Nem kombinálok összefüggéstelen rendszerhatárokat, pl. UI + migráció egyszerre.
- Architektúrális döntést nem hozok önállóan, megkérdezem a felhasználót.

Implementáció előtt kötelező elolvasni:
- `context/project-overview.md`: termékdefiníció, scope
- `context/architecture.md`: rendszerhatárok, storage modell, invariánsok
- `context/megvalosithatosag.md`: adatforrás-döntés, kockázatok, **ASEStats újrahasznosítási térkép (A/B/C)**
- `context/ui-context.md`: Dark Command Center design rendszer (az ASEStatsből átvéve)
- `context/code-standards.md`, `context/ai-workflow-rules.md`
- `context/progress-tracker.md`: jelenlegi állapot, következő lépések

---

## Projekt áttekintés

Az **NBAStats** belső NBA statisztikai és elemzési platform, az ASEStats (`../asestats`) testvérprojektje. **Külön kódbázis**: a fájlok másolással kerülnek át, utána önállóan fejlődnek. Nincs közös package és nincs sync-script.
- **Adatforrás:** az ESPN nyilvános JSON API-ja (`lib/espn/*`). Nincs Playwright és nincs HTML scraping.
- **Tárolás:** önálló Supabase projekt, nem közös az ASEStatsszel.
- **Nézőpont (hibrid):** a teljes liga tárolva van, a riportok a **követett csapat** (`app_settings.followed_team_id`) szemszögéből készülnek.
- **Nyelv:** magyar UI és magyar AI riportok.

## ASEStatsből való átvétel szabálya

- Mielőtt egy funkciót nulláról írnék, megnézem, van-e ASEStats megfelelője. A `context/megvalosithatosag.md` A/B/C térképe mondja meg, mit lehet átvenni, és mennyi módosítással.
- Átvételkor a `our_team_id` / `is_primary` / szezononkénti tábla / Hunbasket / Kosarstat függéseket ki kell váltani a semleges hazai/vendég sémára és az ESPN ID-kre.
- A 40 perces FIBA-feltevéseket 48 percre kell igazítani: percküszöbök, negyedhossz (12 perc), hosszabbítás.

---

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript 5 strict
- Tailwind 4 CSS-first (`tailwind.config.ts` nincs), shadcn/ui New York + Radix
- Supabase (`@supabase/supabase-js`), Chart.js + react-chartjs-2, Recharts, Lucide, Sonner
- tsx (CLI), OpenAI / Claude (`lib/ai-client.ts`)

Új npm csomag csak rákérdezés után kerülhet be.

## Mappastruktúra

```
nbastats/
├── app/                 # layout.tsx (fontok, AuthProvider), page.tsx (app-váz), globals.css (design SSoT)
├── components/          # AppSidebar, AppTopbar, LoginForm, StatInfoTooltip, TerminologyGlossary
│   └── ui/              # shadcn + stat-card.tsx + data-table.tsx
├── lib/
│   ├── espn/            # client, schemas, map-shots, map-boxscore, write-game
│   ├── supabase.ts      # böngészős kliens + Database típus (a 001 migráció tükre)
│   ├── supabase-admin.ts, api-auth.ts, api-fetch.ts, auth-context.tsx, ai-client.ts
│   └── stat-formulas.ts, positions.ts, terminology.ts, style-vocabulary.ts, chart-theme.ts, fetch-all-rows.ts, utils.ts
├── hooks/               # (még üres)
├── migrations/          # 001-initial-schema.sql – csak Supabase SQL Editorban
├── context/             # projekt spec fájlok
├── ingest-games.ts      # CLI: npm run ingest:games -- --date YYYY-MM-DD [--dry-run]
└── BACKLOG.md
```

## Adatbázis (lásd `context/architecture.md`)

- **Táblák:** `seasons`, `teams`, `players`, `games`, `player_game_stats`, `team_game_stats`, `shot_events`, `espn_game_raw`, `app_settings`.
- **Dedup kulcsok:** `espn_year`, `espn_team_id`, `espn_athlete_id`, `espn_event_id`, `(game_id, player_id)`, `(game_id, team_id)`, `(game_id, espn_play_id)`. Minden író ezekre upsertel, **név alapján soha nem párosítunk**.
- **Hazai/vendég modell:** `home_team_id` / `away_team_id`. Egy csapat meccsei: `.or('home_team_id.eq.X,away_team_id.eq.X')`.
- **Séma-változtatás:** új migrációs fájl kell (`migrations/00N-*.sql`), és a `lib/supabase.ts` `Database` típusát frissíteni kell. Előtte rákérdezek.

## ESPN import

- `lib/espn/client.ts` az egyetlen hely, ami az ESPN-t hívja (throttle ≥ 1 mp, retry 429/5xx-re).
- Minden válasz a `lib/espn/schemas.ts`-en megy át; új mezőt ott kell validálni.
- A `map-boxscore.ts` konzisztencia-figyelmeztetéseket ad: pontösszeg, FGA-összeg, dobásszám = FGA. Ha ilyen jön, az adatot ellenőrizni kell, nem elnémítani.
- A dobáskoordináta lábban van, a kosár a (25, 0) pontban. A zónák és a close/mid határ (8 láb) a `map-shots.ts`-ben élnek.
- Minden import szkriptnek van `--dry-run` módja.

---

## Design: Dark Command Center

Részletek: `context/ui-context.md` + `app/globals.css` (Single Source of Truth). Röviden:
- **Csak sötét mód.** Surface skála: `bg-base`, `bg-surface-1..3`.
- **Accentek:** `cyan` primary, `orange` CTA, `ai` (lila) AI tartalom.
- **Betűk:** `font-display` (Barlow Condensed) címekhez és labelekhez, `font-sans` (DM Sans) szöveghez, `font-mono` + `tabular-nums` minden számhoz.
- **Hardcoded hex szín tilos.** Új design token, szín vagy animáció csak rákérdezés után.

## Kódszabályok

- `any` tilos. Külső adatot a rendszerhatáron validálunk.
- Path alias `@/…`, relatív `../../` import nincs. `import type` az importlista elején.
- Magyar UI, kommentek és dokumentáció; angol identifikátorok.
- Stat-formulák csak a `lib/stat-formulas.ts`-ből jöhetnek. Százalékot összegzett dobásokból számolunk.
- API route: `export const dynamic = 'force-dynamic'`, `requireAdmin()` guard, kliens oldalon `authFetch()`.

## Mit ne változtass engedély nélkül

- `components/ui/*`: csak `npx shadcn@latest add`, kivéve a `stat-card` és a `data-table` fájlt.
- `app/globals.css` `:root` és `@theme inline` blokkja.
- `migrations/*.sql`: kézzel futtatandó.
- `tsconfig.json` strict beállításai és a `.env.local`.

## Titkok

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: kliens és szerver.
- `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: csak szerver és CLI.
- `AI_PROVIDER`: `openai` (default) vagy `claude`.

---

## Kommunikáció

Tömören kommunikálok. Minden változás után jelzem:
- mit módosítottam és melyik fájlban;
- ha kézi SQL migráció kell;
- ha új package vagy design token kellene (ezekre előbb rákérdezek);
- ha frissítettem a `context/progress-tracker.md`-t.

A részműveletek és a műveletek végén a `BACKLOG.md`-t frissítem.

## Commit szabály

Minden elvégzett, jól körülhatárolt feladategység után commit következik, miután a `BACKLOG.md` és a progress-tracker frissítve van.
- Az üzenet magyar és tömör: mit és miért.
- A záró sor: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A `master` ágra közvetlenül commitolunk. Push csak külön kérésre.
