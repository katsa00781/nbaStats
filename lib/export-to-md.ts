// Markdown exportok külső elemzéshez (pl. egy LLM-be másolható riport). Tiszta
// függvények: a nézetek már betöltött adatából szöveget állítanak elő, lekérdezés és
// DOM nélkül. Az ASEStats `export-to-md` szakaszszerkezetét követik, de az NBA
// adattípusaira írva: a Kosarstat-, negyed-, lineup- és dobástérkép-szakaszok nincsenek
// (nincs hozzájuk adat), a pontforrás és a rotáció sem.

import type { PlayerAnalysisOutcome } from '@/lib/adapters/player-analysis-adapter';
import type { BoxScorePlayer, BoxScoreTeam, BoxScoreTeamTotals } from '@/lib/box-score-data';
import type { PlayerGameLogEntry } from '@/lib/player-game-log-data';
import type { PlayerSeasonStats } from '@/lib/player-data';
import type { PostGameReport, PostgameBoxScoreLine } from '@/lib/postgame-report';
import type { TeamAnalysis } from '@/lib/team-analysis';
import type { TeamMetricRow } from '@/lib/team-stats-metrics';
import { formatGameDate } from '@/lib/format-date';
import { SKILL_LABELS, type SkillScores } from '@/lib/player-analysis';
import {
  ENGINE_MIN_SCORE,
  ENGINE_MINUTES,
  ENGINE_STARTER_MINUTES,
  INEFFICIENT_MAX_TS_PCT,
  ROLE_PLAYER_MIN_MINUTES,
  ROLE_PLAYER_MIN_TS_PCT,
  ROLE_PLAYER_MIN_VAL_PER36,
  SUPPORT_MIN_SCORE,
  USG_HIGH_MIN,
  USG_LOW_MAX,
} from '@/lib/player-postgame';
import { buildPostgameAutoFocus, composePostgameSummary, describePostgameBaselineNote } from '@/lib/postgame-report';
import { effectiveFgPct, freeThrowRate, offensiveReboundPct, trueShootingPct, turnoverPct } from '@/lib/stat-formulas';
import { finalizeDefenseStyle, finalizeOffenseStyle } from '@/lib/style-vocabulary';

const EMPTY = '–';

const signed1 = (value: number, suffix = ''): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;
const signedInt = (value: number): string => `${value > 0 ? '+' : ''}${value}`;
const pct1 = (value: number | null): string => (value === null ? EMPTY : `${value.toFixed(1)}%`);
const made = (m: number, a: number): string => `${m}/${a}`;
const shootPct = (m: number, a: number): string => (a > 0 ? `${((m / a) * 100).toFixed(1)}%` : EMPTY);

/** Markdown-táblacella: a cső és a sortörés kikerül, hogy ne törje a táblát. */
const cell = (value: string | number): string => String(value).replace(/\|/g, '/').replace(/\n/g, ' ');

