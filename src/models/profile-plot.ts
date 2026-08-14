// AI-generated (Claude)
// Presentation model of the dive profile.
//
// The C++ core does the hard part: `getProfile` returns a fully plotted
// `plot_info` - interpolated samples, deco ceilings, per-cylinder pressures -
// in raw core units (mm, mbar, mkelvin, seconds). This file turns that into the
// handful of series a chart draws, picks axis ticks, and answers "what was
// happening at second N" for the scrubber. No pixels here: the renderer owns
// the scales, so the same model drives any canvas size and zoom level.
//
// What to draw follows subsurface/profile-widget/ (depth envelope, temperature,
// tank pressure, deco ceiling, event markers); how it is drawn is new, because
// that code is Qt.

import type { DiveEvent, PlotInfo } from './index';
import { EventSeverity, plotPressureAt } from './index';
import {
  mkelvinToCelsius,
  mkelvinToFahrenheit,
  mmToFeet,
  mmToMeters,
  formatDepth,
  formatDuration,
  formatPressure,
  formatTemperature,
  type UnitSystem,
} from './units';

export type Point = { sec: number; value: number };

export type Range = { min: number; max: number };

export type PressureSeries = {
  cylinder: number;
  points: Point[];
};

export type ProfileEvent = {
  sec: number;
  name: string;
  severity: EventSeverity;
  /** Depth at that moment, so the marker can sit on the depth curve. */
  depthMm: number;
};

export type ProfilePlot = {
  /** Seconds; the x domain always starts at 0, like the desktop profile. */
  maxSec: number;
  /** Millimetres; the y domain of the depth axis, rounded out by the caller. */
  maxDepthMm: number;
  /** Depth of every plotted sample, in order. */
  depth: Point[];
  /**
   * Deco ceiling, in millimetres, for the stretch where the dive was in deco.
   * Empty for a dive that never was.
   */
  ceiling: Point[];
  /** Water temperature, in mkelvin. Sparse: dive computers report it rarely. */
  temperature: Point[];
  temperatureRange: Range;
  /** One series per cylinder, in mbar, skipping cylinders with no readings. */
  pressures: PressureSeries[];
  pressureRange: Range;
  events: ProfileEvent[];
};

/** Empty plot, for the "no samples" case, so callers need no null checks. */
export const EMPTY_PROFILE_PLOT: ProfilePlot = {
  maxSec: 0,
  maxDepthMm: 0,
  depth: [],
  ceiling: [],
  temperature: [],
  temperatureRange: { min: 0, max: 0 },
  pressures: [],
  pressureRange: { min: 0, max: 0 },
  events: [],
};

