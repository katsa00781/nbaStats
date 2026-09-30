// Rendszerhatár-validáció az ESPN JSON-hoz. Külső csomag nélkül, kézi
// narrowing-gal: a hiányzó / rossz típusú kötelező mező EspnSchemaError-t dob
// a pontos útvonallal, így egy ESPN formátumváltás azonnal látszik.

export class EspnSchemaError extends Error {
  constructor(path: string, expected: string) {
    super(`ESPN séma eltérés: ${path} (várt: ${expected})`);
    this.name = 'EspnSchemaError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function obj(value: unknown, path: string): Obj {
  if (!isObj(value)) throw new EspnSchemaError(path, 'objektum');
  return value;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new EspnSchemaError(path, 'tömb');
  return value;
}

function str(value: unknown, path: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new EspnSchemaError(path, 'szöveg');
}

function num(value: unknown, path: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) throw new EspnSchemaError(path, 'szám');
  return parsed;
}

const optStr = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const optBool = (value: unknown): boolean => value === true;

// ── Scoreboard ─────────────────────────────────────────────────────────────

export interface EspnScoreboardEvent {
  id: string;
  name: string;
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  /** ESPN szezonév (záró év) és -típus (1 előszezon, 2 alapszakasz, 3 rájátszás, 5 play-in). */
  seasonYear: number;
  seasonType: number;
}

export function parseScoreboard(json: unknown): EspnScoreboardEvent[] {
  const root = obj(json, 'scoreboard');
  return arr(root.events, 'scoreboard.events').map((raw, i) => {
    const path = `scoreboard.events[${i}]`;
    const event = obj(raw, path);
    const statusType = obj(obj(event.status, `${path}.status`).type, `${path}.status.type`);
    const state = str(statusType.state, `${path}.status.type.state`);
    if (state !== 'pre' && state !== 'in' && state !== 'post') {
      throw new EspnSchemaError(`${path}.status.type.state`, 'pre | in | post');
    }
    const season = obj(event.season, `${path}.season`);
    return {
      id: str(event.id, `${path}.id`),
      name: str(event.name, `${path}.name`),
      state,
      completed: optBool(statusType.completed),
      seasonYear: num(season.year, `${path}.season.year`),
      seasonType: num(season.type, `${path}.season.type`),
    };
  });
}

// ── Summary ────────────────────────────────────────────────────────────────

export interface EspnTeamInfo {
  espnTeamId: string;
  name: string;
  shortName: string | null;
  abbreviation: string;
  logoUrl: string | null;
}

export interface EspnCompetitor {
  team: EspnTeamInfo;
  homeAway: 'home' | 'away';
  score: number | null;
  periods: number;
}

export interface EspnAthleteLine {
  espnAthleteId: string;
  name: string;
  shortName: string | null;
  position: string | null;
  jersey: string | null;
  headshotUrl: string | null;
  starter: boolean;
  didNotPlay: boolean;
  reason: string | null;
  /** statisztika-kulcs → nyers érték (pl. "fieldGoalsMade-fieldGoalsAttempted" → "5-9") */
  stats: Record<string, string>;
}

export interface EspnTeamBox {
  espnTeamId: string;
  homeAway: 'home' | 'away';
  /** statisztika-név → displayValue */
  stats: Record<string, string>;
  athletes: EspnAthleteLine[];
  /** ESPN ID és statisztika nélküli, kihagyott sorok (rövid név vagy útvonal). */
  skippedAthletes: string[];
}

export interface EspnShotPlay {
  playId: string;
  espnTeamId: string;
  espnAthleteId: string | null;
  period: number;
  clock: string | null;
  x: number;
  y: number;
  pointsAttempted: 2 | 3;
  made: boolean;
  typeText: string | null;
}

export interface EspnGameSummary {
  eventId: string;
  seasonYear: number;
  seasonType: number;
  startTime: string;
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  venue: string | null;
  competitors: [EspnCompetitor, EspnCompetitor];
  teamBoxes: EspnTeamBox[];
  shots: EspnShotPlay[];
  /** Kiszűrt dobások (büntető, érvénytelen koordináta) – validációs naplózáshoz. */
  skippedShots: number;
}

function parseHomeAway(value: unknown, path: string): 'home' | 'away' {
  if (value === 'home' || value === 'away') return value;
  throw new EspnSchemaError(path, 'home | away');
}

