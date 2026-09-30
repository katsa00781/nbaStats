# Architecture Context

## Stack

Azonos az ASEStatsszel, **Playwright nélkül**:
- Next.js 16 (App Router) + React 19 + TypeScript 5 strict
- Tailwind CSS 4 (CSS-first, `@theme inline`) + shadcn/ui (New York) + Radix
- Supabase (PostgreSQL, Auth): saját `nba` séma az ASEStatsszel közös `ugkettlebell` projektben (lásd Storage Model)
- Chart.js / Recharts, Lucide, Sonner
- tsx a CLI-hez
- AI: OpenAI / Claude (`lib/ai-client.ts`)

## System Boundaries

- `app/`: App Router oldalak, API route-ok (mind `force-dynamic`), `globals.css`.
- `components/`: UI. A `components/ui/` shadcn-generált, kivéve a `stat-card.tsx` és a `data-table.tsx` fájlt.
- `lib/`: megosztott logika és típusok, valamint elemző motorok (később, az ASEStatsből portolva).
- `lib/espn/`: ESPN adapter. Next.js-független, tiszta modulok:
  - `client.ts`: `fetch`, throttle ≥ 1 mp, retry 429/5xx-re;
  - `schemas.ts`: validálás `unknown` → típusos alak, `EspnSchemaError`;
  - `map-shots.ts`: koordináta → távolság / zóna / close-mid;
  - `map-boxscore.ts`: összefoglaló → „staged” sorok ESPN ID-kkel + konzisztencia-figyelmeztetések;
  - `write-game.ts`: upsert service role klienssel, ESPN ID → UUID feloldás.
- Gyökér `ingest-*.ts`: CLI import szkriptek (dotenv `.env.local`), mindegyik `--dry-run` móddal.
- `migrations/`: SQL, **csak kézzel** futtatva a Supabase SQL Editorban.

## Storage Model

A séma a `migrations/001-initial-schema.sql` fájlban él, a TS-tükre a `lib/supabase.ts` `Database` típusa.

**Elhelyezés (döntés: 2026-09-30):**
- A free tier 2 projektes korlátja miatt nincs önálló projekt. Az NBAStats az ASEStats `ugkettlebell` projektjében él, **saját `nba` Postgres sémában**.
- A `public` sémában az ASEStats táblái vannak, 6 azonos névvel (`seasons`, `teams`, `players`, `games`, `player_game_stats`, `team_game_stats`). Ezért minden SQL `nba.`-minősített, és minden kliens `db: { schema: 'nba' }` beállítással jön létre.
- Az Auth (`auth.users`) közös: ugyanazok a felhasználók és ugyanaz az admin szerepkör.
- Tárhely: a 500 MB közös (ASEStats 129 MB, 2026-09-30). Egy NBA szezon kb. 130–170 MB, ezért egyszerre egy szezont tárolunk (2025/2026).

- `seasons`: `espn_year` UNIQUE, a szezon záró éve (2025 = 2024/2025).
- `teams`: `espn_team_id` UNIQUE. `players`: `espn_athlete_id` UNIQUE. A csapattagság meccsenként a `player_game_stats.team_id`-ben él, így a cserék is követhetők.
- `games`: `espn_event_id` UNIQUE.
  - Semleges hazai/vendég modell: `home_team_id`, `away_team_id`, `home_score`, `away_score`. **Nincs `our_team_id`.**
  - `game_date` = amerikai keleti parti helyi nap.
  - `season_type`: 1 előszezon, 2 alapszakasz, 3 rájátszás, 5 play-in.
- `player_game_stats`: UNIQUE `(game_id, player_id)`.
  - **Egyetlen tábla** `season_id`-val, nincs szezononkénti tábla-szétvágás.
  - Explicit `fgm/fga/fg3m/fg3a`.
  - A `close_*`/`mid_*` a dobás-eseményekből számolódik (≤ 8 láb = close).
- `team_game_stats`: UNIQUE `(game_id, team_id)`. A `tov` a csapatszintű eladott labdákat is tartalmazza, ez a possession-becsléshez kell.
- `shot_events`: UNIQUE `(game_id, espn_play_id)`.
  - Nyers koordináta lábban, a kosár a (25, 0) pontban.
  - A `distance_ft` és a `zone` (rim/paint/mid/corner3/above_break3) számított.
  - Büntető nem kerül ide.
- `espn_game_raw`: a nyers summary JSON gzip-elt `bytea`-ként (`payload_gz`, kb. 38 KB/meccs), újra-parse-oláshoz. Kódolás/dekódolás: `lib/espn/raw-payload.ts`.
- `app_settings`: egysoros tábla, `followed_team_id` = követett csapat: **Los Angeles Lakers** (ESPN `13`).
- `seasons` start/end: a migráció tölti ki az ESPN szezonablakából (csak 2026 = 2025/2026); ehhez veti a szezon-kapu a `game_date`-et.
- **RLS:** minden táblán SELECT a bejelentkezett felhasználóknak. Írni csak a service role tud.

## Data Flow

```
ESPN site API (scoreboard → summary)
   ↓ lib/espn/client.ts (throttle, retry)
   ↓ lib/espn/schemas.ts (validálás)
   ↓ lib/espn/map-boxscore.ts + map-shots.ts (staged sorok, konzisztencia-ellenőrzés)
   ↓ lib/espn/write-game.ts (upsert ESPN ID-kre)
Supabase (games, player_game_stats, team_game_stats, shot_events, espn_game_raw)
   ↓ hookok → lib/*-analysis (portolandó) → components → app/page.tsx
```

## Auth and Access Model

- Supabase email/jelszó. `AuthProvider` (`lib/auth-context.tsx`), a `page.tsx` root guard.
- Admin: `user_metadata.role === 'admin'`. Az API route-ok a `lib/api-auth.ts` `requireAdmin()` guardját használják, kliens oldalon az `authFetch()`-et.

## Invariants

1. Minden adat csak bejelentkezés után látható.
2. `components/ui/`: csak shadcn CLI-vel módosítható, kivéve a `stat-card` és a `data-table` fájlt.
3. A `migrations/*.sql` csak kézzel futtatható.
4. A lekérdezések `season_id` szerint szűrtek. 1000 sor fölött kötelező a `lib/fetch-all-rows.ts`.
5. Minden író ESPN-azonosítóra épülő kulcsra upsertel. Név alapján soha nem párosítunk entitást.
6. Az ESPN-választ csak a `lib/espn/schemas.ts` validálása után használjuk.
7. A kanonikus stat-formulák a `lib/stat-formulas.ts`-ben vannak. A százalékok összegzett dobásokból számolódnak.
8. TypeScript strict, `any` tilos.
9. Egyetlen böngészős Supabase kliens van (`lib/supabase.ts`). Szerveren a `getSupabaseAdmin()`, CLI-ben a szkript saját service role kliense fut. Mindegyik a `createNbaClient()`-tel készül (`lib/db-schema.ts`).
10. Az NBAStats csak az `nba` sémát írja és olvassa; a közös projekt `public` sémájához (ASEStats) nem nyúl.
