# CLAUDE.md – NBAStats projekt

## Szerepköröm

Senior full-stack fejlesztő vagyok ezen a projekten. Ismerem az architektúrát, az adatbázissémát, az ESPN import logikáját és a UI konvenciókat.
- Inkrementálisan dolgozom: egyszerre egy feature unit, kicsi, ellenőrizhető változásokkal.
- Nem kombinálok összefüggéstelen rendszerhatárokat (pl. UI + migráció egyszerre).
- Architektúrális döntést nem hozok önállóan, megkérdezem a felhasználót.

A részletes context fájlok itt találhatók, implementáció előtt el kell olvasni őket:
- `context/project-overview.md`: termékdefiníció, scope
- `context/architecture.md`: rendszerhatárok, storage modell, invariánsok
- `context/megvalosithatosag.md`: adatforrás-döntés, kockázatok, **az ASEStats újrahasznosítási térképe (A/B/C)**
- `context/ui-context.md`: téma, színek, komponens konvenciók (Dark Command Center)
- `context/code-standards.md`: implementációs szabályok
- `context/ai-workflow-rules.md`: workflow és scoping szabályok
- `context/progress-tracker.md`: jelenlegi állapot, következő lépések
- `BACKLOG.md`: feladatok, fejlesztési történet, **tanulságok az ASEStatsből** (T1–T30). Egy terület fejlesztése előtt el kell olvasni a rá vonatkozó tanulságokat.

---

## Projekt áttekintés

Az **NBAStats** belső NBA statisztikai és elemzési platform, az ASEStats (`../asestats`, magyar NB I, ASE) testvérprojektje. Az alkalmazás:
- automatikusan gyűjti a meccsadatokat az **ESPN nyilvános JSON API-jából** (`lib/espn/*`, sima `fetch`, Playwright nélkül);
- Supabase (PostgreSQL) adatbázisban tárolja őket, **saját `nba` sémában, az ASEStatsszel közös `ugkettlebell` projektben** (a free tier 2 projektes korlátja miatt). Az Auth és a felhasználók közösek, a táblák nem;
- Next.js dashboardon jeleníti meg őket, szezon és csapat szerinti szűréssel;
- **hibrid nézőpontból** dolgozik: a teljes ligát (30 csapat) tárolja, de a pregame scouting és a postgame AI riportok a **követett csapat** (`app_settings.followed_team_id`) szemszögéből készülnek. A többi csapat adja a benchmarkokat;
- magyar UI-t és magyar nyelvű AI riportokat ad (OpenAI / Claude);
- csak bejelentkezett, belső felhasználóknak érhető el.

### Viszony az ASEStatsszel

- **Külön kódbázis.** A fájlok másolással kerülnek át, utána önállóan fejlődnek. Nincs közös package, nincs sync-script, és nincs mobil szinkron-kötelezettség.
- Mielőtt egy funkciót nulláról írnék, megnézem, van-e ASEStats megfelelője. A `context/megvalosithatosag.md` A/B/C térképe mondja meg, mit lehet átvenni, és mennyi módosítással.
- Átvételkor ezeket kell kiváltani a semleges hazai/vendég sémára és az ESPN ID-kre:
  - `our_team_id` / `is_primary`;
  - a szezononkénti stat-táblák (`season-tables`);
  - a Hunbasket-, Kosarstat- és névillesztés-függések.
- A 40 perces FIBA-feltevéseket 48 percre kell igazítani: percküszöbök, 12 perces negyedek, hosszabbítás-bucket.
- Az ASEStatsben már meghozott szakmai döntéseket átvesszük, ha a felhasználó nem dönt másként. Ezek: Oliver-féle TO%, közös birtoklásszám, USG%, kis minta referencia. Lásd `BACKLOG.md`, T14–T18.

---

## Design rendszer: "Dark Command Center"

Az UI egységes, sportos, telemetria-érzetű sötét felület, változatlanul átvéve az ASEStatsből. Részletek: `context/ui-context.md` + `app/globals.css`.

**Vizuális identitás:**
- Sötétkék mély háttér (`#050B14`), felfelé világosodó surface skála.
- Cián accent (`#00D4FF`) primary; narancs (`#FF6B35`) CTA / kiemelés; lila (`#7C3AED`) AI-generált tartalom.
- Pont-rács háttér (`radial-gradient`), finom telemetria-glow-k.
- 3 betűcsalád szigorú szereposztással (lásd lentebb).
- Glow-alapú interakció: hover/focus → cián fény, nem színváltás.

