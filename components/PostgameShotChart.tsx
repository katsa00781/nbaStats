'use client';

import type { ChartData, ChartOptions, Plugin } from 'chart.js';
import { CHART_COLORS, CHART_COURT, CHARTJS_TOOLTIP_STYLE, heatRampRgb } from '@/lib/chart-theme';
import { Chart as ChartJS, LinearScale, PointElement, Tooltip } from 'chart.js';
import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip);

/** Egy dobás a pályán: lábban, a kosár a (25, 0) pontban, az y a kosártól az alapvonalra merőleges távolság. */
export interface CourtShot {
  x: number;
  y: number;
  made: boolean;
  shotValue: 2 | 3;
  playerName: string;
  zoneLabel: string;
  /** Pl. „Q2 5:31”. */
  timeLabel: string;
}

export type HeatmapMode = 'volume' | 'efficiency';
export type HeatmapContrast = 'soft' | 'normal' | 'sharp';

interface PostgameShotChartProps {
  shots: readonly CourtShot[];
  showPoints: boolean;
  showHeatmap: boolean;
  heatmapMode: HeatmapMode;
  heatmapContrast: HeatmapContrast;
}

/**
 * NBA-félpálya lábban (a kosár közepe a (25, 0) pontban). A mélység az alapvonaltól
 * (−5,25) a kosártól 35 lábig tart; az ennél távolabbi (ritka, negyedvégi) dobást a pálya
 * szélére szorítjuk, nem dobjuk el (T11).
 */
const COURT = {
  width: 50,
  hoopX: 25,
  baselineY: -5.25,
  maxY: 35,
  backboardY: -1.25,
  backboardHalf: 3,
  hoopRadius: 0.75,
  restrictedRadius: 4,
  paintHalf: 8,
  freeThrowY: 19 - 5.25,
  freeThrowRadius: 6,
  threeRadius: 23.75,
  cornerX: 3,
} as const;
/** A sarokvonal és az ív találkozása (a kosártól mért y). */
const CORNER_Y = Math.sqrt(COURT.threeRadius ** 2 - (COURT.hoopX - COURT.cornerX) ** 2);
const COURT_DEPTH = COURT.maxY - COURT.baselineY;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const HEATMAP_PROFILE: Record<HeatmapContrast, { exponent: number; radiusFactor: number; threshold: number; alphaBase: number; alphaScale: number }> = {
  soft: { exponent: 0.95, radiusFactor: 0.92, threshold: 0.03, alphaBase: 0.04, alphaScale: 0.42 },
  normal: { exponent: 1.3, radiusFactor: 0.72, threshold: 0.08, alphaBase: 0.06, alphaScale: 0.72 },
  sharp: { exponent: 2.1, radiusFactor: 0.46, threshold: 0.16, alphaBase: 0.1, alphaScale: 0.98 },
};

/** Hőtérkép-rács: 5 × 5 lábas cellák. */
const HEAT_X_BINS = 10;
const HEAT_Y_BINS = 8;

