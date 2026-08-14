// AI-generated (Claude)
// Chart palette.
//
// Three categorical slots (blue / orange / aqua) carry the three profile
// series; deco uses the fixed status colours, which are deliberately not
// categorical slots so a warning never impersonates a series. Both modes were
// checked with the data-viz validator against this app's own surfaces (white
// and black), all pairs:
//
//   light  CVD dE 9.2 (deutan)  normal dE 24.0  - aqua is below 3:1 on white,
//                                                 so the relief rule applies:
//                                                 the legend labels every
//                                                 series in text.
//   dark   CVD dE 9.4 (deutan)  normal dE 20.9  - all three clear 3:1.
//
// Re-run before changing any value:
//   node scripts/validate_palette.js "<hex,hex,hex>" --mode light --surface "#ffffff" --pairs all

export type ChartPalette = {
  depth: string;
  depthFill: string;
  /**
   * Bars on the statistics charts. Each of those charts draws a single series
   * (a count), so they all wear the first categorical slot - the same hex as
   * `depth`, named separately because it is a different job. No new hue, so the
   * validation above still stands.
   */
  bar: string;
  /** The selected bar of a statistics chart; the rest stay `bar`. */
  barSelected: string;
  temperature: string;
  pressure: string;
  /** Deco ceiling: status "critical". Fixed, never themed. */
  ceiling: string;
  ceilingFill: string;
  /** Event markers: status "warning", always drawn with a label beside them. */
  event: string;
  grid: string;
  axis: string;
  label: string;
  crosshair: string;
  surface: string;
};

export const ChartColors: { light: ChartPalette; dark: ChartPalette } = {
  light: {
    depth: '#2a78d6',
    depthFill: 'rgba(42, 120, 214, 0.18)',
    bar: '#2a78d6',
    barSelected: '#1b5399',
    temperature: '#eb6834',
    pressure: '#1baf7a',
    ceiling: '#d03b3b',
    ceilingFill: 'rgba(208, 59, 59, 0.14)',
    event: '#fab219',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    label: '#898781',
    crosshair: '#52514e',
    surface: '#ffffff',
  },
  dark: {
    depth: '#3987e5',
    depthFill: 'rgba(57, 135, 229, 0.22)',
    bar: '#3987e5',
    barSelected: '#8ab8f2',
    temperature: '#d95926',
    pressure: '#199e70',
    ceiling: '#d03b3b',
    ceilingFill: 'rgba(208, 59, 59, 0.18)',
    event: '#fab219',
    grid: '#2c2c2a',
    axis: '#383835',
    label: '#898781',
    crosshair: '#c3c2b7',
    surface: '#000000',
  },
};
