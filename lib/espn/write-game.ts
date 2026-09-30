// Előkészített meccs (StagedGame) írása Supabase-be, service role klienssel.
// Minden írás ESPN azonosítóra (vagy arra épülő természetes kulcsra) upsertel,
// így az ismételt futtatás nem duplikál. A lépések nem közös tranzakció:
// DB-hiba után a meccs újrafuttatása rendbe teszi az állapotot.

import type { NbaClient } from '@/lib/db-schema';
import type { StagedGame } from '@/lib/espn/map-boxscore';
import { encodeRawPayload } from '@/lib/espn/raw-payload';
import { assertInSeasonWindow, SeasonGateError, type SeasonWindow } from '@/lib/espn/season-gate';

interface IdRow {
  id: string;
}

function assertOk(error: { message: string } | null, step: string): void {
  if (error) throw new Error(`${step}: ${error.message}`);
}

/**
 * Szezon-kapu (T4) írás előtt: a szezonnak már léteznie kell (a migráció veszi
 * fel – a közös tárhelykeretbe egyszerre egy szezon fér, ezért az import nem hoz
 * létre újat), és a meccs napja a szezon határai közé esik.
 */
async function resolveSeason(db: NbaClient, staged: StagedGame): Promise<string> {
  const { data, error } = await db
    .from('seasons')
    .select('id, espn_year, start_date, end_date')
    .eq('espn_year', staged.season.espn_year)
    .maybeSingle<IdRow & SeasonWindow>();
  assertOk(error, 'seasons select');
  if (!data) {
    throw new SeasonGateError(`a ${staged.season.espn_year}-es szezon (${staged.season.name}) nincs felvéve az nba.seasons-ben`);
  }
  assertInSeasonWindow(staged.game.game_date, data);
  return data.id;
}

async function upsertIdMap(
  db: NbaClient,
  table: 'teams' | 'players',
  keyColumn: 'espn_team_id' | 'espn_athlete_id',
  rows: Record<string, unknown>[],
): Promise<Map<string, string>> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(table)
    .upsert(rows.map(row => ({ ...row, updated_at: now })), { onConflict: keyColumn })
    .select(`id, ${keyColumn}`);
  assertOk(error, `${table} upsert`);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Record<string, string>[]) map.set(row[keyColumn], row.id);
  return map;
}

function resolve(map: Map<string, string>, espnId: string, what: string): string {
  const id = map.get(espnId);
  if (!id) throw new Error(`Feloldatlan ${what} ESPN ID: ${espnId}`);
  return id;
}

export interface WriteResult {
  gameId: string;
  playerLines: number;
  teamLines: number;
  shots: number;
}

export async function writeGame(db: NbaClient, staged: StagedGame, rawPayload: unknown): Promise<WriteResult> {
  const seasonId = await resolveSeason(db, staged);
  const teamIds = await upsertIdMap(db, 'teams', 'espn_team_id', staged.teams);
  const playerIds = staged.players.length > 0
    ? await upsertIdMap(db, 'players', 'espn_athlete_id', staged.players)
    : new Map<string, string>();

  const { homeEspnTeamId, awayEspnTeamId, ...gameFields } = staged.game;
  const { data: gameRow, error: gameError } = await db
    .from('games')
    .upsert(
      {
        ...gameFields,
        season_id: seasonId,
        home_team_id: resolve(teamIds, homeEspnTeamId, 'csapat'),
        away_team_id: resolve(teamIds, awayEspnTeamId, 'csapat'),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'espn_event_id' },
    )
    .select('id')
    .single<IdRow>();
  assertOk(gameError, 'games upsert');
  const gameId = (gameRow as IdRow).id;

  if (staged.playerLines.length > 0) {
    const rows = staged.playerLines.map(({ espnAthleteId, espnTeamId, ...stats }) => ({
      ...stats,
      game_id: gameId,
      season_id: seasonId,
      player_id: resolve(playerIds, espnAthleteId, 'játékos'),
      team_id: resolve(teamIds, espnTeamId, 'csapat'),
    }));
    const { error } = await db.from('player_game_stats').upsert(rows, { onConflict: 'game_id,player_id' });
    assertOk(error, 'player_game_stats upsert');
  }

  if (staged.teamLines.length > 0) {
    const rows = staged.teamLines.map(({ espnTeamId, espnOpponentTeamId, ...stats }) => ({
      ...stats,
      game_id: gameId,
      season_id: seasonId,
      team_id: resolve(teamIds, espnTeamId, 'csapat'),
      opponent_team_id: resolve(teamIds, espnOpponentTeamId, 'csapat'),
    }));
    const { error } = await db.from('team_game_stats').upsert(rows, { onConflict: 'game_id,team_id' });
    assertOk(error, 'team_game_stats upsert');
  }

  if (staged.shots.length > 0) {
    const rows = staged.shots.map(shot => ({
      game_id: gameId,
      season_id: seasonId,
      team_id: resolve(teamIds, shot.espnTeamId, 'csapat'),
      // A box score-ban nem szereplő dobó (ritka ESPN-hiba) NULL játékossal marad.
      player_id: shot.espnAthleteId ? playerIds.get(shot.espnAthleteId) ?? null : null,
      espn_play_id: shot.espnPlayId,
      period: shot.period,
      clock: shot.clock,
      x: shot.x,
      y: shot.y,
      distance_ft: shot.distanceFt,
      zone: shot.zone,
      shot_value: shot.shotValue,
      made: shot.made,
      shot_type: shot.shotType,
    }));
    const { error } = await db.from('shot_events').upsert(rows, { onConflict: 'game_id,espn_play_id' });
    assertOk(error, 'shot_events upsert');
  }

  const { error: rawError } = await db.from('espn_game_raw').upsert(
    {
      espn_event_id: staged.game.espn_event_id,
      game_id: gameId,
      payload_gz: encodeRawPayload(rawPayload),
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'espn_event_id' },
  );
  assertOk(rawError, 'espn_game_raw upsert');

  return {
    gameId,
    playerLines: staged.playerLines.length,
    teamLines: staged.teamLines.length,
    shots: staged.shots.length,
  };
}
