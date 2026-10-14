'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { AdvancedPlayerStat, PositionComparison, ScenarioOutcome, ScoutingReport } from '@/lib/pregame-scouting';
import { formatSigned } from '@/components/TeamStatsTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { POSITION_LABELS } from '@/lib/pregame-scouting';
import { cn } from '@/lib/utils';

const EMPTY = '–';

interface TeamStatRow {
  key: string;
  label: string;
  own: number;
  opponent: number;
  /** Tizedesjegyek száma és a mértékegység a megjelenítéshez. */
  digits: number;
  suffix: string;
}

function toTeamStatRows(stats: NonNullable<ScoutingReport['teamStats']>): TeamStatRow[] {
  const row = (key: string, label: string, own: number, opponent: number, suffix = '%', digits = 1): TeamStatRow => ({
    key,
    label,
    own,
    opponent,
    digits,
    suffix,
  });
  return [
    row('pace', 'Tempó (birtoklás / 48 perc)', stats.own.pace, stats.opponent.pace, ''),
    row('efg', 'eFG%', stats.own.efg, stats.opponent.efg),
    row('threeRate', '3P-arány (3PA / FGA)', stats.own.threeRate, stats.opponent.threeRate),
    row('threePct', '3P%', stats.own.threePct, stats.opponent.threePct),
    row('turnoverRate', 'TO%', stats.own.turnoverRate, stats.opponent.turnoverRate),
    row('ftRate', 'FT-mutató (FTM / FGA)', stats.own.ftRate, stats.opponent.ftRate),
    row('orebRate', 'OREB%', stats.own.orebRate, stats.opponent.orebRate),
    row('assistRate', 'AST-arány (AST / FGM)', stats.own.assistRate, stats.opponent.assistRate),
  ];
}

const formatStat = (row: TeamStatRow, value: number): string => `${value.toFixed(row.digits)}${row.suffix}`;

function teamStatColumns(ownName: string, opponentName: string): ColumnDef<TeamStatRow>[] {
  return [
    { key: 'label', label: 'Mutató', sortAccessor: row => row.label, render: row => row.label },
    { key: 'own', label: ownName, numeric: true, sortAccessor: row => row.own, render: row => formatStat(row, row.own) },
    {
      key: 'opponent',
      label: opponentName,
      numeric: true,
      sortAccessor: row => row.opponent,
      render: row => formatStat(row, row.opponent),
    },
  ];
}

/** A két csapat szezonmutatói egymás mellett (a szakasz összesített box score-jából). */
export function ScoutingTeamStatsTable({ report }: { report: ScoutingReport }) {
  if (!report.teamStats) return null;
  return (
    <DataTable
      columns={teamStatColumns(report.ownTeamName, report.opponentTeamName)}
      rows={toTeamStatRows(report.teamStats)}
      getRowId={row => row.key}
    />
  );
}

const MATCHUP_BADGES: Record<NonNullable<PositionComparison['matchupFlag']>, { label: string; className: string }> = {
  critical_disadvantage: { label: 'Kritikus hátrány', className: 'badge-negative' },
  clear_advantage: { label: 'Egyértelmű előny', className: 'badge-positive' },
};

const POSITION_COLUMNS: ColumnDef<PositionComparison>[] = [
  {
    key: 'position',
    label: 'Poszt',
    render: row => `${row.position} · ${POSITION_LABELS[row.position]}`,
  },
  { key: 'own', label: 'Saját VAL/36', numeric: true, sortAccessor: row => row.ownValPer36, render: row => row.ownValPer36.toFixed(1) },
  {
    key: 'opponent',
    label: 'Ellenfél VAL/36',
    numeric: true,
    sortAccessor: row => row.oppValPer36,
    render: row => row.oppValPer36.toFixed(1),
  },
  {
    key: 'delta',
    label: 'Különbség',
    numeric: true,
    sortAccessor: row => row.deltaValPer36,
    render: row => (
      <span className={cn(row.deltaValPer36 > 0 && 'text-positive', row.deltaValPer36 < 0 && 'text-negative')}>
        {formatSigned(row.deltaValPer36)}
      </span>
    ),
  },
  {
    key: 'flag',
    label: 'Jelzés',
    center: true,
    render: row => {
      const badge = row.matchupFlag ? MATCHUP_BADGES[row.matchupFlag] : null;
      return badge ? <Badge className={badge.className}>{badge.label}</Badge> : EMPTY;
    },
  },
];

/** Poszt szerinti párharc: a rotációs játékosok 36 percre vetített valuation-je. */
export function ScoutingPositionTable({ rows }: { rows: PositionComparison[] }) {
  return <DataTable columns={POSITION_COLUMNS} rows={rows} getRowId={row => row.position} />;
}