const courtPlugin: Plugin<'scatter'> = {
  id: 'nba-court-layer',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;
    const toX = (x: number) => xScale.getPixelForValue(x);
    const toY = (y: number) => yScale.getPixelForValue(y);
    // Az arány rögzített (aspectRatio), ezért a két tengely léptéke azonos.
    const px = (feet: number) => Math.abs(toX(feet) - toX(0));
    const hoopX = toX(COURT.hoopX);
    const hoopY = toY(0);

    ctx.save();
    ctx.fillStyle = CHART_COURT.surface;
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);

    // Festék + büntetővonal.
    ctx.fillStyle = CHART_COURT.paintFill;
    ctx.strokeStyle = CHART_COURT.line;
    ctx.lineWidth = 1.2;
    const paintLeft = toX(COURT.hoopX - COURT.paintHalf);
    const paintTop = toY(COURT.baselineY);
    ctx.beginPath();
    ctx.rect(paintLeft, paintTop, px(COURT.paintHalf * 2), toY(COURT.freeThrowY) - paintTop);
    ctx.fill();
    ctx.stroke();

    // Büntetőkör (a pálya közepe felé eső fele).
    ctx.beginPath();
    ctx.arc(hoopX, toY(COURT.freeThrowY), px(COURT.freeThrowRadius), 0, Math.PI);
    ctx.stroke();

    // Restricted area: félkör a kosár körül, a pálya felé.
    ctx.beginPath();
    ctx.arc(hoopX, hoopY, px(COURT.restrictedRadius), 0, Math.PI);
    ctx.stroke();

    // Hármasvonal: egyenes sarokszakaszok, köztük a 23,75 lábas ív.
    ctx.strokeStyle = CHART_COURT.threeLine;
    ctx.lineWidth = 2;
    const arcStart = Math.atan2(toY(CORNER_Y) - hoopY, toX(COURT.width - COURT.cornerX) - hoopX);
    const arcEnd = Math.atan2(toY(CORNER_Y) - hoopY, toX(COURT.cornerX) - hoopX);
    ctx.beginPath();
    ctx.moveTo(toX(COURT.cornerX), toY(COURT.baselineY));
    ctx.lineTo(toX(COURT.cornerX), toY(CORNER_Y));
    ctx.moveTo(toX(COURT.width - COURT.cornerX), toY(COURT.baselineY));
    ctx.lineTo(toX(COURT.width - COURT.cornerX), toY(CORNER_Y));
    ctx.arc(hoopX, hoopY, px(COURT.threeRadius), arcStart, arcEnd);
    ctx.stroke();

    // Alapvonal, palánk, gyűrű.
    ctx.strokeStyle = CHART_COURT.lineStrong;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(COURT.baselineY));
    ctx.lineTo(toX(COURT.width), toY(COURT.baselineY));
    ctx.moveTo(toX(COURT.hoopX - COURT.backboardHalf), toY(COURT.backboardY));
    ctx.lineTo(toX(COURT.hoopX + COURT.backboardHalf), toY(COURT.backboardY));
    ctx.stroke();
    ctx.strokeStyle = CHART_COURT.hoop;
    ctx.beginPath();
    ctx.arc(hoopX, hoopY, Math.max(px(COURT.hoopRadius), 4), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },
};

