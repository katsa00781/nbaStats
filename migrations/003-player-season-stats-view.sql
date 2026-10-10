-- 003 – Játékos szezon-összesítő view (`nba.player_season_stats_by_season`)
-- Futtatás: KIZÁRÓLAG kézzel, a Supabase SQL Editorban, az `ugkettlebell` projektben.
--
-- Az ASEStats azonos nevű view-jának NBA-megfelelője: az összegek neve
-- (`total_*`, `games_played`) megegyezik, így a `player-stat-mapping` kis
-- módosítással átvehető. Eltérések a semleges NBA sémához igazítva:
--
--   * Egy sor = játékos × szezon × szezontípus × csapat. A csapat a meccs-sorból
--     jön (`player_game_stats.team_id`, T9), ezért a szezon közben igazolt
--     játékosnak csapatonként külön sora van; a ligaszintű összesítés a
--     kliensben adja össze őket.
--   * `season_type` külön dimenzió (2 = alapszakasz, 3 = rájátszás, 5 = play-in):
--     az alapszakasz és a rájátszás statisztikája nem keveredik. A lekérdezés
--     szűrjön rá (`.eq('season_type', 2)`).
--   * A DNP sorok kimaradnak (T8): a `games_played` csak a pályára lépést számolja,
--     és akinek csak DNP sora van, annak nincs sora a view-ban.
--   * Csak lezárt (`final`) meccsek számítanak.
--   * `total_fgm` / `total_fga` a box score-ból jön – a kísérletszám forrása ez.
--     A `total_close_*` / `total_mid_*` a dobás-eseményekből számolt bontás,
--     NULL, ha nincs dobásadat. A meccs-sorok kb. 0,3%-ánál `close + mid ≠
--     FGA − 3PA`; szezonszinten ez összeadódik (2025/26 alapszakasz: a 661 sorból
--     81-nél van néhány dobásnyi eltérés), ezért arányhoz jó, darabszámhoz nem.
--   * Nincs `total_valuation` / `avg_valuation`: a valuation lineáris, ezért az
--     összegekből a `lib/stat-formulas.ts` `simpleValuation()` függvénye számolja
--     (a képlet egy helyen él, T22). Nincs `total_fouls_drawn` (az ESPN nem adja).
--   * A név, a pozíció és a mezszám a játékos-törzsadatból jön (az aktuális érték,
--     nem a csapatnál töltött időszaké).
--
-- `security_invoker = true`: a view a lekérdező jogaival fut, így az alaptáblák
-- RLS-e érvényes (olvasás csak bejelentkezett felhasználónak).
-- Újrafuttatható: a view-t eldobja és újra létrehozza; táblához nem nyúl.

drop view if exists nba.player_season_stats_by_season;

create view nba.player_season_stats_by_season
with (security_invoker = true)
as
select
  pgs.season_id,
  s.name as season_name,
  g.season_type,
  pgs.player_id,
  p.name,
  p.short_name,
  p.position,
  p.jersey,
  p.headshot_url,
  pgs.team_id,
  t.name as team_name,
  t.short_name as team_short_name,
  t.abbreviation as team_abbreviation,
  count(*)::integer as games_played,
  (count(*) filter (where pgs.starter))::integer as games_started,
  sum(pgs.minutes) as total_minutes,
  sum(pgs.points)::integer as total_points,
  sum(pgs.fgm)::integer as total_fgm,
  sum(pgs.fga)::integer as total_fga,
  sum(pgs.close_made)::integer as total_close_made,
  sum(pgs.close_attempted)::integer as total_close_attempted,
  sum(pgs.mid_made)::integer as total_mid_made,
  sum(pgs.mid_attempted)::integer as total_mid_attempted,
  sum(pgs.fg3m)::integer as total_three_made,
  sum(pgs.fg3a)::integer as total_three_attempted,
  sum(pgs.ftm)::integer as total_free_throw_made,
  sum(pgs.fta)::integer as total_free_throw_attempted,
  sum(pgs.oreb)::integer as total_offensive_rebounds,
  sum(pgs.dreb)::integer as total_defensive_rebounds,
  sum(pgs.reb)::integer as total_rebounds,
  sum(pgs.ast)::integer as total_assists,
  sum(pgs.stl)::integer as total_steals,
  sum(pgs.blk)::integer as total_blocks,
  sum(pgs.tov)::integer as total_turnovers,
  sum(pgs.pf)::integer as total_fouls_committed,
  sum(pgs.plus_minus)::integer as total_plus_minus
from nba.player_game_stats pgs
join nba.games g on g.id = pgs.game_id
join nba.seasons s on s.id = pgs.season_id
join nba.players p on p.id = pgs.player_id
join nba.teams t on t.id = pgs.team_id
where not pgs.did_not_play
  and g.status = 'final'
group by
  pgs.season_id, s.name, g.season_type,
  pgs.player_id, p.name, p.short_name, p.position, p.jersey, p.headshot_url,
  pgs.team_id, t.name, t.short_name, t.abbreviation;

comment on view nba.player_season_stats_by_season is
  'Játékos szezon-összesítő: játékos × szezon × szezontípus × csapat, DNP nélkül, csak lezárt meccsekből.';

-- ── Jogosultságok ──────────────────────────────────────────────────────────
-- Olvasás: bejelentkezett felhasználó (az alaptáblák RLS-e mellett); az anon nem.
grant select on nba.player_season_stats_by_season to authenticated, service_role;
