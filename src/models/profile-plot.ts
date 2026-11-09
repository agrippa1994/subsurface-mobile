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

import type { DiveEvent, PlotEntry, PlotInfo } from './index';
import { EventSeverity, plotPressureAt } from './index';
import {
  mbarToBar,
  mbarToPsi,
  mkelvinToCelsius,
  mkelvinToFahrenheit,
  mmToFeet,
  mmToMeters,
  formatDepth,
  formatDuration,
  formatPressure,
  formatTemperature,
  type Units,
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
   * The calculated deco ceiling, in millimetres: the core's Buehlmann (or VPM-B)
   * ceiling at the gradient factors in Settings (`plot_data::ceiling`, desktop's
   * DiveCalculatedCeiling). Only where it is above zero; empty for a dive that
   * never had one.
   */
  ceiling: Point[];
  /**
   * The ceiling the dive computer reported, in millimetres: its stop depth while
   * it said the diver was in deco, never below the diver (desktop's
   * DiveReportedCeiling, `min(stopdepth, depth)` where `in_deco`), 0 elsewhere.
   * One point per sample so the shape closes against the surface; empty when the
   * computer never reported one.
   */
  dcCeiling: Point[];
  /**
   * Gradient factor of the leading tissue at the depth of the moment, in
   * percent. Empty where the core reported none.
   */
  gfNow: Point[];
  /**
   * Gradient factor the diver would carry on surfacing from that moment, in
   * percent - the "am I clear to ascend" number.
   */
  gfSurface: Point[];
  /**
   * Shared y domain of both gradient factor series, in percent. Starts at 0 and
   * reaches at least 100, so the M-value limit sits at a fixed height instead of
   * the curve renormalising itself per dive.
   */
  gfRange: Range;
  /** Water temperature, in mkelvin. Sparse: dive computers report it rarely. */
  temperature: Point[];
  temperatureRange: Range;
  /** One series per cylinder, in mbar, skipping cylinders with no readings. */
  pressures: PressureSeries[];
  pressureRange: Range;
  events: ProfileEvent[];
  /**
   * Surface interval since the previous dive whose nitrogen this one starts
   * with, in seconds; null for a dive that starts with clean tissues.
   */
  surfaceIntervalSec: number | null;
};

/** Empty plot, for the "no samples" case, so callers need no null checks. */
export const EMPTY_PROFILE_PLOT: ProfilePlot = {
  maxSec: 0,
  maxDepthMm: 0,
  depth: [],
  ceiling: [],
  dcCeiling: [],
  gfNow: [],
  gfSurface: [],
  gfRange: { min: 0, max: 0 },
  temperature: [],
  temperatureRange: { min: 0, max: 0 },
  pressures: [],
  pressureRange: { min: 0, max: 0 },
  events: [],
  surfaceIntervalSec: null,
};

