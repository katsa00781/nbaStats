-- 001 – NBAStats alapséma (0. fázis)
-- Futtatás: KIZÁRÓLAG kézzel, a Supabase SQL Editorban (új, önálló projekt).
-- Semleges hazai/vendég modell, minden entitás stabil ESPN azonosítóval;
-- minden író az ESPN ID-kre upsertel, így az ismételt import nem duplikál.
-- AI riport táblák és a szezon-aggregáló view későbbi migrációban jönnek.

create extension if not exists pgcrypto;

-- ── Szezonok ────────────────────────────────────────────────────────────────
-- espn_year: az ESPN szezonév, a szezon ZÁRÓ éve (2025 = 2024/2025).
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  espn_year integer not null unique,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

-- ── Csapatok ────────────────────────────────────────────────────────────────
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  espn_team_id text not null unique,
  name text not null,
  short_name text,
  abbreviation text not null,
  conference text,
  division text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Játékosok ───────────────────────────────────────────────────────────────
-- A csapattagság meccsenként a player_game_stats.team_id-ben él (cserék!).
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  espn_athlete_id text not null unique,
  name text not null,
  short_name text,
  position text,
  jersey text,
  headshot_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Mérkőzések ──────────────────────────────────────────────────────────────
-- season_type: 1 = előszezon, 2 = alapszakasz, 3 = rájátszás, 5 = play-in.
-- game_date: amerikai keleti parti helyi dátum (így jelenik meg a menetrendben).
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  espn_event_id text not null unique,
  season_id uuid not null references seasons(id),
  season_type smallint not null,
  game_date date not null,
  start_time timestamptz,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  home_score integer,
  away_score integer,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'final', 'postponed', 'canceled')),
  periods smallint,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index if not exists games_season_date_idx on games (season_id, game_date);
create index if not exists games_home_idx on games (season_id, home_team_id);
create index if not exists games_away_idx on games (season_id, away_team_id);

-- ── Játékos box score ───────────────────────────────────────────────────────
-- close_*/mid_*: a dobás-eseményekből számolt 2 pontos bontás (≤ 8 láb = close);
-- NULL, ha a meccshez nincs dobásadat.
create table if not exists player_game_stats (
  id bigint generated always as identity primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  team_id uuid not null references teams(id),
  season_id uuid not null references seasons(id),
  starter boolean not null default false,
  did_not_play boolean not null default false,
  dnp_reason text,
  minutes numeric(5, 2) not null default 0,
  points integer not null default 0,
  fgm integer not null default 0,
  fga integer not null default 0,
  fg3m integer not null default 0,
  fg3a integer not null default 0,
  ftm integer not null default 0,
  fta integer not null default 0,
  close_made integer,
  close_attempted integer,
  mid_made integer,
  mid_attempted integer,
  oreb integer not null default 0,
  dreb integer not null default 0,
  reb integer not null default 0,
  ast integer not null default 0,
  stl integer not null default 0,
  blk integer not null default 0,
  tov integer not null default 0,
  pf integer not null default 0,
  plus_minus integer,
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);
create index if not exists pgs_season_team_idx on player_game_stats (season_id, team_id);
create index if not exists pgs_player_idx on player_game_stats (player_id, season_id);

-- ── Csapat box score ────────────────────────────────────────────────────────
create table if not exists team_game_stats (
  id bigint generated always as identity primary key,
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id),
  opponent_team_id uuid not null references teams(id),
  season_id uuid not null references seasons(id),
  is_home boolean not null,
  points integer not null default 0,
  fgm integer not null default 0,
  fga integer not null default 0,
  fg3m integer not null default 0,
  fg3a integer not null default 0,
  ftm integer not null default 0,
  fta integer not null default 0,
  oreb integer not null default 0,
  dreb integer not null default 0,
  reb integer not null default 0,
  ast integer not null default 0,
  stl integer not null default 0,
  blk integer not null default 0,
  tov integer not null default 0,
  pf integer not null default 0,
  points_in_paint integer,
  fast_break_points integer,
  points_off_turnovers integer,
  largest_lead integer,
  created_at timestamptz not null default now(),
  unique (game_id, team_id)
);
create index if not exists tgs_season_team_idx on team_game_stats (season_id, team_id);

-- ── Dobás-események (dobástérkép) ──────────────────────────────────────────
-- x, y: nyers ESPN koordináta lábban (x: 0–50 a pálya szélessége,
-- y: távolság a támadott alapvonaltól). Büntetők nem kerülnek ide.
-- zone: rim (≤ 4 láb), paint (≤ 8), mid, corner3, above_break3.
create table if not exists shot_events (
  id bigint generated always as identity primary key,
  game_id uuid not null references games(id) on delete cascade,
  season_id uuid not null references seasons(id),
  team_id uuid not null references teams(id),
  player_id uuid references players(id),
  espn_play_id text not null,
  period smallint not null,
  clock text,
  x numeric(5, 1) not null,
  y numeric(5, 1) not null,
  distance_ft numeric(5, 1) not null,
  zone text not null check (zone in ('rim', 'paint', 'mid', 'corner3', 'above_break3')),
  shot_value smallint not null check (shot_value in (2, 3)),
  made boolean not null,
  shot_type text,
  created_at timestamptz not null default now(),
  unique (game_id, espn_play_id)
);
create index if not exists shots_season_team_idx on shot_events (season_id, team_id);
create index if not exists shots_player_idx on shot_events (player_id, season_id);

-- ── Nyers ESPN válaszok ────────────────────────────────────────────────────
-- Formátumváltás esetén újra-parse-olható letöltés nélkül.
create table if not exists espn_game_raw (
  espn_event_id text primary key,
  game_id uuid references games(id) on delete cascade,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- ── Beállítások: követett csapat ───────────────────────────────────────────
create table if not exists app_settings (
  id boolean primary key default true check (id),
  followed_team_id uuid references teams(id),
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (true) on conflict (id) do nothing;

-- ── RLS: olvasás bejelentkezett felhasználóknak, írás csak service role-lal ─
do $$
declare t text;
begin
  foreach t in array array[
    'seasons', 'teams', 'players', 'games', 'player_game_stats',
    'team_game_stats', 'shot_events', 'espn_game_raw', 'app_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated read" on %I', t);
    execute format(
      'create policy "authenticated read" on %I for select to authenticated using (true)', t
    );
  end loop;
end $$;
