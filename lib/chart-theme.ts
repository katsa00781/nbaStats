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