**Single Source of Truth:** `app/globals.css`. A `:root` blokkban vannak a nyers tokenek, az `@theme inline` blokkban Tailwind utility-vé konvertálva.
- **A színeket komponensben nem definiáljuk újra.**
- A projekt CSS-first: `tailwind.config.ts` **nem létezik**, színt és fontot csak a `globals.css`-be lehet írni.

**Navigáció:** AppShell.
- `AppSidebar`: a `NAV_GROUPS` csoportok (Analitika / Liga / Admin), összecsukható, `Cmd/Ctrl+B`.
- `AppTopbar`: breadcrumb, user-chip, kijelentkezés.
- Az `activeTab` tiszta `useState`, nincs URL routing. Új nézet = új `NAV_GROUPS` elem + tartalom-komponens.

---

## Tech Stack

| Réteg | Technológia | Verzió |
|-------|-------------|--------|
| Framework | Next.js App Router | ^16.0.10 |
| UI | React | ^19.2.1 |
| Nyelv | TypeScript, strict mode | ^5 |
| Stílus | Tailwind CSS (CSS-first, `@theme inline`) | ^4 |
| Komponens könyvtár | shadcn/ui (New York stílus) + Radix UI, globals.css override-okkal | – |
| Adatbázis | Supabase (PostgreSQL) | @supabase/supabase-js ^2.93.1 |
| Auth | Supabase Auth (email/jelszó) | – |
| Chart | Chart.js + react-chartjs-2 | ^4.5.1 / ^5.3.1 |
| Chart | Recharts | ^3.4.1 |
| Ikonok | Lucide React (stroke 1.5–1.8) | ^0.553.0 |
| Adatforrás | ESPN site API (`fetch`, kulcs nélkül) | – |
| CLI script runner | tsx | ^4.20.6 |
| Toast | Sonner | ^2.0.7 |
| AI szöveggenerálás | OpenAI (gpt-4.1-mini) / Anthropic (Claude), fetch-alapú | – |
| Linter | ESLint 9 (next/core-web-vitals) | ^9 |
| Animációk | tw-animate-css + saját `@keyframes` | ^1.4.0 |
| CSS utility | clsx + tailwind-merge (`cn()`) | – |
| CVA | class-variance-authority | ^0.7.1 |
| Fontok | Barlow Condensed · DM Sans · JetBrains Mono (next/font/google) | – |

**Playwright nincs a projektben, és nem is kell.** Új npm csomag csak rákérdezés után kerülhet be.

---

## Mappastruktúra

```
nbastats/
├── app/
│   ├── globals.css             # Design tokenek + @theme inline + shadcn override + animációk + AppShell
│   ├── layout.tsx              # next/font: Barlow Condensed / DM Sans / JetBrains Mono · AuthProvider · Toaster
│   └── page.tsx                # AppShell + auth guard + tab routing (a nézetek a roadmap 2. lépésében)
├── components/
│   ├── ui/                     # shadcn/ui – NE MÓDOSÍTSD kézzel (kivéve stat-card, data-table)
│   │   ├── badge, button, card, input, label, select, tabs, textarea, tooltip
│   │   ├── stat-card.tsx       # KPI / metrika kártya
│   │   └── data-table.tsx      # generikus sortolható tábla (ColumnDef<T>)
│   ├── AppSidebar.tsx, AppTopbar.tsx, LoginForm.tsx
│   └── StatInfoTooltip.tsx, TerminologyGlossary.tsx
├── lib/
│   ├── espn/
│   │   ├── client.ts           # az EGYETLEN ESPN-hívó: throttle ≥ 1 mp, retry 429/5xx
│   │   ├── schemas.ts          # rendszerhatár-validáció (unknown → típusos), EspnSchemaError
│   │   ├── map-shots.ts        # koordináta → távolság / zóna / close-mid (CLOSE_MAX_FT = 8)
│   │   ├── map-boxscore.ts     # summary → staged sorok ESPN ID-kkel + konzisztencia-figyelmeztetések
│   │   ├── raw-payload.ts      # nyers summary ↔ gzip bytea hex literál (espn_game_raw.payload_gz)
│   │   ├── season-gate.ts      # szezon-kapu (T4): szezontípus-szűrés + dátumablak
│   │   └── write-game.ts       # upsert service role klienssel, ESPN ID → UUID feloldás
│   ├── db-schema.ts            # DB_SCHEMA = 'nba', createNbaClient() + NbaClient – MINDEN Supabase kliens ezen át
│   ├── supabase.ts             # böngészős kliens (globalThis singleton) + Database típus
│   ├── supabase-admin.ts       # getSupabaseAdmin() – service role, csak szerver
│   ├── api-auth.ts             # requireAdmin() / requireAuth() guard
│   ├── api-fetch.ts            # authFetch() – Supabase token az API hívásokhoz
│   ├── auth-context.tsx        # AuthProvider, useAuth() (user, loading, isAdmin, signIn, signOut)
│   ├── ai-client.ts            # callAi(), AI_GENERATED_BY
│   ├── stat-formulas.ts        # kanonikus TS% / eFG% / valuation + formatPercent
│   ├── fetch-all-rows.ts       # lapozó helper a PostgREST 1000 soros limit ellen
│   ├── positions.ts, terminology.ts, style-vocabulary.ts, chart-theme.ts
│   └── utils.ts                # cn()
├── hooks/                      # adatlekérési hookok (még üres – T20/T21)
├── migrations/                 # SQL – csak Supabase SQL Editorban
├── context/                    # projekt spec és kontextus fájlok
├── ingest-games.ts             # CLI: npm run ingest:games -- --date YYYY-MM-DD [--dry-run]
├── BACKLOG.md
└── .env.local                  # titkos változók – soha nem kerül git-be
```

