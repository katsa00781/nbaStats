// Menetrend (jövőbeli meccsek) írása a `nba.games`-be, service role klienssel.
// A lezárt és folyamatban lévő meccsek az `ingest-games` hatáskörébe tartoznak:
// ezeket itt nem írjuk felül, csak a még le nem játszott (scheduled / postponed /
// canceled) sorokat. Minden írás az ESPN event ID-re upsertel.

import type { NbaClient } from '@/lib/db-schema';
import type { EspnScheduleEvent } from '@/lib/espn/schemas';
import type { GameStatus, TableInsert } from '@/lib/supabase';
import { easternDate } from '@/lib/espn/map-boxscore';
import { assertInSeasonWindow, FRANCHISE_TEAM_IDS, type SeasonWindow } from '@/lib/espn/season-gate';
import { requireSeason } from '@/lib/espn/write-game';
import { fetchAllRows } from '@/lib/fetch-all-rows';

const UPSERT_CHUNK = 500;

/** Menetrend-státusz; `null` = folyamatban / lejátszva – az ingest-games dolga. */
export function scheduleStatus(event: Pick<EspnScheduleEvent, 'state' | 'statusName'>): GameStatus | null {
  if (event.statusName === 'STATUS_POSTPONED') return 'postponed';
  if (event.statusName === 'STATUS_CANCELED' || event.statusName === 'STATUS_CANCELLED') return 'canceled';
  return event.state === 'pre' ? 'scheduled' : null;
}

export interface StagedScheduleGame {
  espnEventId: string;
  seasonType: number;
  gameDate: string;
  startTime: string | null;
  homeEspnTeamId: string;
  awayEspnTeamId: string;
  status: GameStatus;
  venue: string | null;
}

export interface StagedSchedule {
  games: StagedScheduleGame[];
  /** Már elkezdődött / lejátszott meccsek (az ingest-games írja őket). */
  notStarted: number;
  warnings: string[];
}

/**
 * Tiszta leképezés: dedup az event ID-re (a meccs mindkét csapat menetrendjében
 * szerepel, T5), státusz, keleti parti nap, szezon-kapu (T4).
 */
export function stageSchedule(events: EspnScheduleEvent[], season: SeasonWindow): StagedSchedule {
  const byId = new Map<string, EspnScheduleEvent>();
  const warnings: string[] = [];
  for (const event of events) {
    const first = byId.get(event.id);
    if (!first) byId.set(event.id, event);
    else if (JSON.stringify(first) !== JSON.stringify(event)) {
      warnings.push(`eltérő menetrend-adat azonos ESPN event ID-val (${event.id}), az első maradt`);
    }
  }

  const games: StagedScheduleGame[] = [];
  let notStarted = 0;
  for (const event of byId.values()) {
    const status = scheduleStatus(event);
    if (!status) {
      notStarted++;
      continue;
    }
    const gameDate = easternDate(event.startTime);
    try {
      assertInSeasonWindow(gameDate, season);
    } catch (error) {
      warnings.push(`${event.name} (${event.id}): ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    games.push({
      espnEventId: event.id,
      seasonType: event.seasonType,
      gameDate,
      startTime: event.timeValid ? event.startTime : null,
      homeEspnTeamId: event.homeEspnTeamId,
      awayEspnTeamId: event.awayEspnTeamId,
      status,
      venue: event.venue,
    });
  }
  return { games, notStarted, warnings };
}

export interface ScheduleWriteResult {
  written: number;
  /** A DB-ben már lezárt / folyamatban lévő meccsek – érintetlenül maradtak. */
  keptOwned: number;
}

export async function writeSchedule(db: NbaClient, espnYear: number, staged: StagedSchedule): Promise<ScheduleWriteResult> {
  const season = await requireSeason(db, espnYear);

  const { data: teamRows, error: teamError } = await db
    .from('teams')
    .select('id, espn_team_id')
    .in('espn_team_id', [...FRANCHISE_TEAM_IDS]);
  if (teamError) throw new Error(`teams select: ${teamError.message}`);
  const teamIds = new Map((teamRows as { id: string; espn_team_id: string }[]).map(t => [t.espn_team_id, t.id]));
  const teamId = (espnId: string): string => {
    const id = teamIds.get(espnId);
    if (!id) throw new Error(`Feloldatlan csapat ESPN ID: ${espnId}`);
    return id;
  };

  const existing = await fetchAllRows<{ espn_event_id: string; status: GameStatus }>((from, to) =>
    db.from('games').select('espn_event_id, status').eq('season_id', season.id).order('espn_event_id').range(from, to),
  );
  const owned = new Set(existing.filter(g => g.status === 'final' || g.status === 'in_progress').map(g => g.espn_event_id));

  const now = new Date().toISOString();
  const rows: (TableInsert<'games'> & { updated_at: string })[] = staged.games
    .filter(game => !owned.has(game.espnEventId))
    .map(game => ({
      espn_event_id: game.espnEventId,
      season_id: season.id,
      season_type: game.seasonType,
      game_date: game.gameDate,
      start_time: game.startTime,
      home_team_id: teamId(game.homeEspnTeamId),
      away_team_id: teamId(game.awayEspnTeamId),
      home_score: null,
      away_score: null,
      status: game.status,
      periods: null,
      venue: game.venue,
      updated_at: now,
    }));

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await db.from('games').upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'espn_event_id' });
    if (error) throw new Error(`games upsert: ${error.message}`);
  }
  return { written: rows.length, keptOwned: staged.games.length - rows.length };
}