function parseCompetitor(raw: unknown, path: string): EspnCompetitor {
  const competitor = obj(raw, path);
  const team = obj(competitor.team, `${path}.team`);
  const logos = Array.isArray(team.logos) ? team.logos : [];
  const firstLogo = logos.find(isObj);
  const scoreRaw = competitor.score;
  return {
    team: {
      espnTeamId: str(team.id, `${path}.team.id`),
      name: str(team.displayName, `${path}.team.displayName`),
      shortName: optStr(team.name),
      abbreviation: str(team.abbreviation, `${path}.team.abbreviation`),
      logoUrl: firstLogo ? optStr(firstLogo.href) : null,
    },
    homeAway: parseHomeAway(competitor.homeAway, `${path}.homeAway`),
    score: scoreRaw === undefined || scoreRaw === '' ? null : num(scoreRaw, `${path}.score`),
    periods: Array.isArray(competitor.linescores) ? competitor.linescores.length : 0,
  };
}

/** Üres stat-tömb, vagy minden érték nulla / üres ("0", "0-0", "+0", "--"). */
const isStatless = (values: unknown[]): boolean =>
  values.every(v => v === 0 || (typeof v === 'string' && /^(?:[+-]?0(?:-0)?|--)?$/.test(v)));

/**
 * ESPN ID nélküli sor: az ESPN néha csak `shortName`-mel küld egy keretbe frissen
 * került, pályára nem lépett játékost (2026-03-01, MIL–CHI). Név alapján nem
 * párosítunk (T2), ezért statisztika nélkül kihagyjuk (`null`); ha van
 * statisztikája, az adatvesztés lenne → EspnSchemaError, mint eddig.
 */
function parseAthlete(raw: unknown, keys: string[], path: string): EspnAthleteLine | null {
  const line = obj(raw, path);
  const athlete = obj(line.athlete, `${path}.athlete`);
  const values = arr(line.stats, `${path}.stats`);
  if (athlete.id === undefined && isStatless(values)) return null;
  const stats: Record<string, string> = {};
  // DNP játékosnál a stats tömb üres – ilyenkor nincs mit párosítani.
  if (values.length > 0) {
    if (values.length !== keys.length) throw new EspnSchemaError(`${path}.stats`, `${keys.length} elem`);
    keys.forEach((key, i) => { stats[key] = str(values[i], `${path}.stats[${i}]`); });
  }
  const position = isObj(athlete.position) ? optStr(athlete.position.abbreviation) : null;
  const headshot = isObj(athlete.headshot) ? optStr(athlete.headshot.href) : null;
  return {
    espnAthleteId: str(athlete.id, `${path}.athlete.id`),
    name: str(athlete.displayName, `${path}.athlete.displayName`),
    shortName: optStr(athlete.shortName),
    position,
    jersey: optStr(athlete.jersey),
    headshotUrl: headshot,
    starter: optBool(line.starter),
    didNotPlay: optBool(line.didNotPlay),
    reason: optStr(line.reason),
    stats,
  };
}

function parseTeamBoxes(boxscore: Obj): EspnTeamBox[] {
  const teamStats = new Map<string, { homeAway: 'home' | 'away'; stats: Record<string, string> }>();
  arr(boxscore.teams, 'boxscore.teams').forEach((raw, i) => {
    const path = `boxscore.teams[${i}]`;
    const entry = obj(raw, path);
    const stats: Record<string, string> = {};
    arr(entry.statistics, `${path}.statistics`).forEach((s, j) => {
      const stat = obj(s, `${path}.statistics[${j}]`);
      stats[str(stat.name, `${path}.statistics[${j}].name`)] = str(stat.displayValue, `${path}.statistics[${j}].displayValue`);
    });
    teamStats.set(str(obj(entry.team, `${path}.team`).id, `${path}.team.id`), {
      homeAway: parseHomeAway(entry.homeAway, `${path}.homeAway`),
      stats,
    });
  });

  return arr(boxscore.players, 'boxscore.players').map((raw, i) => {
    const path = `boxscore.players[${i}]`;
    const entry = obj(raw, path);
    const espnTeamId = str(obj(entry.team, `${path}.team`).id, `${path}.team.id`);
    const group = obj(arr(entry.statistics, `${path}.statistics`)[0], `${path}.statistics[0]`);
    const keys = arr(group.keys, `${path}.statistics[0].keys`).map((k, j) => str(k, `${path}.statistics[0].keys[${j}]`));
    const athletes: EspnAthleteLine[] = [];
    const skippedAthletes: string[] = [];
    arr(group.athletes, `${path}.statistics[0].athletes`).forEach((a, j) => {
      const athletePath = `${path}.statistics[0].athletes[${j}]`;
      const parsed = parseAthlete(a, keys, athletePath);
      if (parsed) {
        athletes.push(parsed);
      } else {
        const athlete = obj(obj(a, athletePath).athlete, `${athletePath}.athlete`);
        skippedAthletes.push(optStr(athlete.shortName) ?? optStr(athlete.displayName) ?? athletePath);
      }
    });
    const team = teamStats.get(espnTeamId);
    if (!team) throw new EspnSchemaError(`boxscore.teams[team.id=${espnTeamId}]`, 'csapat-összesítő');
    return { espnTeamId, homeAway: team.homeAway, stats: team.stats, athletes, skippedAthletes };
  });
}