---

## Adatbázis táblák (Supabase PostgreSQL)

A séma a `migrations/001-initial-schema.sql`-ben van, **minden tábla az `nba` Postgres sémában**. A TS-tükre a `lib/supabase.ts` `Database` típusa.

| Tábla | Tartalom | Dedup kulcs |
|-------|---------|-------------|
| `seasons` | Szezonok; az `espn_year` a záró év (2026 = 2025/2026, ez az egyetlen betöltött szezon) | `espn_year` |
| `teams` | Csapatok (név, rövidítés, konferencia, divízió, logó) | `espn_team_id` |
| `players` | Játékos-törzsadat (név, pozíció, mez, headshot). A csapattagság NEM itt van | `espn_athlete_id` |
| `games` | Meccsek: `home_team_id`, `away_team_id`, `home_score`, `away_score`, `status`, `season_type`, `game_date` (US Eastern) | `espn_event_id` |
| `player_game_stats` | Játékos box score (egyetlen tábla `season_id`-val), `team_id` meccsenként, `did_not_play`, close/mid a dobásokból | `(game_id, player_id)` |
| `team_game_stats` | Csapat box score + paint / fast break / off-TO pont | `(game_id, team_id)` |
| `shot_events` | Mezőnydobások: nyers x/y lábban (kosár a (25, 0) pontban), `distance_ft`, `zone`, `shot_value`, `made` | `(game_id, espn_play_id)` |
| `espn_game_raw` | Nyers summary JSON gzip-elt `bytea`-ként (`payload_gz`, `lib/espn/raw-payload.ts`), újra-parse-oláshoz | `espn_event_id` |
| `app_settings` | Egysoros tábla: `followed_team_id` (Los Angeles Lakers, ESPN `13`) | `id = true` |

- **Séma-izoláció (közös projekt):** a `public` sémában az ASEStats táblái élnek, köztük 6 azonos nevű (`seasons`, `teams`, `players`, `games`, `player_game_stats`, `team_game_stats`).
  - Minden NBAStats SQL `nba.`-minősített; migráció a `public` sémához nem nyúlhat.
  - Minden Supabase kliens a `createNbaClient()`-tel jön létre (`lib/db-schema.ts`, `db: { schema: 'nba' }`); közvetlen `createClient()` nem lehet. A kliens típusa `NbaClient`.
  - Az `nba` séma a Supabase Dashboardon ki van téve az API-ra (Settings → API → Exposed schemas).
- **Tárhelykeret:** a free tier 500 MB-ja közös az ASEStatsszel (2026-09-30: ASEStats 129 MB; egy NBA szezon becslése kb. 130–170 MB). Egyszerre egy NBA szezont tárolunk; a következő szezon előtt tárhely-döntés kell.
- **Hazai/vendég modell, nincs `our_team_id`.** Egy csapat meccsei: `.or(`home_team_id.eq.${id},away_team_id.eq.${id}`)`.
- **Név alapján soha nem párosítunk entitást.** Minden író ESPN-azonosítóra épülő kulcsra upsertel.
- **Szezonon belüli csere:** a játékos csapata a `player_game_stats.team_id`-ből jön, nem a `players` táblából.
- **RLS:** minden táblán SELECT a bejelentkezett felhasználóknak. Írás csak service role-lal.
- **Séma-változtatás:** új `migrations/00N-*.sql` fájl kell (kézi futtatás), és a `lib/supabase.ts` `Database` típusát frissíteni kell. Előtte rákérdezek.