function range(values: number[]): Range {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

function depthAt(plot: Point[], sec: number): number {
  if (plot.length === 0) {
    return 0;
  }
  let best = plot[0];
  for (const point of plot) {
    if (Math.abs(point.sec - sec) < Math.abs(best.sec - sec)) {
      best = point;
    }
  }
  return best.value;
}

/**
 * Builds every series of one profile. `events` come from the dive's
 * divecomputer (`getDive(id).dcs[dcIndex].events`) - `getProfile` does not
 * carry them.
 */
export function buildProfilePlot(pi: PlotInfo, events: DiveEvent[] = []): ProfilePlot {
  if (pi.entry.length === 0) {
    return EMPTY_PROFILE_PLOT;
  }

  const depth: Point[] = pi.entry.map((entry) => ({ sec: entry.sec, value: entry.depthMm }));
  const ceiling: Point[] = pi.entry
    .filter((entry) => entry.ceilingMm > 0)
    .map((entry) => ({ sec: entry.sec, value: entry.ceilingMm }));
  const temperature: Point[] = pi.entry
    .filter((entry) => entry.temperatureMkelvin > 0)
    .map((entry) => ({ sec: entry.sec, value: entry.temperatureMkelvin }));

  const pressures: PressureSeries[] = [];
  for (let cylinder = 0; cylinder < pi.nrCylinders; cylinder++) {
    const points: Point[] = [];
    pi.entry.forEach((entry, index) => {
      const mbar = plotPressureAt(pi, index, cylinder);
      if (mbar > 0) {
        points.push({ sec: entry.sec, value: mbar });
      }
    });
    if (points.length > 1) {
      pressures.push({ cylinder, points });
    }
  }

  const hidden = (event: DiveEvent) => event.hidden;
  const profileEvents: ProfileEvent[] = events
    .filter((event) => !hidden(event) && event.timeSec <= pi.maxtimeSec)
    .map((event) => ({
      sec: event.timeSec,
      name: event.name,
      severity: event.severity,
      depthMm: depthAt(depth, event.timeSec),
    }));

  return {
    maxSec: Math.max(pi.maxtimeSec, depth[depth.length - 1]?.sec ?? 0),
    maxDepthMm: Math.max(pi.maxDepthMm, ...depth.map((point) => point.value)),
    depth,
    ceiling,
    temperature,
    temperatureRange: range(temperature.map((point) => point.value)),
    pressures,
    pressureRange: range(pressures.flatMap((series) => series.points.map((p) => p.value))),
    events: profileEvents,
  };
}

// --- Axes ------------------------------------------------------------------

export type Tick<T> = { value: T; label: string };

/** Picks the smallest step from `steps` that keeps the tick count at or under `max`. */
function pickStep(span: number, steps: number[], max: number): number {
  for (const step of steps) {
    if (span / step <= max) {
      return step;
    }
  }
  return steps[steps.length - 1];
}

/**
 * Depth gridlines, in millimetres, at round depths in the *displayed* unit -
 * 10 m or 30 ft, not 10 m converted to a ragged number of feet.
 */
export function depthTicks(maxDepthMm: number, system: UnitSystem, max = 6): Tick<number>[] {
  if (maxDepthMm <= 0) {
    return [];
  }
  const perUnitMm = system === 'imperial' ? 304.8 : 1000;
  const span = system === 'imperial' ? mmToFeet(maxDepthMm) : mmToMeters(maxDepthMm);
  const steps = system === 'imperial' ? [10, 20, 30, 50, 100, 200] : [5, 10, 20, 30, 50, 100];
  const step = pickStep(span, steps, max);

  const ticks: Tick<number>[] = [];
  for (let depth = step; depth <= span; depth += step) {
    ticks.push({ value: depth * perUnitMm, label: `${depth}` });
  }
  return ticks;
}

/** Time gridlines, in seconds, at round minute marks. */
export function timeTicks(maxSec: number, max = 6): Tick<number>[] {
  if (maxSec <= 0) {
    return [];
  }
  const step = pickStep(maxSec / 60, [1, 2, 5, 10, 15, 20, 30, 60, 120], max) * 60;
  const ticks: Tick<number>[] = [];
  for (let sec = step; sec <= maxSec; sec += step) {
    ticks.push({ value: sec, label: `${Math.round(sec / 60)}` });
  }
  return ticks;
}

// --- Windowing and decimation ----------------------------------------------

/**
 * The points of one series inside a time window, thinned to at most `maxCount`.
 *
 * Zooming rebuilds the drawn paths, so a 3000-sample profile would otherwise
 * mean 3000 path segments per frame. Thinning keeps two points per bucket - the
 * shallowest and the deepest - so the envelope survives: a spike never
 * disappears because the sample that carried it fell between strides, which is
 * what plain stride sampling does to a dive profile.
 *
 * The points bracketing the window are kept, so a curve entering or leaving the
 * viewport is still drawn to its edge.
 */
export function windowPoints(
  points: readonly Point[],
  fromSec: number,
  toSec: number,
  maxCount = 600
): Point[] {
  if (points.length === 0) {
    return [];
  }

  let start = 0;
  while (start + 1 < points.length && points[start + 1].sec < fromSec) {
    start++;
  }
  let end = points.length - 1;
  while (end > start && points[end - 1].sec > toSec) {
    end--;
  }

  const inside = points.slice(start, end + 1);
  if (inside.length <= maxCount || maxCount < 4) {
    return inside;
  }

  const buckets = Math.floor(maxCount / 2);
  const out: Point[] = [];
  for (let bucket = 0; bucket < buckets; bucket++) {
    const lo = Math.floor((bucket * inside.length) / buckets);
    const hi = Math.floor(((bucket + 1) * inside.length) / buckets);
    if (hi <= lo) {
      continue;
    }
    let min = inside[lo];
    let max = inside[lo];
    for (let i = lo + 1; i < hi; i++) {
      if (inside[i].value < min.value) {
        min = inside[i];
      }
      if (inside[i].value > max.value) {
        max = inside[i];
      }
    }
    const [first, second] = min.sec <= max.sec ? [min, max] : [max, min];
    out.push(first);
    if (second !== first) {
      out.push(second);
    }
  }
  return out;
}

// --- Scrubber --------------------------------------------------------------

export type ProfileReadout = {
  sec: number;
  timeText: string;
  depthText: string;
  temperatureText: string | null;
  pressureTexts: string[];
  inDeco: boolean;
  ceilingText: string | null;
  ndlText: string | null;
};

/** Index of the plotted sample nearest `sec`, or -1 when there are none. */
export function nearestSampleIndex(pi: PlotInfo, sec: number): number {
  if (pi.entry.length === 0) {
    return -1;
  }
  // The samples are sorted by time, so a binary search is enough - profiles run
  // to a few thousand entries and the scrubber asks on every frame.
  let low = 0;
  let high = pi.entry.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pi.entry[mid].sec < sec) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const after = low;
  const before = Math.max(0, low - 1);
  return Math.abs(pi.entry[before].sec - sec) <= Math.abs(pi.entry[after].sec - sec)
    ? before
    : after;
}

/** Everything the scrubber readout shows for the sample nearest `sec`. */
export function readoutAt(
  pi: PlotInfo,
  sec: number,
  system: UnitSystem = 'metric'
): ProfileReadout | null {
  const index = nearestSampleIndex(pi, sec);
  if (index < 0) {
    return null;
  }
  const entry = pi.entry[index];

  const pressureTexts: string[] = [];
  for (let cylinder = 0; cylinder < pi.nrCylinders; cylinder++) {
    const mbar = plotPressureAt(pi, index, cylinder);
    if (mbar > 0) {
      pressureTexts.push(formatPressure(mbar, system));
    }
  }

  return {
    sec: entry.sec,
    timeText: formatDuration(entry.sec),
    depthText: formatDepth(entry.depthMm, system),
    temperatureText:
      entry.temperatureMkelvin > 0 ? formatTemperature(entry.temperatureMkelvin, system) : null,
    pressureTexts,
    inDeco: entry.inDeco,
    ceilingText: entry.ceilingMm > 0 ? formatDepth(entry.ceilingMm, system) : null,
    ndlText: entry.ndlSec > 0 ? formatDuration(entry.ndlSec) : null,
  };
}

/** Temperature in the displayed unit, for scaling the temperature series. */
export function temperatureValue(mkelvin: number, system: UnitSystem): number {
  return system === 'imperial' ? mkelvinToFahrenheit(mkelvin) : mkelvinToCelsius(mkelvin);
}
