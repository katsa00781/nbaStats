'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { PlayerImpactClass, PlayerPostGameBreakdown } from '@/lib/player-postgame';
import type { PostGameMetric, PostGameReport, PostgameSummarySection } from '@/lib/postgame-report';
import { formatSigned } from '@/components/TeamStatsTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { parsePostgameSummary } from '@/lib/postgame-report';
import { Gauge, Scale, Shield, Swords } from 'lucide-react';

const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;
const EMPTY = '–';

/** Négy kártya: a végeredmény és a három rating (pont / 100 közös birtoklás) a referenciával. */
export function PostgameHeadlineCards({ report }: { report: PostGameReport }) {
  const { ratings, pointsFor, pointsAgainst, margin } = report.metrics;
  const ref = report.baseline?.noun ?? 'referencia';
  const refText = (value: number | null) => (value === null ? 'nincs referencia' : `${ref} ${value.toFixed(1)}`);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Eredmény"
        value={`${pointsFor}–${pointsAgainst}`}
        trend={report.result === 'win' ? 'up' : 'down'}
        trendValue={`${report.result === 'win' ? 'Győzelem' : 'Vereség'} (${formatSigned(margin)})`}
        accentColor={report.result === 'win' ? 'green' : 'orange'}
        icon={<Gauge {...STAT_ICON_PROPS} />}
        animationDelay={0}
      />
      <StatCard
        label="ORtg"
        value={ratings ? ratings.ortg.toFixed(1) : EMPTY}
        trend="neutral"
        trendValue={refText(ratings?.refOrtg ?? null)}
        accentColor="cyan"
        icon={<Swords {...STAT_ICON_PROPS} />}
        animationDelay={60}
      />
      <StatCard
        label="DRtg"
        value={ratings ? ratings.drtg.toFixed(1) : EMPTY}
        trend="neutral"
        trendValue={refText(ratings?.refDrtg ?? null)}
        accentColor="cyan"
        icon={<Shield {...STAT_ICON_PROPS} />}
        animationDelay={120}
      />
      <StatCard
        label="NetRtg"
        value={ratings ? formatSigned(ratings.net) : EMPTY}
        trend="neutral"
        trendValue={ratings?.refNet != null ? `${ref} ${formatSigned(ratings.refNet)}` : 'nincs referencia'}
        accentColor="green"
        icon={<Scale {...STAT_ICON_PROPS} />}
        animationDelay={180}
      />
    </div>
  );
}