---

## Fejlesztési filozófia

- **Feature-by-feature:** egyszerre egy jól körülhatárolt fejlesztési egységen dolgozom.
- **Server Components az alapértelmezés:** `'use client'` csak ott, ahol böngésző API vagy hook kell.
- **Egyszerű és olvasható kód:** a UI logika, az adatfeldolgozás és az API hívások külön fájlban élnek. A komponens nem kérdez közvetlenül Supabase-t, erre hook van (T20).
- **Magyar UI, angol kód:** a kommentek és a dokumentáció magyar, az identifikátorok angolok.
- **Inkrementális változások:** kis, ellenőrizhető lépések, nagy spekulatív refaktorálás nélkül.
- **Design tokenek tisztelete:** minden szín, font és spacing CSS változón keresztül megy. Hardcoded hex vagy px érték a komponensekben nem lehet.
- **Kis komponensek:** egy komponens egy nézet vagy egy felelősség. Az ASEStats `SeasonComparison` (18k sor) hibáját nem ismételjük (T20).

---

## Döntési szabályok

**Mit ne változtass engedély nélkül:**
- `components/ui/*`: shadcn/ui generált fájlok, csak `npx shadcn@latest add`-del módosíthatók. Kivétel a projekt-szintű `stat-card.tsx` és `data-table.tsx`.
- `app/globals.css` `:root` és `@theme inline` blokkja: a design rendszer Single Source of Truth-a, csak design döntés nyomán bővíthető.
- `migrations/*.sql`: a Supabase SQL Editorban futtatandó, nem a kódbázisból.
- `tsconfig.json`: a strict mode beállításai nem módosíthatók.
- `app/layout.tsx`: csak az AuthProvider, a fontkonfiguráció vagy a metadata változásakor.
- `.env.local`: soha nem módosítandó az implementáció részeként.
- `lib/espn/schemas.ts` validációs szigora: hibát nem nyelünk el, és konzisztencia-figyelmeztetést nem némítunk el.

**Mikor kérdezz rá:**
- Új npm csomag hozzáadása előtt.
- Adatbázisséma módosítása előtt.
- Új design token bevezetése előtt (új szín, új fontméret, új animáció).
- Architektúrális döntés előtt (pl. state kezelés, route szerkezet, mutációk hookba szervezése).
- Ha egy követelmény nincs egyértelműen definiálva a context fájlokban.
- Szakmai metrika-definíció eltérésekor az ASEStatstől (TO%, FT rate, USG%, birtoklás).
- Ha egy stílusfeladat funkcionális változtatást igényelne (jelezni kell, külön döntés kell hozzá).

---

## UI szabályok – Dark Command Center

### Téma és színrendszer

- **Téma:** csak sötét mód. A `<html>` elemen `className="dark"`, a `<body>`-n `bg-base text-primary`.
- **Surface skála** (mélységi rétegekben):
  - `bg-base` (`#050B14`): oldal háttér
  - `bg-surface-1` (`#0A1628`): card alap
  - `bg-surface-2` (`#0F1F3D`): hover, popover, input
  - `bg-surface-3` (`#162440`): nested elem, aktív tab háttér
- **Accentek:**
  - `text-cyan` / `bg-cyan` (`#00D4FF`): primary, fókusz, link, aktív állapot
  - `text-orange` / `bg-orange` (`#FF6B35`): CTA, kiemelt érték
  - `text-ai` / `bg-ai` (`#7C3AED`): AI-generált tartalom jelölése (`.ai-marker` osztály)
- **Szemantikus:**
  - `text-positive` (`#10D98A`): delta-up, növekedés, nyert
  - `text-negative` (`#FF4757`): delta-down, vesztett, élő jelzés
  - `text-warning` (`#FFB627`): figyelmeztetés
- **Szöveg:**
  - `text-primary` (`#E8F4FF`): főszöveg
  - `text-secondary` (`#7A9ABB`): kísérőszöveg
  - `text-muted` (`#4A6D95`): placeholder, deaktivált