const KEY_PLAYER_GROUPS: Array<{ key: keyof ScoutingReport['keyPlayers']; title: string }> = [
  { key: 'primaryScorers', title: 'Fő pontszerzők' },
  { key: 'primaryPlaymakers', title: 'Fő játékszervezők' },
  { key: 'stretchThreats', title: 'Tripla-veszély' },
  { key: 'mismatchCandidates', title: 'Párharc-kulcsok' },
];

function KeyPlayerCard({ title, players }: { title: string; players: ScoutingReport['keyPlayers'] }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex flex-col gap-4">
        <h3 className="text-lg">{title}</h3>
        {KEY_PLAYER_GROUPS.map(group => (
          <div key={group.key}>
            <h4 className="uppercase-label mb-2 text-sm text-secondary">{group.title}</h4>
            {players[group.key].length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {players[group.key].map(name => (
                  <Badge key={name} className="badge-neutral">{name}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{EMPTY}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Kulcsjátékosok mindkét csapatnál (a rotáció z-pontjaiból). */
export function ScoutingKeyPlayers({ report }: { report: ScoutingReport }) {
  return (
    <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
      <KeyPlayerCard title={`${report.opponentTeamName} (ellenfél)`} players={report.keyPlayers} />
      <KeyPlayerCard title={`${report.ownTeamName} (saját)`} players={report.ownKeyPlayers} />
    </div>
  );
}

const SCENARIO_COLUMNS: ColumnDef<ScenarioOutcome>[] = [
  { key: 'label', label: 'Forgatókönyv', sortAccessor: row => row.label, render: row => row.label },
  { key: 'ownPct', label: 'Saját esély', numeric: true, sortAccessor: row => row.ownPct, render: row => `${row.ownPct.toFixed(1)}%` },
  {
    key: 'delta',
    label: 'Az alaphoz képest',
    numeric: true,
    sortAccessor: row => row.deltaVsBase,
    render: row => (row.deltaVsBase === 0 ? EMPTY : formatSigned(row.deltaVsBase)),
  },
  { key: 'note', label: 'Megjegyzés', sortAccessor: row => row.note, render: row => row.note },
];

/** A nyerési esély alakulása a forgatókönyvekben (alap, kontrollált tempó, magas variancia, …). */
export function ScoutingScenarioTable({ rows }: { rows: ScenarioOutcome[] }) {
  return <DataTable columns={SCENARIO_COLUMNS} rows={rows} getRowId={row => row.key} />;
}

/** „Ha bekövetkezik” forgatókönyvek: trigger, azonnali válasz, becsült esélyváltozás. */
export function ScoutingRiskScenarios({ scenarios }: { scenarios: NonNullable<ScoutingReport['riskScenarios']> }) {
  return (
    <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
      {scenarios.map((scenario, index) => (
        <Card key={scenario.title} className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: index }}>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg">{scenario.title}</h3>
              <span className="font-mono text-sm tabular-nums text-negative" data-stat>
                {formatSigned(scenario.estimatedOwnSwingPct)}%
              </span>
            </div>
            <p className="text-sm text-secondary">Trigger: {scenario.trigger}</p>
            <p className="text-sm">Válasz: {scenario.instantResponse}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const ADVANCED_COLUMNS: ColumnDef<AdvancedPlayerStat>[] = [
  { key: 'name', label: 'Játékos', sortAccessor: row => row.name, render: row => row.name || EMPTY },
  { key: 'position', label: 'Poszt', center: true, sortAccessor: row => row.position, render: row => row.position },
  { key: 'mpg', label: 'MIN', numeric: true, sortAccessor: row => row.minutesPerGame, render: row => row.minutesPerGame.toFixed(1) },
  { key: 'val', label: 'VAL/36', numeric: true, sortAccessor: row => row.valPer36, render: row => row.valPer36.toFixed(1) },
  { key: 'pts', label: 'PTS/36', numeric: true, sortAccessor: row => row.pointsPer36, render: row => row.pointsPer36.toFixed(1) },
  { key: 'per', label: 'PER-proxy', numeric: true, sortAccessor: row => row.proxyPer, render: row => row.proxyPer.toFixed(1) },
  { key: 'ws', label: 'WS-proxy', numeric: true, sortAccessor: row => row.proxyWinShare, render: row => row.proxyWinShare.toFixed(2) },
];

/** A csapat legjobb öt rotációs játékosa a PER- és win share-proxy szerint. */
export function ScoutingAdvancedPlayers({ title, players }: { title: string; players: AdvancedPlayerStat[] }) {
  return (
    <div>
      <h3 className="mb-3 text-lg">{title}</h3>
      <DataTable
        columns={ADVANCED_COLUMNS}
        rows={players}
        initialSort={{ key: 'per', dir: 'desc' }}
        getRowId={row => row.playerId}
      />
    </div>
  );
}