function range(values: number[]): Range {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * The two gradient factors do not arrive in the same unit, which is the one
 * thing to get right here: `current_gf` is a fraction of the M-value
 * (subsurface/core/profile.cpp:967) while `surface_gf` is already multiplied by
 * 100 (:973). The core's own tooltip does exactly this - `100.0 *
 * entry.current_gf` against a raw `entry.surface_gf` (:1409, :1411).
 *
 * Exported because the profile is not the only consumer: the SSI converter
 * sends both curves too, and a second copy of this factor is exactly the sort
 * of thing that drifts (see src/models/ssi/converter.ts).
 */
export function gfNowPercent(entry: PlotEntry): number {
  return entry.currentGf * 100;
}

/** Rounds a gradient factor axis out to the next 25%, never below 100%. */
function gfAxisMax(values: number[]): number {
  const observed = values.length > 0 ? Math.max(...values) : 0;
  return Math.max(100, Math.ceil(observed / 25) * 25);
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
 * The dive computer's ceiling at one sample: what desktop's DiveReportedCeiling
 * draws (profile-widget/diveprofileitem.cpp) - the stop depth while in deco, but
 * never deeper than the diver is.
 */
export function dcCeilingMm(entry: PlotEntry): number {
  return entry.inDeco && entry.stopdepthMm > 0 ? Math.min(entry.stopdepthMm, entry.depthMm) : 0;
}

/**
 * Which series the profile shows, from Settings. Purely display: every one of
 * them is in each plot_info already, so none of these is part of a profile's
 * query key.
 */
export type ProfileSeries = {
  showGfNow: boolean;
  showGfSurface: boolean;
  /** The ceiling the dive computer reported (desktop: "dive computer reported ceiling"). */
  showDcCeiling: boolean;
  /** The ceiling the core calculates (desktop: "calculated ceiling"). */
  showCalcCeiling: boolean;
  /** Depth gridlines at multiples of three in the depth unit (desktop: "3m based grid"). */
  threeMeterGrid: boolean;
};

/** The core's defaults (core/pref.cpp: dcceiling on, calcceiling and the 3 m grid off). */
export const DEFAULT_PROFILE_SERIES: ProfileSeries = {
  showGfNow: false,
  showGfSurface: false,
  showDcCeiling: true,
  showCalcCeiling: false,
  threeMeterGrid: false,
};

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
  const reported = pi.entry.map((entry) => ({ sec: entry.sec, value: dcCeilingMm(entry) }));
  const dcCeiling = reported.some((point) => point.value > 0) ? reported : [];
  const temperature: Point[] = pi.entry
    .filter((entry) => entry.temperatureMkelvin > 0)
    .map((entry) => ({ sec: entry.sec, value: entry.temperatureMkelvin }));

  // Both are built whether or not the user asked for them: the model stays free
  // of preferences and the chart decides what to draw. The `> 0` guards are the
  // core's own (profile.cpp:1408-1411) - a zero means "not computed", not "no
  // tissue loading".
  const gfNow: Point[] = pi.entry
    .filter((entry) => entry.currentGf > 0)
    .map((entry) => ({ sec: entry.sec, value: gfNowPercent(entry) }));
  const gfSurface: Point[] = pi.entry
    .filter((entry) => entry.surfaceGf > 0)
    .map((entry) => ({ sec: entry.sec, value: entry.surfaceGf }));

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
    dcCeiling,
    gfNow,
    gfSurface,
    gfRange: {
      min: 0,
      max: gfAxisMax([...gfNow, ...gfSurface].map((point) => point.value)),
    },
    temperature,
    temperatureRange: range(temperature.map((point) => point.value)),
    pressures,
    pressureRange: range(pressures.flatMap((series) => series.points.map((p) => p.value))),
    events: profileEvents,
    surfaceIntervalSec: pi.surfaceIntervalSec ?? null,
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
 * Steps of a grid based on three: 1, 3, 6 and 15 times a power of ten, in the
 * displayed unit - desktop's sensibleInterval() with gridIsMultipleOfThree
 * (profile-widget/divecartesianaxis.cpp). Desktop quantizes in whatever unit
 * the axis shows, so in feet the lines fall on 30, 60, 150 ft, not on feet
 * converted from 3 m.
 */
const THREE_BASED_STEPS = [3, 6, 15, 30, 60, 150, 300];

/**
 * Depth gridlines, in millimetres, at round depths in the *displayed* unit -
 * 10 m or 30 ft, not 10 m converted to a ragged number of feet. `threeBased`
 * puts them at multiples of three instead, for divers whose stops are 3 m apart.
 */
export function depthTicks(maxDepthMm: number, units: Units, max = 6, threeBased = false): Tick<number>[] {
  if (maxDepthMm <= 0) {
    return [];
  }
  const perUnitMm = units.depth === 'ft' ? 304.8 : 1000;
  const span = units.depth === 'ft' ? mmToFeet(maxDepthMm) : mmToMeters(maxDepthMm);
  const steps = threeBased
    ? THREE_BASED_STEPS
    : units.depth === 'ft'
      ? [10, 20, 30, 50, 100, 200]
      : [5, 10, 20, 30, 50, 100];
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
  /** One entry per cylinder, in cylinder order; null where it has no reading. */
  pressures: { cylinder: number; text: string | null }[];
  inDeco: boolean;
  /** The core's calculated ceiling here, or null where there is none. */
  calcCeilingText: string | null;
  /** The dive computer's reported ceiling here, or null where it reported none. */
  dcCeilingText: string | null;
  /** What the dive computer recorded. Null where it recorded nothing. */
  ndlText: string | null;
  /** The dive computer's own time to surface, where it recorded one. */
  ttsText: string | null;
  /**
   * Subsurface's calculation, with the tissues loaded by the earlier dives of
   * the log: in deco it carries a TTS, otherwise an NDL. Null where the core
   * computed neither (above 3m, or a profile from the planner).
   */
  decoCalc: DecoCalc | null;
  /**
   * The same calculation as if the dive had started with clean tissues. Null
   * when nothing loaded them, since it would equal `decoCalc`.
   */
  decoFresh: DecoCalc | null;
  /** Gradient factor at depth, e.g. "62%". Null where the core reported none. */
  gfNowText: string | null;
  /** Gradient factor on surfacing now, e.g. "78%". */
  gfSurfaceText: string | null;
};

/** A calculated NDL or TTS, already formatted. */
export type DecoCalc = { kind: 'ndl' | 'tts'; text: string };

/**
 * The core caps both searches at two hours (MAX_PROFILE_DECO, profile.cpp:38)
 * and reports the cap itself, so a value at the cap means "more than that".
 */
const MAX_PROFILE_DECO_SEC = 7200;

function calcText(sec: number): string {
  return sec >= MAX_PROFILE_DECO_SEC ? '>2:00:00' : formatDuration(sec);
}

/** The NDL or TTS one calculated sample shows, after the core's tooltip (profile.cpp:1355-1375). */
function decoCalc(inDeco: boolean, ndlSec: number, ttsSec: number): DecoCalc | null {
  if (inDeco || ttsSec > 0) {
    return ttsSec > 0 ? { kind: 'tts', text: calcText(ttsSec) } : null;
  }
  return ndlSec > 0 ? { kind: 'ndl', text: calcText(ndlSec) } : null;
}

/** "NDL 12:00" / "TTS 4:00", with an optional prefix such as "fresh". */
export function decoCalcLabel(calc: DecoCalc | null, prefix = ''): string | null {
  if (calc === null) {
    return null;
  }
  const name = calc.kind === 'ndl' ? 'NDL' : 'TTS';
  return `${prefix}${name} ${calc.text}`;
}

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
  units: Units
): ProfileReadout | null {
  const index = nearestSampleIndex(pi, sec);
  if (index < 0) {
    return null;
  }
  const entry = pi.entry[index];
  const fresh = pi.fresh ?? null;

  const pressures: ProfileReadout['pressures'] = [];
  for (let cylinder = 0; cylinder < pi.nrCylinders; cylinder++) {
    const mbar = plotPressureAt(pi, index, cylinder);
    pressures.push({ cylinder, text: mbar > 0 ? formatPressure(mbar, units) : null });
  }

  return {
    sec: entry.sec,
    timeText: formatDuration(entry.sec),
    depthText: formatDepth(entry.depthMm, units),
    temperatureText:
      entry.temperatureMkelvin > 0 ? formatTemperature(entry.temperatureMkelvin, units) : null,
    pressures,
    inDeco: entry.inDeco,
    calcCeilingText: entry.ceilingMm > 0 ? formatDepth(entry.ceilingMm, units) : null,
    dcCeilingText: dcCeilingMm(entry) > 0 ? formatDepth(dcCeilingMm(entry), units) : null,
    ndlText: entry.ndlSec > 0 ? formatDuration(entry.ndlSec) : null,
    ttsText: entry.ttsSec > 0 ? formatDuration(entry.ttsSec) : null,
    decoCalc: decoCalc(entry.inDecoCalc, entry.ndlCalcSec, entry.ttsCalcSec),
    decoFresh: fresh
      ? decoCalc(
          fresh.inDecoCalc[index] ?? false,
          fresh.ndlCalcSec[index] ?? 0,
          fresh.ttsCalcSec[index] ?? 0
        )
      : null,
    gfNowText: entry.currentGf > 0 ? `${Math.round(gfNowPercent(entry))}%` : null,
    gfSurfaceText: entry.surfaceGf > 0 ? `${Math.round(entry.surfaceGf)}%` : null,
  };
}

/** Temperature in the displayed unit, for scaling the temperature series. */
export function temperatureValue(mkelvin: number, units: Units): number {
  return units.temperature === 'F' ? mkelvinToFahrenheit(mkelvin) : mkelvinToCelsius(mkelvin);
}

// --- Readout layout --------------------------------------------------------

/**
 * One field of the scrubber readout. `widest` are the longest strings the field
 * takes anywhere in this dive, so the renderer can reserve that width and the
 * row does not jump about as the values change length; `read` gives the field's
 * text for one sample.
 */
export type ReadoutSlot = {
  key: string;
  widest: string[];
  read: (readout: ProfileReadout) => string;
};

/** Shown in a slot whose quantity has no value at this sample. */
const NO_VALUE = '-';

type Read = (readout: ProfileReadout) => string | null;

/**
 * The readout fields of one dive. A fixed set - a field is in it when the dive
 * has a value for it somewhere - so fields never appear, vanish or reorder
 * while scrubbing. Built once per dive: the widths are measured by formatting
 * every sample with the very readers that fill the field, so they cannot drift
 * from the formatters.
 */
export function readoutLayout(
  pi: PlotInfo,
  units: Units,
  options: Partial<ProfileSeries> = {}
): ReadoutSlot[] {
  const samples = pi.entry.flatMap((entry) => readoutAt(pi, entry.sec, units) ?? []);

  // A slot with several readers (NDL or ceiling) shows the first that has a
  // value, and reserves the width of the longest of each kind.
  const slot = (key: string, ...reads: Read[]): ReadoutSlot => ({
    key,
    widest: reads
      .map((read) =>
        samples.reduce<string>((longest, sample) => {
          const text = read(sample);
          return text !== null && text.length > longest.length ? text : longest;
        }, '')
      )
      .filter((text) => text.length > 0),
    read: (readout) => reads.map((read) => read(readout)).find((text) => text !== null) ?? NO_VALUE,
  });

  const optional = [
    slot('temperature', (r) => r.temperatureText),
    ...Array.from({ length: pi.nrCylinders }, (_, cylinder) =>
      slot(`pressure-${cylinder}`, (r) => r.pressures[cylinder]?.text ?? null)
    ),
    options.showGfNow ? slot('gf-now', (r) => (r.gfNowText ? `GF ${r.gfNowText}` : null)) : null,
    options.showGfSurface
      ? slot('gf-surface', (r) => (r.gfSurfaceText ? `sGF ${r.gfSurfaceText}` : null))
      : null,
    // The two ceilings are named apart, as the legend names their curves: the
    // computer's reading against the core's calculation can differ by metres.
    // The computer's NDL and TTS share its slot, since they never coincide
    // with its ceiling; they are marked DC against Subsurface's own below.
    slot(
      'deco',
      ...(options.showDcCeiling
        ? [(r: ProfileReadout) => (r.dcCeilingText ? `DC ceiling ${r.dcCeilingText}` : null)]
        : []),
      (r) => (!r.inDeco && r.ndlText ? `DC NDL ${r.ndlText}` : null),
      (r) => (r.ttsText ? `DC TTS ${r.ttsText}` : null)
    ),
    options.showCalcCeiling
      ? slot('calc-ceiling', (r) => (r.calcCeilingText ? `Calc ceiling ${r.calcCeilingText}` : null))
      : null,
    // Subsurface's own NDL or TTS, with the earlier dives' nitrogen...
    slot('deco-calc', (r) => decoCalcLabel(r.decoCalc)),
    // ...and as if the diver had started with clean tissues.
    slot('deco-fresh', (r) => decoCalcLabel(r.decoFresh, 'fresh ')),
  ].filter((candidate): candidate is ReadoutSlot => candidate !== null);

  return [
    slot('time', (r) => r.timeText),
    slot('depth', (r) => r.depthText),
    ...optional.filter((candidate) => candidate.widest.length > 0),
  ];
}

// --- Band axes -------------------------------------------------------------

/**
 * One label on the axis of a banded series. `position` is where it sits in the
 * band: 0 at the bottom edge, 1 at the top - the renderer owns the pixels.
 */
export type BandLabel = { position: number; label: string };

/**
 * The extremes of a banded series, since that is exactly what the band spans:
 * the series is stretched from its minimum (bottom) to its maximum (top).
 * A flat series is drawn along the bottom edge, so it gets one label there.
 * Values are unit-less like the depth axis; the legend names the unit.
 */
function bandLabels(min: number, max: number): BandLabel[] {
  // A narrow range would print the same integer twice, so it keeps a decimal.
  const digits = max - min < 2 ? 1 : 0;
  const bottom = min.toFixed(digits);
  const top = max.toFixed(digits);
  return bottom === top
    ? [{ position: 0, label: bottom }]
    : [
        { position: 0, label: bottom },
        { position: 1, label: top },
      ];
}

/** Axis labels for the temperature band, or none when the dive has no temperature. */
export function temperatureAxis(plot: ProfilePlot, units: Units): BandLabel[] {
  if (plot.temperature.length < 2) {
    return [];
  }
  return bandLabels(
    temperatureValue(plot.temperatureRange.min, units),
    temperatureValue(plot.temperatureRange.max, units)
  );
}

/** Axis labels for the tank pressure band, or none when no cylinder has readings. */
export function pressureAxis(plot: ProfilePlot, units: Units): BandLabel[] {
  if (plot.pressures.length === 0) {
    return [];
  }
  const displayed = (mbar: number) =>
    Math.round(units.pressure === 'psi' ? mbarToPsi(mbar) : mbarToBar(mbar));
  return bandLabels(displayed(plot.pressureRange.min), displayed(plot.pressureRange.max));
}

// --- Accessibility ---------------------------------------------------------

/**
 * What VoiceOver reads for the diagram. A curve is unreadable to a screen
 * reader and scrubbing it needs a pointer, so the shape is described instead:
 * how deep, how long, when the deepest point was, what the water did, and
 * whether the dive went into deco.
 */
export function profileSummary(
  plot: ProfilePlot,
  units: Units,
  // A curve that is drawn but never spoken does not exist to VoiceOver, so the
  // shown series decide what the summary mentions. Their peak is the number
  // that matters: it is the worst the dive got.
  gf: Partial<ProfileSeries> = {}
): string {
  if (plot.depth.length === 0) {
    return 'Dive profile. This dive has no profile samples.';
  }

  const deepest = plot.depth.reduce((best, point) => (point.value > best.value ? point : best));
  const parts = [
    `maximum depth ${formatDepth(plot.maxDepthMm, units)} at ${formatDuration(deepest.sec)}`,
    `total time ${formatDuration(plot.maxSec)}`,
  ];

  if (plot.temperature.length > 0) {
    const { min, max } = plot.temperatureRange;
    parts.push(
      min === max
        ? `water temperature ${formatTemperature(min, units)}`
        : `water temperature ${formatTemperature(min, units)} to ${formatTemperature(max, units)}`
    );
  }
  if (plot.pressures.length > 0) {
    parts.push(
      `tank pressure from ${formatPressure(plot.pressureRange.max, units)} to ${formatPressure(
        plot.pressureRange.min,
        units
      )}`
    );
  }
  if (plot.surfaceIntervalSec !== null) {
    parts.push(
      `starts with nitrogen from a dive ${formatDuration(plot.surfaceIntervalSec)} earlier`
    );
  }
  parts.push(
    plot.ceiling.length > 0 || plot.dcCeiling.length > 0
      ? 'the dive went into decompression'
      : 'no decompression obligation'
  );
  if (gf.showDcCeiling && plot.dcCeiling.length > 0) {
    const deepest = Math.max(...plot.dcCeiling.map((point) => point.value));
    parts.push(`deepest dive computer ceiling ${formatDepth(deepest, units)}`);
  }
  if (gf.showCalcCeiling && plot.ceiling.length > 0) {
    const deepest = Math.max(...plot.ceiling.map((point) => point.value));
    parts.push(`deepest calculated ceiling ${formatDepth(deepest, units)}`);
  }
  if (gf.showGfNow && plot.gfNow.length > 0) {
    const peak = Math.max(...plot.gfNow.map((point) => point.value));
    parts.push(`highest gradient factor at depth ${Math.round(peak)} percent`);
  }
  if (gf.showGfSurface && plot.gfSurface.length > 0) {
    const peak = Math.max(...plot.gfSurface.map((point) => point.value));
    parts.push(`highest surface gradient factor ${Math.round(peak)} percent`);
  }
  if (plot.events.length > 0) {
    parts.push(`${plot.events.length} ${plot.events.length === 1 ? 'event' : 'events'}`);
  }

  return `Dive profile. ${parts.join(', ')}.`;
}
