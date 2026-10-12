-- Migráció 004: tabella (alapszakasz) – egy sor = csapat × szezon.
--
-- Az ESPN tabellájának (standings?level=2) pillanatképe, naponta felülírva
-- (ingest-standings.ts). Nem a `games`-ből számolt érték: a hazai / idegen
-- mérleg, a GB, a kiemelés és a clinch az ESPN saját adata. A származtatott
-- mutatókat (win%, pontkülönbség, átlagok) a nézet számolja.
--
-- Minden objektum `nba.`-minősített (a `public` az ASEStatsé). A Supabase SQL
-- Editorban futtatandó; idempotens.

create table if not exists nba.standings (
  season_id uuid not null references nba.seasons(id),
  team_id uuid not null references nba.teams(id),
  wins integer not null,
  losses integer not null,
  conference_seed integer,          -- ESPN playoffSeed (konferencián belüli helyezés)
  clincher text,                    -- z / y / x / e / pi ... (nincs: NULL)
  games_behind numeric(4, 1) not null default 0,  -- a vezetőnél 0
  home_record text,                 -- pl. '31-9'
  road_record text,
  division_record text,
  conference_record text,
  last_ten text,
  streak text,                      -- pl. 'W3'
  points_for integer,
  points_against integer,
  updated_at timestamptz not null default now(),
  primary key (season_id, team_id)
);

comment on table nba.standings is
  'Tabella: csapat × szezon, az ESPN standings pillanatképe (alapszakasz). Írás csak service role-lal.';

-- ── Jogosultságok és RLS ───────────────────────────────────────────────────
grant select on nba.standings to authenticated;
grant all on nba.standings to service_role;

alter table nba.standings enable row level security;
drop policy if exists "authenticated read" on nba.standings;
create policy "authenticated read" on nba.standings for select to authenticated using (true);
