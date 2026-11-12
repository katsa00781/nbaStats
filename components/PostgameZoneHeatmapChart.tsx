'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { CHART_COLORS, CHARTJS_AXIS_TICK_COLOR, CHARTJS_GRID_COLOR, CHARTJS_TOOLTIP_STYLE, withAlpha } from '@/lib/chart-theme';
import { Chart as ChartJS, LinearScale, PointElement, Tooltip } from 'chart.js';
import { useMemo } from 'react';
import { Bubble } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip);

/** Egy zóna eltérése a szezonreferenciától, százalékpontban; az FG%-delta `null`, ha nincs kísérlet. */
export interface ZoneHeatCell {
  label: string;
  rateDelta: number;
  pctDelta: number | null;
}

const ROWS = [
  { key: 'rateDelta', label: 'Volumen (pp)' },
  { key: 'pctDelta', label: 'FG% (pp)' },
] as const;

/** ±10 pp-nél telítődik a szín. */
const SATURATION_PP = 10;

const fillFor = (value: number) => {
  const clamped = Math.max(-SATURATION_PP, Math.min(SATURATION_PP, value));
  const alpha = 0.22 + (Math.abs(clamped) / SATURATION_PP) * 0.55;
  return withAlpha(clamped >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative, Number(alpha.toFixed(3)));
};

interface BubblePoint {
  x: number;
  y: number;
  r: number;
  value: number;
  zoneLabel: string;
  metricLabel: string;
}

/** Zóna-delta hőtérkép: soronként a volumen- és az FG%-eltérés a szezonhoz, zónánként (ASEStats-port). */
export function PostgameZoneHeatmapChart({ cells }: { cells: readonly ZoneHeatCell[] }) {
  const chartData = useMemo<ChartData<'bubble', BubblePoint[]>>(() => {
    const points = cells.flatMap((cell, xIndex) =>
      ROWS.flatMap((row, rowIndex) => {
        const value = row.key === 'rateDelta' ? cell.rateDelta : cell.pctDelta;
        if (value === null) return [];
        return [{ x: xIndex + 1, y: rowIndex + 1, r: 18, value, zoneLabel: cell.label, metricLabel: row.label }];
      }),
    );
    return {
      datasets: [
        {
          label: 'Zóna delta',
          data: points,
          backgroundColor: points.map(point => fillFor(point.value)),
          borderColor: points.map(point => (point.value >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative)),
          borderWidth: 1.2,
          hoverBorderWidth: 2,
        },
      ],
    };
  }, [cells]);

  const options = useMemo<ChartOptions<'bubble'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: 0.5,
          max: cells.length + 0.5,
          // A tick-ek a cellák közepén (1, 2, …), nem a 0,5-ös határokon.
          afterBuildTicks: axis => {
            axis.ticks = cells.map((_, index) => ({ value: index + 1 }));
          },
          ticks: {
            color: CHARTJS_AXIS_TICK_COLOR,
            autoSkip: false,
            maxRotation: 0,
            font: { size: 10 },
            callback: value => cells[Number(value) - 1]?.label ?? '',
          },
          grid: { display: false },
          border: { color: CHARTJS_GRID_COLOR },
        },
        y: {
          type: 'linear',
          min: 0.5,
          max: ROWS.length + 0.5,
          afterBuildTicks: axis => {
            axis.ticks = ROWS.map((_, index) => ({ value: index + 1 }));
          },
          ticks: {
            color: CHARTJS_AXIS_TICK_COLOR,
            font: { size: 10 },
            callback: value => ROWS[Number(value) - 1]?.label ?? '',
          },
          grid: { display: false },
          border: { color: CHARTJS_GRID_COLOR },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHARTJS_TOOLTIP_STYLE,
          callbacks: {
            label(context) {
              const raw = context.raw as BubblePoint;
              return `${raw.zoneLabel} · ${raw.metricLabel}: ${raw.value > 0 ? '+' : ''}${raw.value.toFixed(1)}`;
            },
          },
        },
      },
    }),
    [cells],
  );

  return (
    <div className="h-56">
      <Bubble data={chartData} options={options} />
    </div>
  );
}
