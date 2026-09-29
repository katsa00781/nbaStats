# Code Standards

## General

- Minden modul egyetlen, jól körülhatárolt felelőséggel rendelkezzen — ne keverj UI logikát, adatfeldolgozást és API hívásokat egyazon fájlban
- Gyökérokokra keress megoldást; ne rétegezz workaround-okat meglévő hibák fölé
- Ne kombinálj összefüggéstelen rendszerhatárokat egyetlen implementációs lépésben (pl. UI változás + migration egyszerre)
- Magyar terminológiát használj kommentekben és dokumentációban; a kód identifikátorai angolul legyenek

## TypeScript

- Strict mode kötelező az egész projektben (`tsconfig.json`: `"strict": true`)
- Kerüld az `any` típust — explicit interfészeket vagy szűkített típusokat használj helyette
- Külső adatokat (Supabase válaszok, scraping eredmények) mindig validáld a rendszerhatárokon, mielőtt felhasználod
- Supabase sorok típusait a `lib/supabase.ts`-ben definiált `Database` típusból vezessük le
- Típus importok mindig az importlista elejére kerülnek (`import type { ... } from '...'`)
- Path alias-t használj: `@/lib/...`, `@/components/...` — soha ne legyen relatív `../../` import komponensekben

## Import Sorrend

```ts
import type { ... } from '...'   // 1. Típus importok
import { ... } from '@/lib/...'  // 2. Belső, path alias
import { ... } from 'third-party' // 3. Külső csomagok
```

## Next.js (App Router)

- Server Components az alapértelmezés — `'use client'` direktíva csak ott, ahol böngésző API vagy React hook szükséges
- `app/page.tsx` `'use client'` direktívával van, mert auth állapotot és `useState`/`useEffect`-et használ
- API route-ok kötelező direktívái import esetén:
  ```ts
  export const dynamic = 'force-dynamic'
  export const runtime = 'nodejs'
  export const maxDuration = 300  // hosszú futású import route-okhoz
  ```
- Egy route handler egy felelősséggel bírjon — ne legyen monolitikus `app/api/` fájl

## React Komponens Konvenciók

- Komponens neve: PascalCase (`GameDetails.tsx`, `PlayerComparison.tsx`)
- Exportálás: named export, kivéve `app/` oldalak ahol default export szükséges
- State kezelés hookok: `useState`, `useCallback`, `useEffect`, `useMemo` — React 19, nincs külső state manager
- Globális auth állapot: kizárólag `useAuth()` hook-on keresztül (`lib/auth-context.tsx`)
- Komponens propjai: mindig TypeScript interfészen vagy inline típuson keresztül definiálva

## Elnevezési Konvenciók

| Kontextus | Konvenció | Példa |
|-----------|-----------|-------|
| React komponensek | PascalCase | `GameDetails.tsx`, `PlayerComparison` |
| Függvények/változók | camelCase | `playerStats`, `calculateMetrics` |
| TypeScript típusok/interfészek | PascalCase | `Database`, `PlayerGameStats`, `TeamGame` |
| Adatbázis mezők | snake_case | `free_throw_made`, `player_game_stats` |
| Konstansok | UPPER_SNAKE_CASE | `SUPABASE_URL`, `CLOSE_MAX_FT` |
| CSS osztályok | Tailwind utility | `bg-slate-950`, `text-muted-foreground` |

## Styling

- Tailwind CSS 4 utility osztályokat használj; ne írj egyedi CSS-t, kivéve ha `globals.css`-ben CSS változókat definiálsz
- Osztályok kombinálásához mindig `cn()` helper (`lib/utils.ts`): `cn(clsx(...), tailwind-merge(...))`
- Komponens variánsokhoz: Class Variance Authority (`cva`) — a `button.tsx` és `badge.tsx` mintájára
- `components/ui/` fájlokat nem módosítsd kézzel — ezek shadcn/ui generált fájlok
- Ne legyen hardcoded hex szín a komponensekben — mindig CSS változó tokent vagy Tailwind osztályt használj

## API Routes

- Minden bemeneti adatot validálj és értelmezz, mielőtt bármilyen logika lefut
- Konzisztens, előre jelezhető választ adj vissza minden esetben
- Hosszú futású scraping route-okban `maxDuration = 300` kötelező
- Supabase hiba esetén mindig naplózd a hibát és adj vissza értelmes HTTP státuszt

## Data és Storage

- Metadata, ownership, relációk → Supabase PostgreSQL
- Statikus/historikus adatok → `public/data/` JSON fájlok (ritkán frissítendő archív adat)
- A `player_season_stats_by_season` view aggregált statisztikákat tárol — soha ne írj komplex aggregációs SQL-t közvetlenül a kliensbe
- Nagy mennyiségű play-by-play adat → dedikált táblák (`play_by_play_events`, `shotchart_events`)
- Minden lekérdezés `season_id` és `team_id` szerint szűrt — szűretlen full-table scan tiltott a fő dashboardon

## Supabase Lekérdezés Minták

```ts
// Jó: typed, szűrt, hibakezelés
const { data, error } = await supabase
  .from('games')
  .select('*')
  .eq('season_id', selectedSeasonId)
  .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
  .order('game_date', { ascending: false });

if (error) throw error;

// Rossz: szűretlen lekérdezés
const { data } = await supabase.from('player_game_stats').select('*');
```

## File Organization

- `app/` — Next.js routing és oldalak; minden API route itt van
- `app/api/` — API endpointok; egy mappa = egy felelősségi kör
- `components/` — UI komponensek; nem tartalmaz üzleti logikát
- `components/ui/` — shadcn/ui alap komponensek; **csak `npx shadcn add`-del módosítandó**
- `lib/` — Megosztott logika, típusok, segédfüggvények, elemzési algoritmusok
- `migrations/` — SQL migrációs fájlok; kronológiai sorrendben elnevezve
- `scripts/` — Node.js adatbázis-kezelő szkriptek
- `lib/espn/` — ESPN adapter (letöltés, validálás, leképezés, DB-írás); Next.js-től független, CLI-ből is fut
- Gyökér `ingest-*.ts` fájlok — CLI import szkriptek; nem importálhatók Next.js modulokba

## Import (ingest) Konvenciók

- Nincs Playwright: az ESPN JSON-t a `lib/espn/client.ts` tölti le (throttle ≥ 1 mp, retry 429/5xx-re) – más modul nem hív közvetlenül `fetch`-et az ESPN felé
- Minden ESPN válasz a `lib/espn/schemas.ts`-en megy át; új mezőt ott kell validálni, nem a leképezésben
- Írás csak ESPN azonosítóra épülő upserttel (`espn_*_id`, `(game_id, player_id)`, `(game_id, espn_play_id)`)
- Minden import szkriptnek legyen `--dry-run` módja (DB nélkül validál és kiír)
- `NEXT_PUBLIC_SUPABASE_URL` és `SUPABASE_SERVICE_ROLE_KEY` CLI szkriptekben `dotenv`-vel töltendő be (`.env.local`)
- Minden szkript naplózza a progresszt (`console.log`) és a hibákat (`console.error`)