- **Vonalak:** `border-subtle`, `border-active`, `border-strong`, növekvő láthatósággal.
- **Csapatszínek:** az ESPN `color` / `alternateColor` mezője **nem** kerül a UI-ba, amíg erről design döntés nem születik. Új token kellene hozzá.

### Tipográfia – 3 család, szigorú szereposztás

| Család | Tailwind | Mire való |
|--------|----------|-----------|
| **Barlow Condensed** | `font-display` | H1–H4, label, badge, gombok, tab triggerek. Labeleknél ALL CAPS + 0.1–0.14em tracking. |
| **DM Sans** | `font-sans` (default) | Body szöveg, leírások, paragrafusok. |
| **JetBrains Mono** | `font-mono` | Minden numerikus érték (`stat`, `[data-stat]` selector). Kötelező a `tabular-nums` + `font-variant-numeric: tabular-nums`. |

A 3 fontot az `app/layout.tsx` tölti be `next/font/google`-on keresztül, és CSS változókat (`--font-display`, `--font-body`, `--font-mono`) tesz a `<body>` className-jébe.

### Komponens szabályok

- **Komponens könyvtár:** shadcn/ui New York stílus, a `components/ui/` mappából. Az alap shadcn változókat (`--background`, `--foreground`, `--primary` stb.) a `globals.css` a Dark Command Center palettára írja át, így a Card / Button / Badge / Input / Select / Tabs azonnal helyes stílust kap.
- **Elérhető alapkomponensek:** `Button`, `Card`, `Input`, `Label`, `Select`, `Tabs`, `Textarea`, `Tooltip`, `Badge`, `StatCard`, `DataTable`.
- **Új shadcn komponens:** `npx shadcn@latest add <component-name>`. Soha ne írj kézzel a `components/ui/` mappába, kivéve a projekt-szintű `stat-card.tsx` és `data-table.tsx` fájlt.
- **`StatCard`:** label + value (JetBrains Mono) + opcionális trend, ikon és accent szín (`cyan` / `orange` / `green` / `purple`). Belépéskor `animate-fade-slide-up` + `animate-count-up`.
- **`DataTable<T>`:** `ColumnDef<T>` (key, label, numeric, center, sortable, sortAccessor, width, render), saját sort state, `activeRowId`, `footer` slot. CSS-osztályok: `dt-th`, `dt-num`, `dt-num--muted`, `dt-sort-icon`.
- **Ikonok:** Lucide React, stroke-alapú. Stroke-width: `1.5` finomabb, `1.6–1.8` standard, `2` erős. Méretek:
  - inline szöveg mellett: `h-3.5 w-3.5` vagy `h-4 w-4`;
  - gombokban: `h-4 w-4`;
  - header / nagy elem: `h-5 w-5` vagy `h-6 w-6`.
- **Toast:** Sonner, `import { toast } from 'sonner'`, majd `toast.success()` / `toast.error()`.
- **Badge variánsok:** `badge-cyan`, `badge-orange`, `badge-ai`, `badge-positive`, `badge-negative`, `badge-warning`, `badge-neutral`. Mindegyik kis méretű (`0.7rem`), uppercase, `0.12em` tracking, finom borderrel (`color-mix`, 30% áttetszés).
- **Képek** (ESPN headshot / logó): `next/image`, a `next.config.ts` `remotePatterns`-ben csak az `a.espncdn.com` engedélyezett.

### Spacing és sarok

- **Radius skála:** `--radius-xs` (2px badge/tag), `--radius-sm` (4px input, kis gomb), `--radius-md` (6px gomb/tab), `--radius-lg` (10px card), `--radius-xl` (14px modal).
- A `--radius` shadcn változó alapértéke `--radius-md`.

### Glow és árnyékok

- **Glow-k:** `shadow-glow-cyan`, `shadow-glow-cyan-hot`, `shadow-glow-orange`, `shadow-glow-orange-hot`, `shadow-glow-ai`, `shadow-glow-positive`, `shadow-glow-negative`.
- **Panel árnyék:** `shadow-panel` = `0 1px 0 0 rgba(255,255,255,.03) inset` + `0 24px 60px -28px rgba(0,0,0,.8)`. Cardokon használjuk.
- Hover állapotban a primary gomb: `box-shadow: 0 0 24px var(--glow-cyan-hot)` + `filter: brightness(1.08)`.

### Háttér

