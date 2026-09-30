-- 002 – A 2026/2027-es szezon felvétele
-- Futtatás: KIZÁRÓLAG kézzel, a Supabase SQL Editorban, az `ugkettlebell` projektben.
--
-- Az import nem hoz létre szezont (szezon-kapu, T4), ezért a menetrend-import
-- (ingest-schedule.ts) előtt a szezonsort itt kell felvenni. Döntés (2026-09-30):
-- a 2025/26-os szezon is marad; két szezon kb. 390 / 500 MB a közös projektben.
--
-- Forrás: ESPN scoreboard leagues[0].season (2026-10-27-i lekérés):
-- startDate 2026-09-30T07:00Z, endDate 2027-06-26T06:59Z. Az ESPN a csendes-óceáni
-- éjfélt használja, így az első nap 2026-09-30, az utolsó 2027-06-25.

insert into nba.seasons (espn_year, name, start_date, end_date) values
  (2027, '2026/2027', '2026-09-30', '2027-06-25')
on conflict (espn_year) do update
  set start_date = excluded.start_date,
      end_date = excluded.end_date;