function table(headers: string[], rows: Array<Array<string | number>>): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(header => '-'.repeat(Math.max(header.length + 2, 3))).join('|')}|`,
    ...rows.map(row => `| ${row.map(cell).join(' | ')} |`),
  ];
}

// ---------------------------------------------------------------------------
// Meccs utáni riport
// ---------------------------------------------------------------------------

export interface PostgameMdMeta {
  seasonName: string;
  /** A meccs dátuma (`YYYY-MM-DD`), a szakasz neve és a pályaválasztás a fejléchez. */
  gameDate: string;
  stageLabel: string;
  isHome: boolean;
  venue: string | null;
  /** Volt-e liga-benchmark a szakaszban (különben csak a szezonátlag a referencia). */
  hasLeagueBenchmark: boolean;
}

/** Kulcsmutatók, ahol az alacsonyabb érték a jobb – a delta irányjelöléséhez. */
const LOWER_IS_BETTER_STATS = new Set(['turnover_rate']);

export function postgameReportToMd(report: PostGameReport, meta: PostgameMdMeta): string {
  const result = report.result === 'win' ? 'Győzelem' : 'Vereség';
  const margin = report.metrics.margin;
  const baselineLabel = report.baseline?.label ?? 'Szezon átl.';
  const ratings = report.metrics.ratings ?? null;
  const comparable = report.baseline?.comparable ?? true;
  const refCell = (value: number | null | undefined) => (value === null || value === undefined ? EMPTY : value.toFixed(1));
  // Irányjelölés: ▲ a saját csapatnak kedvező, ▼ kedvezőtlen eltérés – a TO rate-nél és a
  // DRtg-nél az alacsonyabb érték a jobb, ezért az előjel önmagában félrevezető.
  const directionMark = (delta: number, higherIsBetter: boolean | null) => {
    if (higherIsBetter === null || Math.abs(delta) < 0.05) return '';
    return (delta > 0) === higherIsBetter ? ' ▲' : ' ▼';
  };
  const deltaCell = (game: number, ref: number | null | undefined, higherIsBetter: boolean | null = null) =>
    ref === null || ref === undefined ? EMPTY : `${signed1(game - ref)}${directionMark(game - ref, higherIsBetter)}`;

  const lines: string[] = [
    `# Postgame elemzés: ${report.teamName} vs ${report.opponentName}`,
    ``,
    `**Szezon:** ${meta.seasonName} | **Szakasz:** ${meta.stageLabel}`,
    `**Mérkőzés:** ${formatGameDate(meta.gameDate)} · ${meta.isHome ? 'hazai' : 'vendég'}${meta.venue ? ` · ${meta.venue}` : ''}`,
    `**Eredmény:** ${result} ${report.metrics.pointsFor}–${report.metrics.pointsAgainst} (különbség: ${signedInt(margin)})`,
    `**Referencia:** ${baselineLabel}`,
  ];

  if (report.baseline?.smallSample) {
    lines.push(
      ``,
      `> **Kis minta:** a csapatnak ${report.baseline.seasonGames} másik meccse van a szakaszban, a szezonátlag még nem értelmezhető viszonyítási alap.` +
        (report.baseline.kind === 'league'
          ? ' A deltaoszlop és a célértékek a liga mediánjához mérnek.'
          : ' Liga benchmark sem érhető el, ezért a deltaoszlop üres.'),
    );
  }

  // Liga medián oszlop: a szezonátlag mellé a ligához mért helyzet is kell. Ha a
  // referencia maga a liga medián, az oszlop ismétlés volna.
  const showLeague = report.baseline?.kind !== 'league' && report.metrics.keyStats.some(stat => stat.leagueMedian !== undefined);
  const leagueHead = showLeague ? ' Liga medián | vs liga |' : '';
  const leagueRule = showLeague ? '-------------|---------|' : '';
  const noLeague = showLeague ? ' – | – |' : '';

  lines.push(
    ``,
    `## Kulcs mutatók`,
    ``,
    `| Mutató | Meccs | ${baselineLabel} | Delta |${leagueHead}`,
    `|--------|-------|-------------|-------|${leagueRule}`,
    `| Birtoklás (tempó) | ${report.metrics.pace.toFixed(1)} | ${refCell(ratings?.refPossessions)} | ${deltaCell(report.metrics.pace, ratings?.refPossessions)} |${noLeague}`,
  );
  for (const stat of report.metrics.keyStats) {
    const unit = stat.unit === 'pct' ? '%' : '';
    const higherIsBetter = !LOWER_IS_BETTER_STATS.has(stat.key);
    const delta = comparable
      ? `${signed1(stat.delta, stat.unit === 'pct' ? ' pp' : '')}${directionMark(stat.delta, higherIsBetter)}`
      : EMPTY;
    const league = !showLeague
      ? ''
      : stat.leagueMedian === undefined
        ? ' – | – |'
        : ` ${stat.leagueMedian.toFixed(1)}${unit} | ${signed1(stat.game - stat.leagueMedian, stat.unit === 'pct' ? ' pp' : '')}${directionMark(stat.game - stat.leagueMedian, higherIsBetter)} |`;
    lines.push(`| ${stat.label} | ${stat.game.toFixed(1)}${unit} | ${comparable ? `${stat.season.toFixed(1)}${unit}` : EMPTY} | ${delta} |${league}`);
  }
  if (ratings) {
    lines.push(
      `| ORtg | ${ratings.ortg.toFixed(1)} | ${refCell(ratings.refOrtg)} | ${deltaCell(ratings.ortg, ratings.refOrtg, true)} |${noLeague}`,
      `| DRtg (alacsonyabb a jobb) | ${ratings.drtg.toFixed(1)} | ${refCell(ratings.refDrtg)} | ${deltaCell(ratings.drtg, ratings.refDrtg, false)} |${noLeague}`,
      `| Net rating | ${signed1(ratings.net)} | ${ratings.refNet !== null ? signed1(ratings.refNet) : EMPTY} | ${deltaCell(ratings.net, ratings.refNet, true)} |${noLeague}`,
    );
  }
  lines.push(
    ``,
    `*▲ = a saját csapatnak kedvező, ▼ = kedvezőtlen eltérés (a TO rate-nél és a DRtg-nél az alacsonyabb érték a jobb); a tempó nem minősített.*`,
    ``,
    `*Birtoklás = a két csapat (FGA + 0,44·FTA + LV − T-lep) becslésének átlaga – a tempó és mindkét rating közös nevezője, így a DRtg megegyezik az ellenfél ORtg-jével. TO rate (Oliver) = LV / (FGA + 0,44·FTA + LV). FTM rate = értékesített büntető / FGA. ORtg / DRtg = szerzett / kapott pont 100 közös birtoklásra.${comparable ? ` A ${baselineLabel.toLowerCase()} a vizsgált meccs nélkül számolódik.` : ''}${showLeague ? ' Liga medián = a szakasz legalább 10 meccset játszott csapatainak középértéke; „vs liga” = meccs − liga medián.' : ''}*`,
  );

  const opp = report.metrics.opponent;
  if (opp) {
    lines.push(
      ``,
      `## Ellenfél dobás és kontroll`,
      ``,
      ...table(
        ['Mutató', report.opponentName],
        [
          ['eFG%', `${opp.efg.toFixed(1)}%`],
          ['3P (dobott/kísérlet)', `${opp.fgm3}/${opp.fga3} (${opp.fga3 > 0 ? `${opp.threePct.toFixed(1)}%` : EMPTY})`],
          ['FTM rate (FTM/FGA)', `${opp.ftRate.toFixed(1)}%`],
          ['OREB%', `${opp.orebRate.toFixed(1)}%`],
          ['TO rate (Oliver)', `${opp.turnoverRate.toFixed(1)}%`],
        ],
      ),
    );
  }

  const box = report.metrics.boxScore;
  if (box) {
    const shots = (m: number, a: number, p: number) => (a > 0 ? `${m}/${a} (${p.toFixed(1)}%)` : EMPTY);
    const boxOpponent = box.opponent;
    const oppCell = (render: (line: PostgameBoxScoreLine) => string) => (boxOpponent ? render(boxOpponent) : EMPTY);
    const optShots = (m?: number, a?: number, p?: number) => (m !== undefined && a !== undefined && p !== undefined ? shots(m, a, p) : EMPTY);
    lines.push(
      ``,
      `## Box score alapmutatók`,
      ``,
      `| Mutató | ${report.teamName} | ${report.opponentName} |`,
      `|--------|-------|-------|`,
      `| FG (dobott/kísérlet) | ${shots(box.own.fgm, box.own.fga, box.own.fgPct)} | ${oppCell(o => shots(o.fgm, o.fga, o.fgPct))} |`,
      `| 2P (dobott/kísérlet) | ${optShots(box.own.fgm2, box.own.fga2, box.own.twoPct)} | ${oppCell(o => optShots(o.fgm2, o.fga2, o.twoPct))} |`,
      `| 3P (dobott/kísérlet) | ${optShots(box.own.fgm3, box.own.fga3, box.own.threePct)} | ${oppCell(o => optShots(o.fgm3, o.fga3, o.threePct))} |`,
      `| FT (dobott/kísérlet) | ${shots(box.own.ftm, box.own.fta, box.own.ftPct)} | ${oppCell(o => shots(o.ftm, o.fta, o.ftPct))} |`,
      `| Lepattanó (össz.) | ${box.own.reb} | ${oppCell(o => `${o.reb}`)} |`,
      `| Támadólepattanó | ${box.own.oreb} | ${oppCell(o => `${o.oreb}`)} |`,
      `| Védőlepattanó | ${box.own.dreb} | ${oppCell(o => `${o.dreb}`)} |`,
      `| Gólpassz (AST) | ${box.own.ast ?? EMPTY} | ${oppCell(o => `${o.ast ?? EMPTY}`)} |`,
      `| Labdavesztés (LV) | ${box.own.tov ?? EMPTY} | ${oppCell(o => `${o.tov ?? EMPTY}`)} |`,
      `| Labdaszerzés (St) | ${box.own.stl ?? EMPTY} | ${oppCell(o => `${o.stl ?? EMPTY}`)} |`,
      `| Blokk (Bl) | ${box.own.blk ?? EMPTY} | ${oppCell(o => `${o.blk ?? EMPTY}`)} |`,
    );
  }

  const profile = report.charts.shotProfile;
  if (profile.length > 0) {
    lines.push(
      ``,
      `## Dobásprofil`,
      ``,
      `| Mutató | Meccs | ${baselineLabel} | Delta |`,
      `|--------|-------|-------------|-------|`,
      ...profile.map(
        item =>
          `| ${item.label} | ${item.game.toFixed(1)}% | ${comparable ? `${item.season.toFixed(1)}%` : EMPTY} | ${comparable ? signed1(item.game - item.season, ' pp') : EMPTY} |`,
      ),
      ``,
      `*2P / 3P arány = a mezőnykísérletek megoszlása a box score-ból (a 2P a középtávot is tartalmazza, nem azonos a festékkel); FTM arány = értékesített büntető / FGA. Dobástérkép nincs az exportban.*`,
    );
  }

  if (report.decisiveFactors.offense.length > 0 || report.decisiveFactors.defense.length > 0) {
    const toneMark = (tone: 'positive' | 'negative' | undefined) => (tone ? `${tone === 'positive' ? '(+)' : '(−)'} ` : '');
    lines.push(``, `## Döntő tényezők`);
    for (const type of ['Hatékonyság', 'Kontroll', 'Volumen'] as const) {
      const items = report.decisiveFactorMeta.filter(item => item.type === type);
      if (items.length === 0) continue;
      lines.push(``, `### ${type}`, ``);
      for (const item of items) {
        lines.push(`- ${toneMark(item.tone)}${item.axis === 'offense' ? 'Támadás' : 'Védekezés'}: ${item.label}`);
      }
    }
    lines.push(
      ``,
      `*(+) a saját csapatnak kedvező, (−) kedvezőtlen tényező. Hatékonyság = dobásminőség és -pontosság, Kontroll = labdabiztonság, Volumen = extra birtoklások és büntetők. Jelöletlen értékpárnál a „vs” előtti érték a saját csapaté.*`,
    );
  }

  if (report.playerReport.players.length > 0) {
    lines.push(
      ``,
      `## Játékos bontás`,
      ``,
      ...table(
        ['Játékos', 'Poz', 'Perc', 'Pont', 'Lep', 'Gp', 'St+Bl', 'LV', 'TS%', 'VAL', 'VAL/36', 'Usage%', 'Impact', 'Hatás'],
        report.playerReport.players.map(p => [
          p.name,
          p.position,
          p.minutes.toFixed(0),
          p.points,
          p.rebounds,
          p.assists,
          p.stocks,
          p.turnovers,
          p.hasShotAttempts ? `${p.tsPct.toFixed(1)}%` : EMPTY,
          p.val.toFixed(0),
          p.valPer36.toFixed(1),
          `${(p.usageShare * 100).toFixed(1)}%`,
          p.impactScore.toFixed(1),
          p.impactLabel,
        ]),
      ),
      ``,
      `*Sorrend és címke az Impact score alapján (VAL/36 45%, TS% 25%, usage 20%, St+Bl 10%), nem a nyers VAL szerint. A meccs legjobbjától legfeljebb 10%-kal elmaradó játékosok ugyanazt a vezető címkét kapják. A „Stabil alappillér” címkéhez legalább ${ENGINE_MIN_SCORE}-es Impact score és ${ENGINE_MINUTES} perc játékidő kell (kezdőnél ${ENGINE_STARTER_MINUTES} perc); „Rotációs hozzájárulás” legalább ${SUPPORT_MIN_SCORE} ponttól; „Hatékonysági deficit” = kezdő, aki legalább ${Math.round(USG_HIGH_MIN * 100)}%-os usage mellett alappillér-szintű játékidőt kapott, de a TS% legfeljebb ${INEFFICIENT_MAX_TS_PCT}% (az osztály és a sorrend nem változik); „(padról)” = cserejátékos, „(rövid percben)” = alappillér-szintű pontszám ennél kevesebb játékidővel. A „Hatékony szerepjátékos” szerepet jelöl, nem rangot: alacsony usage (≤ ${Math.round(USG_LOW_MAX * 100)}%) mellett legalább ${ROLE_PLAYER_MIN_VAL_PER36}-as VAL/36 és ${ROLE_PLAYER_MIN_TS_PCT}%-os TS% (legalább ${ROLE_PLAYER_MIN_MINUTES} perc). Usage% = standard USG% = (FGA + 0,44·FTA + LV) · (csapatperc / 5) / (perc · csapat FGA + 0,44·FTA + LV); átlag ~20%, alacsony ≤ ${Math.round(USG_LOW_MAX * 100)}%, magas ≥ ${Math.round(USG_HIGH_MIN * 100)}%. Az Impact küszöbök NBA-adaton kalibráltak.*`,
    );
  }

  if (report.strengths.length > 0) {
    lines.push(``, `## Erősségek`, ``, ...report.strengths.map(item => `- ${item}`));
  }
  if (report.problems.length > 0) {
    lines.push(``, `## Problémák`, ``, ...report.problems.map(item => `- ${item}`));
  }

  // Ugyanaz a lista, mint a webes nézetben (ellenfél-specifikus fókusz is).
  const focus = buildPostgameAutoFocus(report);
  if (focus.length > 0) {
    lines.push(``, `## Következő fókusz`, ``, ...focus.map(item => `- ${item}`));
  }

  const { playerImpact } = report;
  if (
    playerImpact.overperformers.length > 0 ||
    playerImpact.underperformers.length > 0 ||
    playerImpact.positive.length > 0 ||
    playerImpact.negative.length > 0
  ) {
    lines.push(``, `## Játékos kiemelések`, ``);
    if (playerImpact.overperformers.length > 0) lines.push(`**Kiugró teljesítmény:** ${playerImpact.overperformers.join(', ')}`);
    if (playerImpact.positive.length > 0) lines.push(`**Pozitív hatás (alacsony usage):** ${playerImpact.positive.join(', ')}`);
    if (playerImpact.underperformers.length > 0) lines.push(`**Gyenge meccs:** ${playerImpact.underperformers.join(', ')}`);
    if (playerImpact.negative.length > 0) lines.push(`**Limitált hatás (magas usage):** ${playerImpact.negative.join(', ')}`);
  }

  const baselineNote = describePostgameBaselineNote(report.baseline, meta.hasLeagueBenchmark);
  const dataNotes = [...report.dataNotes, ...(baselineNote ? [baselineNote] : [])];
  if (dataNotes.length > 0) {
    lines.push(``, `## Adatminőség és megjegyzések`, ``, ...dataNotes.map(note => `- ${note}`));
  }

  const summary = composePostgameSummary(report, focus);
  if (summary) lines.push(``, `## Összefoglalás`, ``, summary);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Meccs box score