- Globális pont-rács: a `body` elemen 3 rétegű `background-image` (radial dot pattern + 2 nagy radial glow-folt). A `body` `background-attachment: fixed`-en marad.
- Egyedi felületre: `.grid-overlay` (32px rács) vagy `.dot-overlay` (16px pont) utility.

### Animációk

| Utility | Mire való | Időzítés |
|---------|-----------|----------|
| `.animate-count-up` | Stat érték első megjelenése (blur fade + slide) | 1.2s `--ease-snap` |
| `.animate-fade-slide-up` | Card / lista elem belépése | 400ms `--ease-snap` |
| `.animate-pulse-glow` | LIVE jelzés, AI loading | 1.8s ∞ |
| `.animate-blink` | Cursor / pulzáló indikátor | 1.1s steps(2,end) ∞ |
| `.animate-scan` | Telemetria sávozás overlay | 3s linear ∞ |
| `.skeleton-shimmer` | Betöltés alatti lista / kártya | 1.6s linear ∞ |
| `.stagger > *` | Gyermek elemek egymás utáni belépése (60ms × `--i`) | – |

**Belépő animáció minta:**
```tsx
// FIGYELEM: `.card` osztály NINCS a globals.css-ben – kártyához shadcn <Card> kell
<Card className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: 2 }}>...</Card>
```
- Listáknál a szülő `stagger` osztályt kap, a gyermekek `--i`-t; a lépésköz 60ms.
- A CSS custom property indexeléséhez az `as unknown as string` a bevett forma (az `any` tilos).
- Több property esetén a `stat-card.tsx` mintáját követjük: `} as React.CSSProperties}`.

**Egyedi utility osztályok:**
- `.ai-marker`: bal oldali halvány lila gradient sáv, AI tartalom jelölésére
- `.live-dot`: 8px piros pulzáló pont
- `.bar-track` + `.bar-fill`: mini progress / sparkline háttér
- `.hairline`: finom vízszintes elválasztó

**Layout-biztonság (T23):** a `globals.css`-ben lévő `.app-shell > main { min-width: 0 }` és `.grid > * { min-width: 0 }` szabályt nem szabad kivenni, mert ezek akadályozzák meg a széles táblák vízszintes túlcsordulását.

---

## Styling szabályok

- **Tailwind CSS 4 utility osztályok mindig.** A class név a komponensben van. `style={{ color: ... }}` literal csak dinamikus értékre megengedett (pl. `--i`, `--accent-color`).
- **CSS-first konfiguráció:** a Single Source of Truth az `app/globals.css` `@theme inline` blokkja.
  - `tailwind.config.ts` nincs; a content scan automatikus.
  - Nincsenek `3xl`/`4xl` breakpointok, a beépített `sm`–`2xl` skála érvényes.
- **Osztályok kombinálása:** a `cn()` helperrel (`lib/utils.ts`: `clsx` + `tailwind-merge`). Két class között mindig legyen szóköz (T24).
- **Hardcoded hex szín tilos**, és shadcn default paletta (`slate-*`, `sky-*`, `indigo-*`, `violet-*`, `emerald-*`, `amber-*`) sem használható. Mindig CSS változó tokent (`var(--accent-cyan)`) vagy Tailwind utility-t (`text-cyan`) használunk.
  - Egyetlen kivétel: az inline SVG `stroke` attribútuma, de ott is `currentColor`, ha lehet.
  - Chartokhoz a `lib/chart-theme.ts` közös konstansai kellenek.
- **Komponens variánsok:** Class Variance Authority (`cva`), a `button.tsx` mintájára. A változatok data-attribútumon (`data-variant`, `data-active`, `data-state`) is elérhetők, mert a `globals.css` ezekre is illeszt szelektort.
- **Egyedi CSS** csak a `globals.css`-ben lehet: CSS változók definiálásakor, vagy a nagy szekciók valamelyikében (`@layer base`, shadcn override, animációk, utility osztályok, AppShell).

---

## State management

Nincs külső state manager, a React 19 beépített hookjait használjuk:
- `useState`, `useCallback`, `useEffect`, `useMemo`: lokális és oldal-szintű state.
- Globális auth állapot: `useAuth()` (`lib/auth-context.tsx`).
- **Adatlekérés hookokban** (`hooks/`), `{ data, loading, error }` hármassal. A törzsadat (`useSeasons()`, `useTeams()`) egyetlen közös hookból jön, nem komponensenként (T20, T21).
- Böngészős külső állapotot (localStorage) `useSyncExternalStore`-ral olvasunk (lásd `AppSidebar`), effectből indított szinkron `setState` nélkül.
- Az `app/page.tsx` csak shell renderelést és tab routingot végez.

