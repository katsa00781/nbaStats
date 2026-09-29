# Backlog

Utolsó frissítés: 2026-09-29

## Kész

- [x] **0. fázis:** repó-alap, design és auth átvétel, alapséma (001), ESPN adapter, `ingest-games.ts` dry-run-nal. Validálva 6 meccsen.

## Következő

- [ ] Ingest: `--season` visszatöltés (throttle 1 mp, kb. 25 perc/szezon), `ingest-schedule.ts`, `ingest-standings.ts`
- [ ] GitHub Actions napi cron (az ASEStats `scrape.yml` mintájára, Playwright nélkül)
- [ ] Migráció 002: `player_season_stats_by_season` view, a `player-stat-mapping` kompatibilis alakjában
- [ ] Hookok: `useFilterData` / `useGameData`, semleges hazai/vendég sémára
- [ ] Alapnézetek: Mérkőzések, Játékosok, Játékos-részletek, Csapatstatisztika, Tabella
- [ ] Követett csapat választó (`app_settings.followed_team_id`, admin)
- [ ] Elemző motorok portolása: `postgame-report`, `pregame-scouting`, `team-analysis`, `player-analysis`, `player-postgame` (48 perces küszöbök), `situational-analysis` (hosszabbítás bucket)
- [ ] Migráció 003: AI riport táblák és RLS; a `generate-*` route-ok a követett csapatra paraméterezve
- [ ] Dobástérkép NBA-geometriával, zóna heatmap

## Később / ötletek

- [ ] Play-by-play tárolás: win probability, run-ok, clutch. Supabase tier-döntés kell hozzá.
- [ ] GameScore / PIE a FIBA valuation mellé
- [ ] Élő meccsállapot (scoreboard polling)
- [ ] Tartalék adatforrás adapter (balldontlie), ha az ESPN formátuma eltörik

## Ismert korlátok

- Az ESPN API nem hivatalos. Formátumváltáskor a `lib/espn/schemas.ts` pontos útvonallal hibát dob, a nyers JSON pedig az `espn_game_raw`-ban újra-parse-olható.
- A dobáskoordináta 1 láb felbontású.
- Ha az ESPN utólag töröl egy dobás-eseményt, az a `shot_events`-ben megmarad (upsert, törlés nincs).