// ---------------------------------------------------------------------------

export interface GameBoxScoreMdInput {
  seasonName: string;
  stageLabel: string;
  gameDate: string;
  isHome: boolean;
  venue: string | null;
  teamName: string;
  opponentName: string;
  teamScore: number | null;
  opponentScore: number | null;
  /** A kiválasztott csapat és az ellenfél box score-ja. */
  own: BoxScoreTeam | undefined;
  opponent: BoxScoreTeam | undefined;
}

function teamRates(totals: BoxScoreTeamTotals, other: BoxScoreTeamTotals | null) {
  return {
    efg: effectiveFgPct(totals.fgMade, totals.threeMade, totals.fgAttempted),
    ts: trueShootingPct(totals.points, totals.fgAttempted, totals.ftAttempted),
    toRate: turnoverPct(totals.turnovers, totals.fgAttempted, totals.ftAttempted),
    ftRate: freeThrowRate(totals.ftMade, totals.fgAttempted) * 100,
    orebRate: other ? offensiveReboundPct(totals.offensiveRebounds, other.rebounds - other.offensiveRebounds) : null,
    assistRate: totals.fgMade > 0 ? (totals.assists / totals.fgMade) * 100 : 0,
  };
}

function playerRows(players: BoxScorePlayer[]): Array<Array<string | number>> {
  return players.map(p => [
    p.name,
    p.position ?? EMPTY,
    p.starter ? 'K' : '',
    p.minutes.toFixed(0),
    p.points,
    made(p.fgMade, p.fgAttempted),
    made(p.threeMade, p.threeAttempted),
    made(p.ftMade, p.ftAttempted),
    p.offensiveRebounds,
    p.rebounds,
    p.assists,
    p.steals,
    p.blocks,
    p.turnovers,
    p.fouls,
    p.plusMinus === null ? EMPTY : signedInt(p.plusMinus),
    p.valuation.toFixed(0),
  ]);
}

