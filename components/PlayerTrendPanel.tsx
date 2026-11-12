'use client';

import type { Team } from '@/lib/master-data';
import type { PlayerGameLogEntry } from '@/lib/player-game-log-data';
import type { TrendBlockKey, TrendMetric, TrendPoint, TrendWindow } from '@/lib/player-trend';
import type { ReactNode } from 'react';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, withAlpha } from '@/lib/chart-theme';
import { formatGameDate } from '@/lib/format-date';
import { buildTrendSeries, formatTrendValue, TREND_METRICS, TREND_WINDOWS } from '@/lib/player-trend';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TeamsById = ReadonlyMap<string, Team>;

/** A trend bemenete: a szakasz meccsei a kiválasztott csapat színeiben. */
export interface PlayerTrendInput {
  /** `null`, amíg a meccsnapló nem töltődött be. */
  entries: PlayerGameLogEntry[] | null;
  /** A meccsnapló betöltése hibára futott (a hibapanel a napló szekciójában van). */
  failed: boolean;
  teamsById: TeamsById;
}

interface PlayerTrendPanelProps {
  id: string;
  block: TrendBlockKey;
  title: string;
  trend: PlayerTrendInput;
  onClose: () => void;
}

const CHART_HEIGHT = 280;

// A panel a kártyarács alatt nyílik: megnyitáskor a látható részbe gördül. Modul-szintű
// (stabil) callback, ezért csak csatoláskor fut, mutató- vagy ablakváltáskor nem.
const scrollIntoViewOnMount = (node: HTMLDivElement | null) => {
  node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
const AXIS_TICK = { fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily, fill: CHART_AXIS.stroke };
const WINDOW_OPTIONS = TREND_WINDOWS.map(size => ({ value: String(size), label: `${size} meccs` }));

// 2026-01-18 → „01. 18.”: a tengelyen az év fölösleges, a szakasz egy szezonon belül van.
const shortDate = (gameDate: string): string => formatGameDate(gameDate).slice(6);

/**
 * Egy haladó blokk mutatóinak formája meccsenként: pontok a meccs értékével,
 * narancs vonal a gördülő átlaggal, szaggatott vonal a szakasz átlagával.
 */
export function PlayerTrendPanel({ id, block, title, trend, onClose }: PlayerTrendPanelProps) {
  const metrics = TREND_METRICS[block];
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const [windowSize, setWindowSize] = useState<TrendWindow>(TREND_WINDOWS[0]);
  const metric = metrics.find(candidate => candidate.key === metricKey) ?? metrics[0];

  return (
    <Card
      id={id}
      className="animate-fade-slide-up"
      ref={scrollIntoViewOnMount}
    >
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg">{title} – forma meccsenként</h3>
            <p className="mt-1 text-sm text-secondary">
              A meccs értéke (pont), az utolsó {windowSize} meccs összesítve (narancs vonal) és a szakasz átlaga
              (szaggatott). A darabszámok meccsenkéntiek, nem 36 percre vetítettek; a százalékok az összesített
              dobásokból jönnek.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Trend bezárása">
            <X className="h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              label="Mutató"
              value={metric.key}
              onChange={setMetricKey}
              options={metrics.map(option => ({ value: option.key, label: option.label }))}
            />
          </div>
          <SegmentedControl
            label="Gördülő átlag"
            value={String(windowSize)}
            onChange={value => setWindowSize(Number(value) as TrendWindow)}
            options={WINDOW_OPTIONS}
          />
        </div>

        {trend.failed ? (
          <p className="text-sm text-secondary">A meccsnapló nem töltődött be; az újrapróbálás a Mérkőzések szekcióban van.</p>
        ) : !trend.entries ? (
          <div className="skeleton-shimmer h-72" aria-busy="true" aria-label="Trend betöltése" />
        ) : trend.entries.length === 0 ? (
          <p className="text-sm text-secondary">Ebben a szakaszban nincs lejátszott mérkőzése.</p>
        ) : (
          <TrendChart entries={trend.entries} metric={metric} windowSize={windowSize} teamsById={trend.teamsById} />
        )}
      </CardContent>
    </Card>
  );
}

interface TrendChartProps {
  entries: PlayerGameLogEntry[];
  metric: TrendMetric;
  windowSize: TrendWindow;
  teamsById: TeamsById;
}

function TrendChart({ entries, metric, windowSize, teamsById }: TrendChartProps) {
  const series = useMemo(() => buildTrendSeries(entries, metric, windowSize), [entries, metric, windowSize]);
  const data = series.points.map(point => ({ ...point, label: shortDate(point.gameDate) }));

  return (
    <div className="flex flex-col gap-4">
      <TrendSummary metric={metric} windowSize={windowSize} average={series.average} delta={series.lastRollingDelta} />
      <div className="h-70 w-full" role="img" aria-label={`${metric.label} meccsenként, ${series.points.length} meccs`}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={CHART_AXIS.tickLine}
              axisLine={CHART_AXIS.axisLine}
              minTickGap={16}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={CHART_AXIS.tickLine}
              axisLine={CHART_AXIS.axisLine}
              width={44}
              // A százalék a mért tartományban mozog (a forma így látszik); a darabszám 0-tól
              // indul, a VAL negatív is lehet.
              domain={
                metric.unit === 'pct'
                  ? ['auto', 'auto']
                  : [(dataMin: number) => Math.min(0, Math.floor(dataMin)), 'auto']
              }
              tickFormatter={(value: number) => (metric.unit === 'pct' ? `${value}%` : String(value))}
            />
            <Tooltip
              cursor={{ stroke: withAlpha(CHART_COLORS.primary, 0.25) }}
              content={({ active, payload }) => (
                <TrendTooltip
                  // A sor a `data` eleme: a Recharts a teljes adatpontot adja vissza.
                  point={active ? (payload?.[0]?.payload as TrendPoint | undefined) : undefined}
                  metric={metric}
                  windowSize={windowSize}
                  teamsById={teamsById}
                />
              )}
            />
            {series.average !== null && (
              <ReferenceLine y={series.average} stroke={CHART_COLORS.secondary} strokeDasharray="4 4" />
            )}
            <Line
              type="linear"
              dataKey="value"
              stroke={withAlpha(CHART_COLORS.cyan, 0.3)}
              strokeWidth={1}
              dot={{ r: 3, fill: CHART_COLORS.cyan, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: CHART_COLORS.cyan, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="rolling"
              stroke={CHART_COLORS.orange}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.orange, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TrendLegend windowSize={windowSize} />
      {series.points.length < windowSize && (
        <p className="text-sm text-secondary">
          A gördülő átlaghoz legalább {windowSize} meccs kell; most {series.points.length} van.
        </p>
      )}
      {metric.key === 'closePct' || metric.key === 'midPct' ? (
        <p className="text-sm text-secondary">
          A közeli (≤ 8 láb) és a középtávoli dobás a dobás-eseményekből jön; dobásadat nélküli meccsen nincs érték.
        </p>
      ) : null}
    </div>
  );
}

interface TrendSummaryProps {
  metric: TrendMetric;
  windowSize: TrendWindow;
  average: number | null;
  delta: number | null;
}

// Az utolsó teljes ablak a szakasz átlagához képest. A szín a mutató irányát követi:
// a több eladott labda vagy személyi hiba rosszabb, a perc vagy a használat semleges.
function TrendSummary({ metric, windowSize, average, delta }: TrendSummaryProps) {
  const lastRolling = average !== null && delta !== null ? average + delta : null;
  const tone =
    delta === null || metric.polarity === 'neutral' || Math.abs(delta) < 1e-9
      ? 'text-secondary'
      : (delta > 0) === (metric.polarity === 'higher')
        ? 'text-positive'
        : 'text-negative';
  const signed = (value: number) => {
    const text = formatTrendValue(Math.abs(value), metric.unit === 'pct' ? 'count' : metric.unit);
    const unit = metric.unit === 'pct' ? ' pp' : '';
    return value > 0 ? `+${text}${unit}` : value < 0 ? `−${text}${unit}` : `0${unit}`;
  };

  return (
    <dl className="grid grid-cols-3 gap-3">
      <SummaryItem label={`Utolsó ${windowSize} meccs`}>
        {lastRolling !== null ? formatTrendValue(lastRolling, metric.unit) : '–'}
      </SummaryItem>
      <SummaryItem label="Szakasz átlaga">{average !== null ? formatTrendValue(average, metric.unit) : '–'}</SummaryItem>
      <SummaryItem label="Eltérés" className={tone}>
        {delta !== null ? signed(delta) : '–'}
      </SummaryItem>
    </dl>
  );
}

function SummaryItem({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="uppercase-label text-xs text-secondary">{label}</dt>
      <dd className={cn('font-mono text-xl tabular-nums', className)} data-stat>
        {children}
      </dd>
    </div>
  );
}

function TrendLegend({ windowSize }: { windowSize: TrendWindow }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary" aria-hidden="true">
      <li className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-cyan" />
        Meccs
      </li>
      <li className="flex items-center gap-2">
        <span className="h-0.5 w-4 rounded-full bg-orange" />
        Utolsó {windowSize} meccs
      </li>
      <li className="flex items-center gap-2">
        <span className="w-4 border-t border-dashed border-secondary" />
        Szakasz átlaga
      </li>
    </ul>
  );
}

interface TrendTooltipProps {
  point: TrendPoint | undefined;
  metric: TrendMetric;
  windowSize: TrendWindow;
  teamsById: TeamsById;
}

function TrendTooltip({ point, metric, windowSize, teamsById }: TrendTooltipProps) {
  if (!point) return null;
  const opponent = teamsById.get(point.opponentTeamId);
  const opponentLabel = `${point.isHome ? 'vs' : '@'} ${opponent?.abbreviation ?? opponent?.name ?? '?'}`;
  return (
    <div className="rounded-md border border-border-active bg-surface-2 px-3 py-2 text-xs shadow-panel">
      <p className="font-display font-semibold uppercase tracking-wider text-primary">
        {formatGameDate(point.gameDate)} {opponentLabel}
      </p>
      <p className="mt-1 text-secondary">
        {metric.label}:{' '}
        <span className="font-mono tabular-nums text-primary">
          {point.value !== null ? formatTrendValue(point.value, metric.unit) : '–'}
        </span>
      </p>
      {point.rolling !== null && (
        <p className="text-secondary">
          Utolsó {windowSize} meccs:{' '}
          <span className="font-mono tabular-nums text-orange">{formatTrendValue(point.rolling, metric.unit)}</span>
        </p>
      )}
    </div>
  );
}
