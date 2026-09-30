# NBAStats – Projekt áttekintés

## Overview

Az NBAStats egy belső NBA statisztikai és elemzési platform, az ASEStats (magyar NB I, ASE) testvérprojektje.
- **Adatforrás:** az ESPN nyilvános JSON API-ja. Az adatok automatikusan jönnek: menetrend, box score, dobás-események.
- **Tárolás:** Supabase (PostgreSQL), saját `nba` sémában az ASEStatsszel közös projektben. Egyszerre egy szezon (2025/2026).
- **Megjelenítés:** Next.js dashboard az ASEStats „Dark Command Center” designjával.
- **Nézőpont:** a teljes ligát tároljuk, de egy **követett csapat** nézőpontjából készülnek a pregame scouting és postgame riportok. A többi 29 csapat a benchmarkokat adja.

## Goals

1. Az NBA mérkőzésadatok automatikus gyűjtése az ESPN API-ból, Playwright nélkül.
2. Teljes ligás, szezononkénti statisztikai adatbázis, stabil ESPN azonosítókkal.
3. Játékos- és csapatstatisztikák szezon és csapat szerinti szűréssel.
4. Magyar nyelvű AI pregame és postgame riportok a követett csapat szemszögéből.
5. Bejelentkezés-védett, csak belső felhasználóknak elérhető webes dashboard.

## Core User Flow

1. A felhasználó bejelentkezik (Supabase email/jelszó).
2. Kiválaszt egy szezont és egy csapatot. Az alapértelmezett csapat a követett csapat.
3. A navigáción ezek érhetők el: Áttekintés, Játékosok, Elemzések, Szituációk, Tabella, Mérkőzések, Meccs Log.
4. Az adatfrissítés ütemezett GitHub Actions futással történik, kézzel pedig így: `npm run ingest:games -- --date YYYY-MM-DD`.

## Scope

### In Scope (v1)

- Box score: játékos és csapat, alapszakasz, play-in és rájátszás.
- Dobás-események zónákkal, dobástérkép.
- Tabella, menetrend.
- Elemző motorok és AI riportok (az ASEStatsből portolva).

### Out of Scope (v1)

- Teljes play-by-play elemzés: lineupok, run-ok, clutch, win probability.
- Élő meccskövetés, push értesítés.
- Mobil kliens.
- Nyilvános hozzáférés, multi-tenant működés, fizetés.
- Igazolások / tranzakciók nézet.

## Success Criteria

1. Az `ingest-games.ts` egy teljes napot hiba és konzisztencia-figyelmeztetés nélkül importál. Az ismételt futtatás nem duplikál.
2. Egy teljes szezon visszatölthető, és az ASEStatsszel közös Supabase free tier keretben marad.
3. A bejelentkezett felhasználó szezon és csapat szerint szűrt statisztikákat lát.
4. A követett csapat következő meccsére generálható pregame riport.
5. A `npm run build` és a `npx tsc --noEmit` hibátlan.
