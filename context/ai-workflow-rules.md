# AI Workflow Rules

## Approach

Ezt a projektet inkrementálisan, spec-vezérelt munkafolyamattal fejlesztjük. A kontextus fájlok meghatározzák, mit és hogyan kell építeni, és a fejlesztés jelenlegi állapotát. Mindig ezekre a spec-ekre implementálj — ne találj ki vagy feltételezz viselkedést a semmiből. Az AI az implementációs motor; az architektúrális döntések az emberé.

## Scoping Rules

- Egyszerre csak egy feature unit-on dolgozz
- Részleges, ellenőrizhető növekményeket részesítsd előnyben a nagy, spekulatív változásokkal szemben
- Ne kombinálj összefüggéstelen rendszerhatárokat (pl. UI változás + SQL migráció + import logika) egyetlen lépésben
- Soha ne módosíts olyan fájlokat, amelyek nem részei az aktuális feladatnak — különösen `components/ui/`, `migrations/`, és gyökérszintű import szkriptek
- Ne adj hozzá új npm csomagot anélkül, hogy az a spec-ben vagy a felhasználó explicit utasításában szerepelne

## When to Split Work

Osszd kisebb lépésekre az implementációt, ha az kombinálja az alábbiakat:

- UI változtatás + adatbázis migráció egyszerre
- Több összefüggéstelen API route egyszerre
- Komponens refaktorálás + új feature egy lépésben
- Scraping logika módosítása + frontend megjelenítés változtatása
- Olyan viselkedés, amely nincs egyértelműen definiálva a kontextus fájlokban

Ha egy változás nem ellenőrizhető gyorsan end-to-end, a scope túl tág — bontsd kisebbre.

## Handling Missing Requirements

- Ne találj ki termék-viselkedést, amely nincs definiálva a kontextus fájlokban
- Ha egy követelmény kétértelmű, tisztázd a releváns kontextus fájlban, mielőtt implementálsz
- Ha egy követelmény hiányzik, add hozzá nyitott kérdésként a `progress-tracker.md`-be, mielőtt folytatod
- Ha az adatbázis sémáról nincs info, először a `lib/supabase.ts` `Database` típusait és a `migrations/` SQL fájlokat nézd meg

## Protected Files

Ne módosítsd az alábbi fájlokat explicit utasítás nélkül:

- `components/ui/*` — shadcn/ui generált alapkomponensek; csak `npx shadcn@latest add`-del módosítandók
- `migrations/*.sql` — ezeket nem a kódbázisból, hanem Supabase SQL Editor-ból kell futtatni
- `tsconfig.json` — a strict mode beállítások nem módosíthatók
- `app/layout.tsx` — csak ha az AuthProvider vagy a font konfiguráció változik
- `.env.local` — soha nem kerül a kódbázisba, nem módosítandó az implementáció részeként

## Keeping Docs in Sync

Frissítsd a releváns kontextus fájlt, amikor az implementáció megváltoztatja az alábbiakat:

- Rendszer architektúra vagy határok → `architecture.md`
- Tárolási modell döntések (új tábla, view) → `architecture.md`
- Kódolási konvenciók vagy standardok → `code-standards.md`
- Feature scope változás → `project-overview.md`
- UI téma, komponens vagy layout változás → `ui-context.md`

## Supabase-specifikus Szabályok

- Új tábla vagy view létrehozásakor mindig készíts SQL migrációs fájlt a `migrations/` mappába
- A migrációs fájl neve: `<témakör>-<rövid-leírás>.sql` (pl. `add-season-support.sql`)
- Soha ne módosítsd közvetlenül a production adatbázist — minden sémaváltozás migrációs fájlon keresztül történik
- RLS policy-ket a `supabase-view-security-fix.sql` mintájára írj
- A `lib/supabase.ts` `Database` típusát frissítsd, ha új táblát vagy view-t adsz hozzá

## API Route Szabályok

- Minden import API route-hoz legyen `export const dynamic = 'force-dynamic'`
- Hosszú futású route-ok (import): `export const maxDuration = 300`
- Hibákat naplózd szerver oldalon (`console.error`) és adj vissza értelmes HTTP státuszt a kliensnek
- Egy API route = egy felelősségi kör; ne legyen monolitikus endpoint

## Before Moving to the Next Unit

1. Az aktuális unit end-to-end működik a definiált scope-ján belül
2. Egyetlen invariant sem sérült az `architecture.md`-ben definiáltak közül
3. A `progress-tracker.md` tükrözi az elvégzett munkát
4. `npm run build` sikeresen lefut
5. Nincs TypeScript hiba (`tsc --noEmit` hibátlan)
6. Nincs Console hiba a böngészőben az érintett oldalon
7. Az ESLint nem jelez hibát (`npm run lint`)
