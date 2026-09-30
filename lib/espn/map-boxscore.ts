// Validált ESPN összefoglaló → az adatbázis sorainak előkészített ("staged")
// alakja. A sorok itt még ESPN azonosítókkal hivatkoznak egymásra; a DB UUID-k
// feloldása az író (ingest) dolga. Tiszta függvények, hálózat és DB nélkül.

import type { GameStatus, ShotZone, TableInsert } from '@/lib/supabase';
import type { EspnGameSummary, EspnShotPlay, EspnTeamBox } from '@/lib/espn/schemas';
import { closeMidByAthlete, isMissedHeave, shotDistanceFt, shotZone } from '@/lib/espn/map-shots';

type PlayerLineStats = Omit<TableInsert<'player_game_stats'>, 'game_id' | 'player_id' | 'team_id' | 'season_id'>;
type TeamLineStats = Omit<TableInsert<'team_game_stats'>, 'game_id' | 'team_id' | 'opponent_team_id' | 'season_id'>;

export interface StagedPlayerLine extends PlayerLineStats {
  espnAthleteId: string;
  espnTeamId: string;
}

export interface StagedTeamLine extends TeamLineStats {
  espnTeamId: string;
  espnOpponentTeamId: string;
}

export interface StagedShot {
  espnPlayId: string;
  espnTeamId: string;
  espnAthleteId: string | null;
  period: number;
  clock: string | null;
  x: number;
  y: number;
  distanceFt: number;
  zone: ShotZone;
  shotValue: 2 | 3;
  made: boolean;
  shotType: string | null;
}

export interface StagedGame {
  season: TableInsert<'seasons'>;
  teams: TableInsert<'teams'>[];
  players: TableInsert<'players'>[];
  game: Omit<TableInsert<'games'>, 'season_id' | 'home_team_id' | 'away_team_id'> & {
    homeEspnTeamId: string;
    awayEspnTeamId: string;
  };
  playerLines: StagedPlayerLine[];
  teamLines: StagedTeamLine[];
  shots: StagedShot[];
  /** Kihagyott heave-dobások száma (nem FGA, lásd `isMissedHeave`). */
  heavesExcluded: number;
  /** Belső konzisztencia-ellenőrzés eredménye; üres = rendben. */
  warnings: string[];
  /** Tájékoztató: szándékos, szabály szerinti kihagyások (nem adathiba). */
  notices: string[];
}

/** "5-9" → [5, 9]; hiányzó érték → [0, 0]. */
function madeAttempted(value: string | undefined): [number, number] {
  if (!value) return [0, 0];
  const [made, attempted] = value.split('-').map(Number);
  return [Number.isFinite(made) ? made : 0, Number.isFinite(attempted) ? attempted : 0];
}