function SummarySection({ section }: { section: PostgameSummarySection }) {
  return (
    <div>
      {section.title && <h3 className="uppercase-label mb-2 text-sm text-secondary">{section.title}</h3>}
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-muted">
        {section.items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** A szabály-alapú összefoglaló szakaszai (összefoglaló, játékos-kiemelések, ellenfél profil, fókusz, reflexió). */
export function PostgameSummary({ report }: { report: PostGameReport }) {
  const sections = parsePostgameSummary(report.summary);
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {sections.map(section => (
          <SummarySection key={section.title || 'text'} section={section} />
        ))}
      </CardContent>
    </Card>
  );
}

const unit = (metric: PostGameMetric) => (metric.unit === 'pct' ? '%' : '');
const fmt = (metric: PostGameMetric, value: number) => `${value.toFixed(1)}${unit(metric)}`;

function keyStatColumns(referenceLabel: string): ColumnDef<PostGameMetric>[] {
  return [
    { key: 'label', label: 'Mutató', sortAccessor: row => row.label, render: row => row.label },
    { key: 'game', label: 'Meccs', numeric: true, sortAccessor: row => row.game, render: row => fmt(row, row.game) },
    { key: 'season', label: referenceLabel, numeric: true, sortAccessor: row => row.season, render: row => fmt(row, row.season) },
    {
      key: 'delta',
      label: 'Eltérés',
      numeric: true,
      sortAccessor: row => row.delta,
      render: row => formatSigned(row.delta),
    },
    {
      key: 'league',
      label: 'Liga medián',
      numeric: true,
      sortAccessor: row => row.leagueMedian ?? Number.NEGATIVE_INFINITY,
      render: row => (row.leagueMedian === undefined ? EMPTY : fmt(row, row.leagueMedian)),
    },
  ];
}

/** A meccs kulcsmutatói a referenciához (szezonátlag vagy kis mintánál liga medián) és a liga mediánhoz mérve. */
export function PostgameKeyStats({ report }: { report: PostGameReport }) {
  return (
    <DataTable
      columns={keyStatColumns(report.baseline?.label ?? 'Szezon átl.')}
      rows={report.metrics.keyStats}
      getRowId={row => row.key}
    />
  );
}

function PointList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="uppercase-label mb-2 text-sm text-secondary">{title}</h3>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-muted">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Döntő tényezők (támadás / védekezés, előjellel), majd az erősségek és a problémák. */
export function PostgameFactors({ report }: { report: PostGameReport }) {
  return (
    <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: 0 }}>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-lg">Döntő tényezők</h3>
          {report.decisiveFactorMeta.length === 0 ? (
            <p className="text-sm text-secondary">Nem volt kiemelkedő döntő tényező.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {report.decisiveFactorMeta.map(factor => (
                <li key={factor.label} className="flex flex-col gap-1.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={factor.tone === 'negative' ? 'badge-negative' : 'badge-positive'}>
                      {factor.axis === 'offense' ? 'Támadás' : 'Védekezés'}
                    </Badge>
                    <Badge className="badge-neutral">{factor.type}</Badge>
                  </div>
                  <span>{factor.label}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: 1 }}>
        <CardContent className="flex flex-col gap-5">
          <PointList title="Erősségek" items={report.strengths} />
          <PointList title="Problémák" items={report.problems} />
          {report.strengths.length === 0 && report.problems.length === 0 && (
            <p className="text-sm text-secondary">Nem volt kiemelt erősség vagy probléma.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const IMPACT_BADGES: Record<PlayerImpactClass, string> = {
  mvp: 'badge-orange',
  engine: 'badge-cyan',
  support: 'badge-neutral',
  struggling: 'badge-negative',
};

const PLAYER_COLUMNS: ColumnDef<PlayerPostGameBreakdown>[] = [
  { key: 'name', label: 'Játékos', sortAccessor: row => row.name, render: row => row.name },
  { key: 'position', label: 'Poszt', center: true, sortAccessor: row => row.position, render: row => row.position },
  { key: 'minutes', label: 'MIN', numeric: true, sortAccessor: row => row.minutes, render: row => row.minutes.toFixed(0) },
  { key: 'points', label: 'PTS', numeric: true, sortAccessor: row => row.points, render: row => row.points },
  { key: 'rebounds', label: 'REB', numeric: true, sortAccessor: row => row.rebounds, render: row => row.rebounds },
  { key: 'assists', label: 'AST', numeric: true, sortAccessor: row => row.assists, render: row => row.assists },
  {
    key: 'ts',
    label: 'TS%',
    numeric: true,
    sortAccessor: row => (row.hasShotAttempts ? row.tsPct : Number.NEGATIVE_INFINITY),
    render: row => (row.hasShotAttempts ? `${row.tsPct.toFixed(1)}%` : EMPTY),
  },
  {
    key: 'usage',
    label: 'USG%',
    numeric: true,
    sortAccessor: row => row.usageShare,
    render: row => `${(row.usageShare * 100).toFixed(1)}%`,
  },
  { key: 'val', label: 'VAL', numeric: true, sortAccessor: row => row.val, render: row => row.val },
  { key: 'valPer36', label: 'VAL/36', numeric: true, sortAccessor: row => row.valPer36, render: row => row.valPer36.toFixed(1) },
  { key: 'impact', label: 'Hatás', numeric: true, sortAccessor: row => row.impactScore, render: row => row.impactScore.toFixed(1) },
  {
    key: 'label',
    label: 'Értékelés',
    sortAccessor: row => row.impactLabel,
    render: row => <Badge className={IMPACT_BADGES[row.impactClass]}>{row.impactLabel}</Badge>,
  },
];

/** A csapat játékosainak meccs utáni értékelése (hatás-pontszám szerint rendezve). */
export function PostgamePlayersTable({ report }: { report: PostGameReport }) {
  return (
    <DataTable
      columns={PLAYER_COLUMNS}
      rows={report.playerReport.players}
      initialSort={{ key: 'impact', dir: 'desc' }}
      getRowId={row => row.playerId}
    />
  );
}
