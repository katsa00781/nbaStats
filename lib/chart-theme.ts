/**
 * Dark Command Center – egységes chart színrendszer
 * Recharts és Chart.js komponensekhez közös konstansok.
 * Értékek a globals.css :root tokenjeivel szinkronban tartva.
 */

export const CHART_COLORS = {
  cyan:     '#00D4FF',
  orange:   '#FF6B35',
  positive: '#10D98A',
  negative: '#FF4757',
  ai:       '#7C3AED',
  warning:  '#FFB627',
  primary:  '#E8F4FF',
  secondary:'#5A7A99',
  muted:    '#2D4A6B',
  base:     '#050B14',
} as const;

export const CHART_GRID = {
  stroke:       'rgba(15, 32, 64, 0.9)',
  strokeDashed: '3 3',
} as const;

export const CHART_AXIS = {
  stroke:    '#5A7A99',
  fontSize:  11,
  fontFamily: '"Barlow Condensed", ui-sans-serif, system-ui, sans-serif',
  tickLine:  false,
  axisLine:  false,
} as const;

export const RECHARTS_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#0F1F3D',
  border: '1px solid #1E3A5F',
  borderRadius: '6px',
  color: '#E8F4FF',
  fontSize: '12px',
  fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
};

export const RECHARTS_LEGEND_STYLE: React.CSSProperties = {
  fontFamily: '"Barlow Condensed", ui-sans-serif, system-ui, sans-serif',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#5A7A99',
};

export const CHARTJS_TOOLTIP_STYLE = {
  backgroundColor: '#0F1F3D',
  borderColor: '#1E3A5F',
  borderWidth: 1,
  titleColor: '#E8F4FF',
  bodyColor: '#5A7A99',
  titleFont: {
    family: '"Barlow Condensed", ui-sans-serif, system-ui, sans-serif',
    size: 12,
    weight: 600,
  },
  bodyFont: {
    family: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    size: 11,
  },
  padding: 10,
  cornerRadius: 6,
} as const;

export const CHARTJS_AXIS_TICK_COLOR = '#5A7A99';
export const CHARTJS_GRID_COLOR = 'rgba(30, 58, 95, 0.30)';

/** `#RRGGBB` → `"R, G, B"` (az `rgba()`-hoz, a palettaszínek áttetsző változataihoz). */
export const hexToRgbTriplet = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

/** A palettaszín áttetsző változata (`rgba`). */
export const withAlpha = (hex: string, alpha: number): string => `rgba(${hexToRgbTriplet(hex)}, ${alpha})`;

/**
 * Kosárlabdapálya-rajz (Chart.js plugin) színei – a paletta áttetsző változatai, új szín nélkül:
 * felület a surface-1-ből, vonalak a primary szövegszínből, festék és hármasív ciánnal, gyűrű naranccsal.
 */
export const CHART_COURT = {
  surface:   'rgba(10, 22, 40, 0.65)',
  line:      withAlpha(CHART_COLORS.primary, 0.45),
  lineStrong: withAlpha(CHART_COLORS.primary, 0.7),
  paintFill: withAlpha(CHART_COLORS.cyan, 0.06),
  threeLine: withAlpha(CHART_COLORS.cyan, 0.8),
  hoop:      CHART_COLORS.orange,
} as const;

/**
 * Hőtérkép-skála (hideg → meleg): a pozitív zöldből a figyelmeztető sárgán át a negatív pirosig.
 * `ratio` 0–1; az eredmény `"R, G, B"` hármas.
 */
export const heatRampRgb = (ratio: number): string => {
  const stops = [CHART_COLORS.positive, CHART_COLORS.warning, CHART_COLORS.negative].map(hex =>
    hexToRgbTriplet(hex).split(', ').map(Number),
  );
  const r = Math.max(0, Math.min(1, ratio));
  const [from, to, t] = r <= 0.5 ? [stops[0], stops[1], r / 0.5] : [stops[1], stops[2], (r - 0.5) / 0.5];
  return from.map((value, i) => Math.round(value + (to[i] - value) * t)).join(', ');
};