---

## TypeScript szabályok

- A **strict mode** kötelező (`tsconfig.json`: `"strict": true`), nem módosítható.
- Az `any` típus tilos; explicit interfészt vagy narrowingot használunk.
- A külső adatot (ESPN JSON, Supabase válasz) a rendszerhatáron validáljuk. ESPN-nél ez kizárólag a `lib/espn/schemas.ts`.
- Típusimportok: `import type { ... }`, az importlista elején.
- Path alias: `@/lib/...`, `@/components/...`, `@/hooks/...`. Relatív `../../` import nem megengedett. A tsx CLI is feloldja az aliast.
- A Supabase sorok típusai a `lib/supabase.ts` `Database` típusából származnak (`TableInsert<'…'>`).
- Generikus komponensek a `DataTable<T>` mintájára készülnek; a `ColumnDef<T>` típus a komponens fájljából exportálódik.

---

## API és adatbázis szabályok

- **Böngészős Supabase kliens:** egyetlen példány, `lib/supabase.ts` (globalThis singleton, T25). Ne hozz létre másikat.
- **Szerveroldali admin kliens:** `getSupabaseAdmin()` (`lib/supabase-admin.ts`). CLI szkriptben a szkript saját service role kliense (dotenv `.env.local`). Mindhárom a `createNbaClient()`-tel készül.
- **Minden lekérdezés szűrt**, `season_id` és ahol értelmes, csapat szerint. Szűretlen full-table scan tilos.
- **1000 sor fölött kötelező a `fetchAllRows()`** (`lib/fetch-all-rows.ts`). A PostgREST némán csonkol (T1). NBA-méretben egy szezon kb. 34e játékos-sor és 225e dobás.
- **Százalékot összegzett dobásokból számolunk**, nem meccsenkénti százalékok átlagából. A formulák csak a `lib/stat-formulas.ts`-ből jöhetnek.
- **DNP sorok:** a `player_game_stats`-ban `did_not_play = true`-val tároljuk őket. Minden aggregáció (meccsszám, átlag) kiszűri őket (T8).
- API route kötelező direktívái import esetén:
  ```ts
  export const dynamic = 'force-dynamic'
  export const runtime = 'nodejs'
  export const maxDuration = 300  // hosszú futású import route-okhoz
  ```
- **Spawn-alapú import route nincs** (T29). A route az `lib/espn/*` modulokat közvetlenül hívja, vagy az import CLI / GitHub Actions útján fut.
- Supabase lekérdezés minta:
  ```ts
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('season_id', selectedSeasonId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('game_date', { ascending: false });
  if (error) throw error;
  ```

---

## ESPN import szabályok

- A `lib/espn/client.ts` az **egyetlen** hely, ami az ESPN-t hívja: throttle ≥ 1 mp, retry 429/5xx-re. Más modul nem `fetch`-el az ESPN felé.
- Minden válasz a `lib/espn/schemas.ts`-en megy át. Új mezőt ott kell validálni, nem a leképezésben. Séma-eltérésnél `EspnSchemaError` jön, pontos útvonallal.
- A `map-boxscore.ts` konzisztencia-figyelmeztetéseket ad: pontösszeg, FGA-összeg, dobásszám = FGA. **Ha figyelmeztetés jön, az adatot ellenőrizni kell, nem elnémítani** (T6, T19).
- **Dobáskoordináta:** lábban, a kosár a (25, 0) pontban, az y a kosártól mért távolság. A büntetők érvénytelen koordinátát kapnak, ezeket kiszűrjük. A zónákat és a close/mid határt (8 láb) csak a `map-shots.ts` definiálja (T10).
- **Heave:** a kihagyott negyedvégi „Heave Jump Shot” nem FGA az ESPN box score-ban, ezért nem kerül a `shot_events`-be és a close/mid bontásba (`isMissedHeave()`, `map-shots.ts`). A bedobott heave marad.
- **ESPN ID nélküli játékos:** ha nincs statisztikája, a sort kihagyjuk, és `ℹ` tájékoztatást írunk (`notices`, nem `warnings`). Ha van statisztikája, `EspnSchemaError` (név alapján nem párosítunk, T2).
- **Batch upsert előtt deduplikálni kell a kulcsra** (T5): ha egy batch-en belül ütközik a kulcs, a teljes insert elbukik. A `map-boxscore.ts` szűr: azonos tartalmú dobás-ismétlés → `ℹ`, azonos play ID eltérő tartalommal vagy duplikált játékossor → `⚠`.
- **Szezon-kapu (T4, `lib/espn/season-gate.ts`):**
  - csak alapszakasz (2), rájátszás (3) és play-in (5); az előszezon `ℹ`-vel kimarad;
  - élesben a szezonnak léteznie kell az `nba.seasons`-ben (az import nem hoz létre szezont), és a `game_date` a `start_date`/`end_date` közé esik, különben a meccs írás előtt elbukik;
  - dry-runban a tág ablak (aug. 1. – júl. 31.) az ellenőrzés.
