-- 002 – Visszatöltés előkészítése: tömörített nyers JSON, szezonhatárok, követett csapat
-- Futtatás: KIZÁRÓLAG kézzel, a Supabase SQL Editorban, a 001 után.
--
-- 1. espn_game_raw: a nyers summary jsonb helyett gzip-elt bytea (payload_gz).
--    Egy summary kb. 370 KB nyersen, gzip-pel kb. 38 KB; 3 szezon (~3 950 meccs)
--    jsonb-ben a dobásokkal együtt túllépné a free tier 500 MB-ját.
--    Kódolás/dekódolás: lib/espn/raw-payload.ts.
-- 2. seasons: a visszatöltött 3 szezon az ESPN szezonablakával (előszezonnal
--    együtt). A szezon-kapu (T4) ehhez veti a game_date-et.
-- 3. app_settings.followed_team_id: Los Angeles Lakers (ESPN team id 13).

-- ── 1. Nyers JSON → gzip bytea ─────────────────────────────────────────────
-- Nem-üres táblán a csere adatvesztés lenne: ilyenkor megállunk, a sorokat az
-- ingest újrafuttatása úgyis újraírja.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'espn_game_raw' and column_name = 'payload'
  ) and exists (select 1 from espn_game_raw) then
    raise exception 'espn_game_raw nem üres – előbb ürítsd (delete from espn_game_raw), majd futtasd újra az ingestet';
  end if;
end $$;

alter table espn_game_raw drop column if exists payload;
alter table espn_game_raw add column if not exists payload_gz bytea not null;

-- ── 2. Szezonok ────────────────────────────────────────────────────────────
-- Forrás: ESPN scoreboard leagues[0].season.startDate/endDate. Az ESPN a
-- csendes-óceáni éjfélt (07:00Z) használja, így a záró nap az endDate előtti nap.
insert into seasons (espn_year, name, start_date, end_date) values
  (2024, '2023/2024', '2023-10-05', '2024-06-20'),
  (2025, '2024/2025', '2024-09-24', '2025-06-26'),
  (2026, '2025/2026', '2025-10-01', '2026-06-26')
on conflict (espn_year) do update
  set start_date = excluded.start_date,
      end_date = excluded.end_date;

-- ── 3. Követett csapat: Los Angeles Lakers ─────────────────────────────────
-- ESPN ID alapján; az első importált Lakers-meccs a többi mezőt frissíti.
insert into teams (espn_team_id, name, short_name, abbreviation) values
  ('13', 'Los Angeles Lakers', 'Lakers', 'LAL')
on conflict (espn_team_id) do nothing;

update app_settings
  set followed_team_id = (select id from teams where espn_team_id = '13'),
      updated_at = now()
  where id;