/** Dobástérkép NBA-félpályán: pontok (bement / kimaradt) és opcionális hőtérkép (volumen vagy FG%). */
export function PostgameShotChart({ shots, showPoints, showHeatmap, heatmapMode, heatmapContrast }: PostgameShotChartProps) {
  const profile = HEATMAP_PROFILE[heatmapContrast];

  const courtShots = useMemo(
    () =>
      shots
        .filter(shot => Number.isFinite(shot.x) && Number.isFinite(shot.y))
        .map(shot => ({ ...shot, x: clamp(shot.x, 0, COURT.width), y: clamp(shot.y, COURT.baselineY, COURT.maxY) })),
    [shots],
  );

  const heatCells = useMemo(() => {
    const xStep = COURT.width / HEAT_X_BINS;
    const yStep = COURT_DEPTH / HEAT_Y_BINS;
    const cells = Array.from({ length: HEAT_X_BINS * HEAT_Y_BINS }, (_, index) => ({
      xIndex: index % HEAT_X_BINS,
      yIndex: Math.floor(index / HEAT_X_BINS),
      attempts: 0,
      made: 0,
    }));
    for (const shot of courtShots) {
      const xIndex = Math.min(HEAT_X_BINS - 1, Math.floor(shot.x / xStep));
      const yIndex = Math.min(HEAT_Y_BINS - 1, Math.floor((shot.y - COURT.baselineY) / yStep));
      const cell = cells[yIndex * HEAT_X_BINS + xIndex];
      cell.attempts += 1;
      if (shot.made) cell.made += 1;
    }
    return { xStep, yStep, cells, maxAttempts: Math.max(0, ...cells.map(cell => cell.attempts)) };
  }, [courtShots]);

  const heatmapPlugin = useMemo<Plugin<'scatter'>>(
    () => ({
      id: 'nba-heatmap-layer',
      beforeDatasetsDraw(chart) {
        if (!showHeatmap || heatCells.maxAttempts <= 0) return;
        const { ctx, scales } = chart;
        const xScale = scales.x;
        const yScale = scales.y;
        if (!xScale || !yScale) return;
        const toX = (x: number) => xScale.getPixelForValue(x);
        const toY = (y: number) => yScale.getPixelForValue(y);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const cell of heatCells.cells) {
          if (cell.attempts <= 0) continue;
          if (heatmapMode === 'efficiency' && cell.attempts < 3) continue;
          const volumeRatio = cell.attempts / heatCells.maxAttempts;
          const fgPct = cell.made / cell.attempts;
          const efficiencyRatio = clamp((fgPct - 0.25) / 0.5, 0, 1) * clamp(cell.attempts / 6, 0.45, 1);
          const ratio = Math.pow(heatmapMode === 'efficiency' ? efficiencyRatio : volumeRatio, profile.exponent);
          const threshold = heatmapMode === 'efficiency' ? Math.max(profile.threshold, 0.1) : profile.threshold;
          if (ratio < threshold) continue;

          const centerX = toX((cell.xIndex + 0.5) * heatCells.xStep);
          const centerY = toY(COURT.baselineY + (cell.yIndex + 0.5) * heatCells.yStep);
          const radius = Math.abs(toX(heatCells.xStep) - toX(0)) * profile.radiusFactor;
          const rgb = heatRampRgb(ratio);
          const alpha = profile.alphaBase + ratio * profile.alphaScale;
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(0, `rgba(${rgb}, ${alpha.toFixed(3)})`);
          gradient.addColorStop(0.58, `rgba(${rgb}, ${(alpha * 0.56).toFixed(3)})`);
          gradient.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    }),
    [heatCells, showHeatmap, heatmapMode, profile],
  );

  const chartData = useMemo<ChartData<'scatter', Array<CourtShot & { x: number; y: number }>>>(() => {
    const visible = showPoints ? courtShots : [];
    return {
      datasets: [
        {
          label: 'Bement',
          data: visible.filter(shot => shot.made),
          backgroundColor: CHART_COLORS.positive,
          borderColor: CHART_COLORS.base,
          borderWidth: 1,
          pointRadius: 4.5,
          pointHoverRadius: 6.5,
        },
        {
          label: 'Kimaradt',
          data: visible.filter(shot => !shot.made),
          backgroundColor: CHART_COLORS.negative,
          borderColor: CHART_COLORS.negative,
          borderWidth: 1.6,
          pointStyle: 'crossRot',
          pointRadius: 4.5,
          pointHoverRadius: 6.5,
        },
      ],
    };
  }, [courtShots, showPoints]);

  const options = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: COURT.width / COURT_DEPTH,
      animation: { duration: 300 },
      layout: { padding: 0 },
      scales: {
        x: { type: 'linear', min: 0, max: COURT.width, display: false },
        // A kosár felül: az y-tengely fordított (az alapvonal a rajz tetején).
        y: { type: 'linear', min: COURT.baselineY, max: COURT.maxY, reverse: true, display: false },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: showPoints,
          ...CHARTJS_TOOLTIP_STYLE,
          callbacks: {
            title(items) {
              const raw = items[0]?.raw as CourtShot | undefined;
              return raw ? raw.playerName : '';
            },
            label(context) {
              const raw = context.raw as CourtShot;
              const distance = Math.hypot(raw.x - COURT.hoopX, raw.y).toFixed(0);
              return `${context.dataset.label} · ${raw.shotValue}P · ${raw.zoneLabel} · ${distance} láb · ${raw.timeLabel}`;
            },
          },
        },
      },
    }),
    [showPoints],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border-active">
      <Scatter data={chartData} options={options} plugins={[courtPlugin, heatmapPlugin]} />
    </div>
  );
}