- **Kilépési kód (T6):** 0 = rendben, 1 = legalább egy meccs elbukott, 2 = figyelmeztetés volt. A futás végén összesítő listázza a hibákat és figyelmeztetéseket; a `ℹ` tájékoztatás nem ront a kódon.
- **Minden import szkriptnek van `--dry-run` módja**, ami DB nélkül validál és kiír.
- **A nyers JSON gzip-elve az `espn_game_raw.payload_gz`-be kerül** (`lib/espn/raw-payload.ts`). Formátumváltáskor innen parse-olunk újra, nem töltünk le.
- **Import-író változás csak push után hat** az ütemezett GitHub Actions futásra. A push is része a lezárásnak (T7).

```bash
npm run ingest:games -- --date 2025-03-01 --dry-run   # validálás DB nélkül
npm run ingest:games -- --date 2025-03-01             # írás Supabase-be
```

---

## Titkok és biztonság

| Változó | Hol elérhető | Mire való |
|---------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Kliens + szerver | Supabase projekt URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kliens + szerver | Supabase publikus anon kulcs |
| `SUPABASE_SERVICE_ROLE_KEY` | **Csak szerver / CLI** | Import, admin API route-ok |
| `AI_PROVIDER` | Szerver (opcionális) | `openai` (default) vagy `claude` |
| `OPENAI_API_KEY` | **Csak szerver** | AI szöveggenerálás (OpenAI) |
| `OPENAI_MODEL` | Szerver (opcionális) | Default: `gpt-4.1-mini` |
| `ANTHROPIC_API_KEY` | **Csak szerver** | AI szöveggenerálás (Claude) |
| `CLAUDE_MODEL` | Szerver (opcionális) | Claude modell azonosító |

- A `.env.local` soha nem kerülhet git-be. A `.env.local.example` viszont verziózott, titkot nem tartalmaz.
- `NEXT_PUBLIC_` prefix nélküli változók csak szerver oldalon érhetők el.
- **RBAC (T26):**
  - Minden írás admin-only: import, kezelés, AI riport generálás és mentés.
  - Az admin: `user_metadata.role === 'admin'`.
  - Minden `app/api/*` route a `requireAdmin()` guardot futtatja; kliens oldalon `authFetch()` hívja őket.
  - A riportok olvasása közvetlen Supabase SELECT-tel megy (RLS).

---

## Kommunikáció

Tömören kommunikálok. Minden változás után jelzem:
- mit módosítottam és melyik fájlban;
- ha SQL migráció kell, és hogy kézzel kell futtatni;
- ha új package kellene (erre előbb rákérdezek);
- ha új design tokent vagy animációt vezetnék be (erre előbb rákérdezek);
- ha egy stílusfeladat funkcionális változtatást igényelne (jelzem, és külön döntést kérek);
- ha frissítettem a `context/progress-tracker.md`-t.

A részműveletek és a műveletek végén a `BACKLOG.md`-t frissítem, hogy mindig naprakész legyen:
- a feladatlista állapotát;
- a „Fejlesztési történet” szakaszt (dátum, mi készült, ellenőrzés, commit);
- új tanulságnál a „Tanulságok” listát.

---

## Commit szabály

**Minden elvégzett művelet után git commitot kell készíteni.** Akkor commitolunk, amikor egy jól körülhatárolt feladategység elkészült (kód, dokumentáció vagy config változás), és a `BACKLOG.md` meg a progress-tracker frissítve van.
- Az üzenet magyar és tömör: mit és miért.
- A záró sor: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A `master` ágra közvetlenül commitolunk. Push csak külön kérésre, de import-író változásnál jelzem, hogy az ütemezett futáshoz push kell (T7).
- Több összefüggő fájlmódosítás egy commitba kerül, nem daraboljuk fölöslegesen.