export function gameBoxScoreToMd(input: GameBoxScoreMdInput): string {
  const { own, opponent } = input;
  const ownTotals = own?.totals ?? null;
  const oppTotals = opponent?.totals ?? null;
  const lines: string[] = [
    `# Meccs elemzés: ${input.teamName} vs ${input.opponentName}`,
    ``,
    `**Dátum:** ${formatGameDate(input.gameDate)} | **Szezon:** ${input.seasonName} | **Szakasz:** ${input.stageLabel} | **Helyszín:** ${input.isHome ? 'Hazai' : 'Vendég'}${input.venue ? ` (${input.venue})` : ''}`,
    `**Eredmény:** ${input.teamScore ?? EMPTY}–${input.opponentScore ?? EMPTY}`,
  ];

  if (ownTotals && oppTotals) {
    const o = teamRates(ownTotals, oppTotals);
    const d = teamRates(oppTotals, ownTotals);
    const row = (label: string, a: number | string, b: number | string): Array<string | number> => [label, a, b];
    lines.push(
      ``,
      `## Csapatstatisztika`,
      ``,
      ...table(
        ['Mutató', input.teamName, input.opponentName],
        [
          row('Pont', ownTotals.points, oppTotals.points),
          row('FG', `${made(ownTotals.fgMade, ownTotals.fgAttempted)} (${shootPct(ownTotals.fgMade, ownTotals.fgAttempted)})`, `${made(oppTotals.fgMade, oppTotals.fgAttempted)} (${shootPct(oppTotals.fgMade, oppTotals.fgAttempted)})`),
          row('3P', `${made(ownTotals.threeMade, ownTotals.threeAttempted)} (${shootPct(ownTotals.threeMade, ownTotals.threeAttempted)})`, `${made(oppTotals.threeMade, oppTotals.threeAttempted)} (${shootPct(oppTotals.threeMade, oppTotals.threeAttempted)})`),
          row('FT', `${made(ownTotals.ftMade, ownTotals.ftAttempted)} (${shootPct(ownTotals.ftMade, ownTotals.ftAttempted)})`, `${made(oppTotals.ftMade, oppTotals.ftAttempted)} (${shootPct(oppTotals.ftMade, oppTotals.ftAttempted)})`),
          row('Lepattanó (T/V/Ö)', `${ownTotals.offensiveRebounds}/${ownTotals.rebounds - ownTotals.offensiveRebounds}/${ownTotals.rebounds}`, `${oppTotals.offensiveRebounds}/${oppTotals.rebounds - oppTotals.offensiveRebounds}/${oppTotals.rebounds}`),
          row('Gólpassz', ownTotals.assists, oppTotals.assists),
          row('Labdaszerzés', ownTotals.steals, oppTotals.steals),
          row('Blokk', ownTotals.blocks, oppTotals.blocks),
          row('Labdavesztés', ownTotals.turnovers, oppTotals.turnovers),
          row('Szabálytalanság', ownTotals.fouls, oppTotals.fouls),
          row('Festékpont', ownTotals.pointsInPaint ?? EMPTY, oppTotals.pointsInPaint ?? EMPTY),
          row('Gyorsindítás-pont', ownTotals.fastBreakPoints ?? EMPTY, oppTotals.fastBreakPoints ?? EMPTY),
          row('Pont eladott labdából', ownTotals.pointsOffTurnovers ?? EMPTY, oppTotals.pointsOffTurnovers ?? EMPTY),
          row('Legnagyobb előny', ownTotals.largestLead ?? EMPTY, oppTotals.largestLead ?? EMPTY),
        ],
      ),
      ``,
      `## Fejlett csapatmutatók`,
      ``,
      ...table(
        ['Mutató', input.teamName, input.opponentName],
        [
          row('eFG%', pct1(o.efg), pct1(d.efg)),
          row('TS%', pct1(o.ts), pct1(d.ts)),
          row('TO rate (Oliver)', pct1(o.toRate), pct1(d.toRate)),
          row('OREB%', pct1(o.orebRate), pct1(d.orebRate)),
          row('FTM rate (FTM/FGA)', pct1(o.ftRate), pct1(d.ftRate)),
          row('Assist arány (AST/FGM)', pct1(o.assistRate), pct1(d.assistRate)),
        ],
      ),
      ``,
      `*A csapatsor a hiteles csapatösszeg (a labdavesztés a csapatszintű eladott labdákat is tartalmazza). TO rate (Oliver) = LV / (FGA + 0,44·FTA + LV); OREB% = T-lep / (T-lep + a másik csapat V-lepattanója); FTM rate = értékesített büntető / FGA.*`,
    );
  }

  for (const [name, side] of [[input.teamName, own], [input.opponentName, opponent]] as const) {
    if (!side || side.players.length === 0) continue;
    lines.push(
      ``,
      `## Játékos statisztikák – ${name}`,
      ``,
      ...table(
        ['Játékos', 'Poz', 'K', 'Perc', 'Pont', 'FG', '3P', 'FT', 'T-Lep', 'Lep', 'Gp', 'St', 'Bl', 'LV', 'Fault', '+/-', 'VAL'],
        playerRows(side.players),
      ),
    );
    if (side.sumMismatches.length > 0) {
      lines.push(
        ``,
        `> **Adatminőség:** a játékossorok összege eltér a csapatsortól (a forrásadat hiányos): ${side.sumMismatches
          .map(({ stat, playerSum, teamTotal }) => `${stat} ${playerSum}/${teamTotal}`)
          .join(', ')}. A csapatstatisztika a helyes érték.`,
      );
    }
    if (side.didNotPlay.length > 0) {
      lines.push(
        ``,
        `**Nem lépett pályára:** ${side.didNotPlay.map(a => (a.reason ? `${a.name} (${a.reason.toLowerCase()})` : a.name)).join(', ')}`,
      );
    }
  }
  lines.push(
    ``,
    `*K = kezdő; FG / 3P / FT = bedobott/kísérlet; VAL = az egyszerűsített valuation (PTS + REB + AST + STL + BLK − kihagyott mezőny − kihagyott büntető − LV); a kezdők elöl, utánuk a cserék a játszott percek szerint.*`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Csapatstatisztika
// ---------------------------------------------------------------------------

export interface TeamStatsMdInput {
  seasonName: string;
  stageLabel: string;
  teamName: string;
  games: number;
  rows: TeamMetricRow[];
  /** A Csapat-elemzés kimenete, ha a szakaszra készült. */
  analysis: TeamAnalysis | null;
  /** A szakasz rangsorában szereplő csapatok száma. */
  leagueTeams: number;
}

const formatMetric = (row: TeamMetricRow, value: number | null): string => {
  if (value === null) return EMPTY;
  switch (row.metric.kind) {
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'rate':
      return value.toFixed(3);
    case 'signed':
      return signed1(value);
    case 'count':
      return value.toFixed(1);
  }
};

function metricTable(rows: TeamMetricRow[]): string[] {
  return table(
    ['Mutató', 'Csapat', 'Liga átlag', 'Helyezés'],
    rows.map(row => [
      row.metric.label,
      formatMetric(row, row.value),
      formatMetric(row, row.leagueAverage),
      row.rank === null ? EMPTY : `${row.rank}. / ${row.of}`,
    ]),
  );
}

export function teamStatsToMd(input: TeamStatsMdInput): string {
  const basic = input.rows.filter(row => row.metric.group === 'basic');
  const advanced = input.rows.filter(row => row.metric.group === 'advanced');
  const lines: string[] = [
    `# Csapat szezonstatisztikák: ${input.teamName}`,
    ``,
    `**Szezon:** ${input.seasonName} | **Szakasz:** ${input.stageLabel}`,
    `**Meccsek:** ${input.games} | **Rangsor:** ${input.leagueTeams} csapat a szakaszban`,
    ``,
    `## Alapmutatók (meccsenkénti átlag)`,
    ``,
    ...metricTable(basic),
    ``,
    `*A százalékok az összesített dobásokból számolódnak. A helyezés a szakaszban játszott csapatok között készül (1. = a legjobb; a kapott pontnál, az eladott labdánál, a személyi hibánál és a DRtg-nél a kevesebb a jobb). A liga átlag a csapatok mutatóinak súlyozatlan átlaga.*`,
    ``,
    `## Fejlett mutatók`,
    ``,
    ...metricTable(advanced),
    ``,
    `*100 közös birtoklásra vetítve. Birtoklás = a két csapat (FGA + 0,44·FTA + LV − T-lep) becslésének átlaga; a tempó 48 percre vetített. TO rate (Oliver) = LV / (FGA + 0,44·FTA + LV). FT-mutató = FTM / FGA. A tempónál nincs jobb vagy rosszabb irány.*`,
  ];

  const analysis = input.analysis;
  if (analysis) {
    const { leagueProfile, rosterSummary, defensiveProfile } = analysis;
    const styles = [...finalizeOffenseStyle(analysis.style.offense), ...finalizeDefenseStyle(analysis.style.defense)];
    lines.push(
      ``,
      `## Csapat-elemzés`,
      ``,
      `**Stílus:** ${styles.length > 0 ? styles.join(', ') : EMPTY} | **Klaszter:** ${leagueProfile.clusterLabel}${leagueProfile.clusterPeers.length > 0 ? ` (hasonló csapatok: ${leagueProfile.clusterPeers.join(', ')})` : ''}`,
      ``,
      analysis.summary,
      ``,
      `### Liga-profil (percentilis a szakasz csapatai között)`,
      ``,
      ...table(
        ['Mutató', 'Érték', 'Percentilis', 'Sáv'],
        leagueProfile.entries.map(entry => [entry.label, entry.value.toFixed(3), entry.percentile, entry.tier]),
      ),
    );
    const list = (title: string, items: string[]) => {
      if (items.length > 0) lines.push(``, `### ${title}`, ``, ...items.map(item => `- ${item}`));
    };
    list('Erősségek', analysis.strengths);
    list('Limitációk', analysis.limitations);
    list('Kockázatok', analysis.riskPriorities.map(risk => risk.replace(/^\d+\.\s*/, '')));
    lines.push(
      ``,
      `### Védekezési profil`,
      ``,
      `- ${defensiveProfile.rimProtection}`,
      `- ${defensiveProfile.perimeterDefense}`,
      `- ${defensiveProfile.rebounding}`,
      `- ${defensiveProfile.foulDiscipline}`,
      ...defensiveProfile.notes.map(note => `- ${note}`),
      ``,
      `### Roster`,
      ``,
      `**Percmegoszlás poszt szerint:** ${(['PG', 'SG', 'SF', 'PF', 'C'] as const)
        .map(position => `${position} ${rosterSummary.positionMinutesShare[position].toFixed(1)}%`)
        .join(' · ')}`,
    );
    const roles = Object.entries(rosterSummary.roleCounts).filter(([, count]) => count > 0);
    if (roles.length > 0) {
      lines.push(
        `**Szerepkörök:** ${roles
          .map(([role, count]) => {
            const names = rosterSummary.rolePlayers[role]?.filter(Boolean) ?? [];
            return `${role} · ${count}${names.length > 0 ? ` (${names.join(', ')})` : ''}`;
          })
          .join('; ')}`,
      );
    }
    list('Megfigyelések', analysis.rosterInsights);
    lines.push(
      ``,
      `*A benchmark a szakasz legalább 10 meccset játszott csapataiból épül; a roster-jelzések percentilis-alapúak (NBA-kalibráció). A szerepkör és a használat csak az alkalmas mintájú (8 meccs / 18 perc) játékosnál van; a használat a labdabirtoklás közelítése, nem USG%.*`,
    );
  } else {
    lines.push(``, `## Ebben az exportban nem elérhető adat`, ``, `- Csapat-elemzés: kis minta (< 10 meccs) vagy kis liga-pool a szakaszban.`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Játékos szezonértékelés
// ---------------------------------------------------------------------------

export interface PlayerSeasonMdInput {
  seasonName: string;
  stageLabel: string;
  teamName: string;
  player: PlayerSeasonStats;
  /** A játékos pályára lépései a szakaszban, időrendben (az utolsó 10 kerül az exportba). */
  played: PlayerGameLogEntry[];
  /** Az ellenfél neve a naplósorhoz. */
  opponentName: (teamId: string) => string;
  /** A Játékos-elemzés kimenete a szakaszra; `null`, ha nem érhető el (betöltés alatt). */
  analysis: PlayerAnalysisOutcome | null;
}

const SKILL_ORDER: Array<keyof SkillScores> = ['scoring', 'shooting', 'playmaking', 'rebounding', 'defense', 'efficiency'];
const MAX_LOG_ROWS = 10;

export function playerSeasonToMd(input: PlayerSeasonMdInput): string {
  const { player } = input;
  const per36 = (perGame: number) => (player.minutesPerGame > 0 ? ((perGame / player.minutesPerGame) * 36).toFixed(1) : EMPTY);
  const lines: string[] = [
    `# Játékos szezonértékelés: ${player.name}`,
    ``,
    `**Pozíció:** ${player.position ?? EMPTY}${player.jersey ? ` | **Szám:** #${player.jersey}` : ''}`,
    `**Szezon:** ${input.seasonName} | **Szakasz:** ${input.stageLabel} | **Csapat:** ${input.teamName}`,
    `**Lejátszott meccsek:** ${player.gamesPlayed} (kezdő: ${player.gamesStarted})`,
    ``,
    `## Meccsenkénti átlagok`,
    ``,
    ...table(
      ['Statisztika', 'Átlag/meccs', '/36 perc'],
      [
        ['Perc', player.minutesPerGame.toFixed(1), EMPTY],
        ['Pont', player.pointsPerGame.toFixed(1), per36(player.pointsPerGame)],
        ['Lepattanó', player.reboundsPerGame.toFixed(1), per36(player.reboundsPerGame)],
        ['Gólpassz', player.assistsPerGame.toFixed(1), per36(player.assistsPerGame)],
        ['Labdaszerzés', player.stealsPerGame.toFixed(1), per36(player.stealsPerGame)],
        ['Blokk', player.blocksPerGame.toFixed(1), per36(player.blocksPerGame)],
        ['Labdavesztés', player.turnoversPerGame.toFixed(1), per36(player.turnoversPerGame)],
        ['Valuation', player.valuationPerGame.toFixed(1), per36(player.valuationPerGame)],
        ['+/-', player.plusMinusPerGame === null ? EMPTY : signed1(player.plusMinusPerGame), EMPTY],
      ],
    ),
    ``,
    `## Dobószázalékok és fejlett mutatók`,
    ``,
    ...table(
      ['Mutató', 'Érték'],
      [
        ['FG%', pct1(player.fgPct)],
        ['3P%', pct1(player.threePct)],
        ['FT%', pct1(player.ftPct)],
        ['True Shooting %', pct1(player.trueShootingPct)],
        ['Effective FG %', pct1(player.effectiveFgPct)],
      ],
    ),
    ``,
    `*A százalékok az összesített dobásokból számolódnak (T12). A valuation az egyszerűsített képlet (PTS + REB + AST + STL + BLK − kihagyott mezőny − kihagyott büntető − LV). A /36 oszlop a meccsenkénti átlagot 36 percre vetíti.*`,
  ];

  const analysis = input.analysis;
  if (analysis?.status === 'ready') {
    const { analysis: a, blocks } = analysis;
    lines.push(
      ``,
      `## Játékos-elemzés`,
      ``,
      `**Poszt (illesztett):** ${a.position} | **Szerepkörök:** ${a.roles.length > 0 ? a.roles.join(', ') : EMPTY} | **Megbízhatóság:** ${a.confidence}`,
      ``,
      a.summary,
      ``,
      `### Skill-pontok (poszt szerinti percentilis, 0–100)`,
      ``,
      ...table(['Skill', 'Pont'], SKILL_ORDER.map(skill => [SKILL_LABELS[skill], a.skillScores[skill]])),
    );
    const list = (title: string, items: string[]) => {
      if (items.length > 0) lines.push(``, `### ${title}`, ``, ...items.map(item => `- ${item}`));
    };
    list('Erősségek', a.strengths);
    list('Limitációk', a.limitations);
    list('Fejlesztendő', a.improvements);
    lines.push(
      ``,
      `### Haladó blokkok (36 percre vetítve)`,
      ``,
      ...table(
        ['Blokk', 'Mutatók', 'Megállapítás'],
        [
          [
            'Dobás',
            `TS% ${blocks.shooting.tsPct.toFixed(1)}, eFG% ${blocks.shooting.efg.toFixed(1)}, gyűrű-arány ${(blocks.shooting.rimRate * 100).toFixed(0)}%, közép-arány ${(blocks.shooting.midRate * 100).toFixed(0)}%, 3P-arány ${(blocks.shooting.threeRate * 100).toFixed(0)}%, 3P% ${blocks.shooting.threePct.toFixed(1)}, FT% ${blocks.shooting.ftPct.toFixed(1)}`,
            blocks.shooting.narrative,
          ],
          ['Játéképítés', `AST/36 ${blocks.playmaking.astPer36.toFixed(1)}, AST/TO ${blocks.playmaking.astTo.toFixed(2)}, használat ${blocks.playmaking.usageProxy.toFixed(1)}`, blocks.playmaking.narrative],
          ['Védekezés', `STL/36 ${blocks.defense.stlPer36.toFixed(1)}, BLK/36 ${blocks.defense.blkPer36.toFixed(1)}, DREB/36 ${blocks.defense.defRebPer36.toFixed(1)}, PF/36 ${blocks.defense.foulsPer36.toFixed(1)}`, blocks.defense.narrative],
          ['Pontszerzés', `PTS/36 ${blocks.scoring.ptsPer36.toFixed(1)}, TS% ${blocks.scoring.tsPct.toFixed(1)}, használat ${blocks.scoring.usageProxy.toFixed(1)}`, blocks.scoring.narrative],
          ['Hatékonyság', `VAL/36 ${blocks.efficiency.valPer36.toFixed(1)}, TS% ${blocks.efficiency.tsPct.toFixed(1)}, eFG% ${blocks.efficiency.efg.toFixed(1)}`, blocks.efficiency.narrative],
        ],
      ),
      ``,
      `*A percentilis a liga azonos posztú, alkalmas mintájú (8 meccs / 18 perc) játékosaihoz mér; a használat a labdabirtoklás közelítése (FGA + 0,44·FTA + LV per 36), nem USG%.*`,
    );
  } else if (analysis) {
    const reason =
      analysis.status === 'small-sample'
        ? `kis minta (${analysis.games} meccs, ${analysis.minutesPerGame.toFixed(1)} perc/meccs)`
        : analysis.status === 'no-benchmark'
          ? `a ${analysis.position} poszton kevés az alkalmas játékos a szakaszban`
          : 'nincs dobásbontás ehhez a játékoshoz';
    lines.push(``, `## Ebben az exportban nem elérhető adat`, ``, `- Játékos-elemzés: ${reason}.`);
  }

  const recent = input.played.slice(-MAX_LOG_ROWS).reverse();
  if (recent.length > 0) {
    lines.push(
      ``,
      `## Utolsó meccsek (max. ${MAX_LOG_ROWS}, a legfrissebb elöl)`,
      ``,
      ...table(
        ['Dátum', 'Ellenfél', 'H/V', 'Eredmény', 'Perc', 'Pont', 'FG', '3P', 'FT', 'Lep', 'Gp', 'St', 'Bl', 'LV', 'PF', '+/-', 'VAL'],
        recent.map(entry => [
          formatGameDate(entry.game.gameDate),
          input.opponentName(entry.game.opponentTeamId),
          entry.game.isHome ? 'H' : 'V',
          entry.game.result === null ? EMPTY : `${entry.game.result === 'win' ? 'Gy' : 'V'} ${entry.game.teamScore}–${entry.game.opponentScore}`,
          entry.minutes.toFixed(0),
          entry.points,
          made(entry.fgMade, entry.fgAttempted),
          made(entry.threeMade, entry.threeAttempted),
          made(entry.ftMade, entry.ftAttempted),
          entry.rebounds,
          entry.assists,
          entry.steals,
          entry.blocks,
          entry.turnovers,
          entry.fouls,
          entry.plusMinus === null ? EMPTY : signedInt(entry.plusMinus),
          entry.valuation.toFixed(0),
        ]),
      ),
    );
  }
  return lines.join('\n');
}