// A büntetőknél az ESPN érvénytelen koordinátát küld (≈ -2^31); a pálya
// félpályás tartománya bőven -10..60 lábon belül van.
const isCourtCoordinate = (x: number, y: number) => x >= -5 && x <= 55 && y >= -10 && y <= 60;

function parseShots(plays: unknown[]): { shots: EspnShotPlay[]; skipped: number } {
  const shots: EspnShotPlay[] = [];
  let skipped = 0;
  plays.forEach((raw, i) => {
    const path = `plays[${i}]`;
    const play = obj(raw, path);
    if (play.shootingPlay !== true) return;
    const pointsAttempted = num(play.pointsAttempted, `${path}.pointsAttempted`);
    const coordinate = isObj(play.coordinate) ? play.coordinate : null;
    const x = coordinate ? Number(coordinate.x) : NaN;
    const y = coordinate ? Number(coordinate.y) : NaN;
    if ((pointsAttempted !== 2 && pointsAttempted !== 3) || !isCourtCoordinate(x, y)) {
      skipped++;
      return;
    }
    const participants = Array.isArray(play.participants) ? play.participants : [];
    const shooter = participants.find(isObj);
    const shooterAthlete = shooter && isObj(shooter.athlete) ? shooter.athlete : null;
    shots.push({
      playId: str(play.id, `${path}.id`),
      espnTeamId: str(obj(play.team, `${path}.team`).id, `${path}.team.id`),
      espnAthleteId: shooterAthlete ? optStr(shooterAthlete.id) : null,
      period: num(obj(play.period, `${path}.period`).number, `${path}.period.number`),
      clock: isObj(play.clock) ? optStr(play.clock.displayValue) : null,
      x,
      y,
      pointsAttempted,
      made: optBool(play.scoringPlay),
      typeText: isObj(play.type) ? optStr(play.type.text) : null,
    });
  });
  return { shots, skipped };
}

export function parseSummary(json: unknown): EspnGameSummary {
  const root = obj(json, 'summary');
  const header = obj(root.header, 'header');
  const season = obj(header.season, 'header.season');
  const competition = obj(arr(header.competitions, 'header.competitions')[0], 'header.competitions[0]');
  const statusType = obj(obj(competition.status, 'competition.status').type, 'competition.status.type');
  const state = str(statusType.state, 'competition.status.type.state');
  if (state !== 'pre' && state !== 'in' && state !== 'post') {
    throw new EspnSchemaError('competition.status.type.state', 'pre | in | post');
  }

  const competitors = arr(competition.competitors, 'competition.competitors')
    .map((c, i) => parseCompetitor(c, `competition.competitors[${i}]`));
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  if (competitors.length !== 2 || !home || !away) {
    throw new EspnSchemaError('competition.competitors', 'pontosan egy hazai és egy vendég');
  }

  const gameInfo = isObj(root.gameInfo) ? root.gameInfo : {};
  const venue = isObj(gameInfo.venue) ? optStr(gameInfo.venue.fullName) : null;
  const completed = optBool(statusType.completed);
  const boxscore = obj(root.boxscore, 'boxscore');
  const { shots, skipped } = Array.isArray(root.plays) ? parseShots(root.plays) : { shots: [], skipped: 0 };

  return {
    eventId: str(competition.id, 'competition.id'),
    seasonYear: num(season.year, 'header.season.year'),
    seasonType: num(season.type, 'header.season.type'),
    startTime: str(competition.date, 'competition.date'),
    state,
    completed,
    venue,
    competitors: [home, away],
    teamBoxes: state === 'pre' ? [] : parseTeamBoxes(boxscore),
    shots,
    skippedShots: skipped,
  };
}