function int(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optInt(value: string | undefined): number | null {
  if (value === undefined || value === '' || value === '--') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Az ESPN időpontja UTC; a menetrendi dátum az amerikai keleti parti helyi nap. */
export const easternDate = (isoTime: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(isoTime));

/** ESPN szezonév (záró év) → "2024/2025". */
export const seasonName = (espnYear: number): string => `${espnYear - 1}/${espnYear}`;

function gameStatus(summary: EspnGameSummary): GameStatus {
  if (summary.state === 'post') return summary.completed ? 'final' : 'postponed';
  return summary.state === 'in' ? 'in_progress' : 'scheduled';
}

function teamLine(box: EspnTeamBox, opponent: EspnTeamBox, points: number): StagedTeamLine {
  const s = box.stats;
  const [fgm, fga] = madeAttempted(s['fieldGoalsMade-fieldGoalsAttempted']);
  const [fg3m, fg3a] = madeAttempted(s['threePointFieldGoalsMade-threePointFieldGoalsAttempted']);
  const [ftm, fta] = madeAttempted(s['freeThrowsMade-freeThrowsAttempted']);
  return {
    espnTeamId: box.espnTeamId,
    espnOpponentTeamId: opponent.espnTeamId,
    is_home: box.homeAway === 'home',
    points,
    fgm, fga, fg3m, fg3a, ftm, fta,
    oreb: int(s.offensiveRebounds),
    dreb: int(s.defensiveRebounds),
    reb: int(s.totalRebounds),
    ast: int(s.assists),
    stl: int(s.steals),
    blk: int(s.blocks),
    // A labdabirtoklás-becsléshez a csapatszintű eladott labdák is kellenek.
    tov: int(s.totalTurnovers ?? s.turnovers),
    pf: int(s.fouls),
    points_in_paint: optInt(s.pointsInPaint),
    fast_break_points: optInt(s.fastBreakPoints),
    points_off_turnovers: optInt(s.turnoverPoints),
    largest_lead: optInt(s.largestLead),
  };
}

/**
 * Batch upsert előtti dedup a (game_id, espn_play_id) kulcsra (T5): kulcsütközésnél
 * a teljes batch elbukna. Azonos tartalmú ismétlés → egy marad, tájékoztatással;
 * azonos ID eltérő tartalommal → az első marad, figyelmeztetéssel.
 */
function dedupeShots(shots: EspnShotPlay[], notices: string[], warnings: string[]): EspnShotPlay[] {
  const byId = new Map<string, EspnShotPlay>();
  let identical = 0;
  for (const shot of shots) {
    const first = byId.get(shot.playId);
    if (!first) {
      byId.set(shot.playId, shot);
    } else if (JSON.stringify(first) === JSON.stringify(shot)) {
      identical++;
    } else {
      warnings.push(`eltérő tartalmú dobás-esemény azonos ESPN play ID-val (${shot.playId}), az első maradt`);
    }
  }
  if (identical > 0) notices.push(`${identical} duplikált dobás-esemény (azonos play ID és tartalom) kiszűrve`);
  return [...byId.values()];
}

export function mapSummary(summary: EspnGameSummary): StagedGame {
  const [home, away] = summary.competitors;
  const warnings: string[] = [];
  const notices: string[] = [];
  // Csak az FGA-nak számító dobások: a kihagyott heave-ek kiesnek (map-shots.ts),
  // a duplikált play ID-k pedig még a close/mid bontás és az egyeztetés előtt.
  const fieldGoalShots = dedupeShots(summary.shots.filter(shot => !isMissedHeave(shot)), notices, warnings);
  const closeMid = closeMidByAthlete(fieldGoalShots);
  const hasShots = summary.shots.length > 0;

  for (const box of summary.teamBoxes) {
    for (const name of box.skippedAthletes) {
      notices.push(`${box.espnTeamId}: ESPN ID és statisztika nélküli játékos kihagyva (${name})`);
    }
  }

  const players = new Map<string, TableInsert<'players'>>();
  const playerLines: StagedPlayerLine[] = [];

  for (const box of summary.teamBoxes) {
    for (const athlete of box.athletes) {
      // A (game_id, player_id) kulcs egy batch-en belül nem ütközhet (T5); a
      // duplikált játékossor kétes adat, ezért figyelmeztetés, nem csendes szűrés.
      if (players.has(athlete.espnAthleteId)) {
        warnings.push(`${box.espnTeamId}: duplikált játékossor (ESPN ${athlete.espnAthleteId}, ${athlete.name}), az első maradt`);
        continue;
      }
      players.set(athlete.espnAthleteId, {
        espn_athlete_id: athlete.espnAthleteId,
        name: athlete.name,
        short_name: athlete.shortName,
        position: athlete.position,
        jersey: athlete.jersey,
        headshot_url: athlete.headshotUrl,
      });

      const s = athlete.stats;
      const [fgm, fga] = madeAttempted(s['fieldGoalsMade-fieldGoalsAttempted']);
      const [fg3m, fg3a] = madeAttempted(s['threePointFieldGoalsMade-threePointFieldGoalsAttempted']);
      const [ftm, fta] = madeAttempted(s['freeThrowsMade-freeThrowsAttempted']);
      const split = hasShots ? closeMid.get(athlete.espnAthleteId) : undefined;
      const zeroSplit = hasShots && !split;

      playerLines.push({
        espnAthleteId: athlete.espnAthleteId,
        espnTeamId: box.espnTeamId,
        starter: athlete.starter,
        did_not_play: athlete.didNotPlay,
        dnp_reason: athlete.didNotPlay ? athlete.reason : null,
        minutes: int(s.minutes),
        points: int(s.points),
        fgm, fga, fg3m, fg3a, ftm, fta,
        close_made: split?.closeMade ?? (zeroSplit ? 0 : null),
        close_attempted: split?.closeAttempted ?? (zeroSplit ? 0 : null),
        mid_made: split?.midMade ?? (zeroSplit ? 0 : null),
        mid_attempted: split?.midAttempted ?? (zeroSplit ? 0 : null),
        oreb: int(s.offensiveRebounds),
        dreb: int(s.defensiveRebounds),
        reb: int(s.rebounds),
        ast: int(s.assists),
        stl: int(s.steals),
        blk: int(s.blocks),
        tov: int(s.turnovers),
        pf: int(s.fouls),
        plus_minus: optInt(s.plusMinus),
      });
    }
  }

  const homeBox = summary.teamBoxes.find(b => b.espnTeamId === home.team.espnTeamId);
  const awayBox = summary.teamBoxes.find(b => b.espnTeamId === away.team.espnTeamId);
  const teamLines: StagedTeamLine[] = [];
  if (homeBox && awayBox) {
    teamLines.push(teamLine(homeBox, awayBox, home.score ?? 0), teamLine(awayBox, homeBox, away.score ?? 0));
  } else if (summary.teamBoxes.length > 0) {
    warnings.push('A box score csapatai nem egyeznek a fejléc csapataival.');
  }

  // Konzisztencia: játékos-összeg = csapat-összesítő; dobás-események ≈ FGA.
  for (const line of teamLines) {
    const own = playerLines.filter(p => p.espnTeamId === line.espnTeamId);
    const sumPoints = own.reduce((acc, p) => acc + p.points, 0);
    const sumFga = own.reduce((acc, p) => acc + p.fga, 0);
    const shotCount = fieldGoalShots.filter(s => s.espnTeamId === line.espnTeamId).length;
    if (sumPoints !== line.points) warnings.push(`${line.espnTeamId}: játékospont-összeg ${sumPoints} ≠ csapatpont ${line.points}`);
    if (sumFga !== line.fga) warnings.push(`${line.espnTeamId}: játékos FGA-összeg ${sumFga} ≠ csapat FGA ${line.fga}`);
    if (hasShots && shotCount !== line.fga) warnings.push(`${line.espnTeamId}: ${shotCount} dobás-esemény ≠ ${line.fga} FGA`);
  }

  return {
    season: { espn_year: summary.seasonYear, name: seasonName(summary.seasonYear), start_date: null, end_date: null },
    teams: [home, away].map(c => ({
      espn_team_id: c.team.espnTeamId,
      name: c.team.name,
      short_name: c.team.shortName,
      abbreviation: c.team.abbreviation,
      conference: null,
      division: null,
      logo_url: c.team.logoUrl,
    })),
    players: [...players.values()],
    game: {
      espn_event_id: summary.eventId,
      season_type: summary.seasonType,
      game_date: easternDate(summary.startTime),
      start_time: summary.startTime,
      homeEspnTeamId: home.team.espnTeamId,
      awayEspnTeamId: away.team.espnTeamId,
      home_score: home.score,
      away_score: away.score,
      status: gameStatus(summary),
      periods: Math.max(home.periods, away.periods) || null,
      venue: summary.venue,
    },
    playerLines,
    teamLines,
    shots: fieldGoalShots.map(shot => ({
      espnPlayId: shot.playId,
      espnTeamId: shot.espnTeamId,
      espnAthleteId: shot.espnAthleteId,
      period: shot.period,
      clock: shot.clock,
      x: shot.x,
      y: shot.y,
      distanceFt: shotDistanceFt(shot.x, shot.y),
      zone: shotZone(shot),
      shotValue: shot.pointsAttempted,
      made: shot.made,
      shotType: shot.typeText,
    })),
    heavesExcluded: summary.shots.length - fieldGoalShots.length,
    warnings,
    notices,
  };
}
