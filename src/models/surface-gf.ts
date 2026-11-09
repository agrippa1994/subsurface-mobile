// AI-generated (Claude)
// The live surface gradient factor: how desaturated the diver is now, how that
// goes on, and what it will be at a planned next entry.
//
// The numbers come from the core (`surfaceGf` in cpp/bindings/surface-gf.cpp):
// a series of surface GF values, one per step, from the end of a dive. Nothing
// here recomputes tissues. What this file adds is the time axis of the phone
// (the core's times are wall clock written as if UTC), lookups on the series
// ("what at 15:30", "when below 30 %"), the ambient pressure the series is
// computed for, the planned entry, and every text the card and the timeline
// show - so the iOS, Android and fallback screens cannot word it differently.

import type { SurfaceGfSeries } from './index';
import type { DepthUnit } from './units';

// --- Ambient pressure -------------------------------------------------------

/** Where the surface interval's ambient pressure comes from, as the diver picks it. */
export type PressureSource = 'barometer' | 'altitude';

/** What the series was computed with in the end, which may be a fallback. */
export type AmbientSource = 'barometer' | 'altitude' | 'default';

/** Standard atmosphere at sea level, mbar: what the core uses for a dive with no pressure. */
export const SEA_LEVEL_MBAR = 1013;

/** The range the binding accepts (cpp/bindings/surface-gf.cpp). */
export const AMBIENT_RANGE_MBAR = { min: 500, max: 1100 } as const;

/** Altitudes the setting takes: sea level to about 5000 m, where the range above ends. */
export const ALTITUDE_RANGE_MM = { min: 0, max: 5_000_000 } as const;

/**
 * Altitude to air pressure with the core's barometric formula
 * (`altitude_to_pressure` in core/units.h): 1013 mbar at sea level, a scale
 * height of 7800 m. The same as the dive planner's altitude, so the two agree.
 */
export function altitudeToMbar(altitudeMm: number): number {
  // int_cast is lrint: round to nearest.
  return Math.round(SEA_LEVEL_MBAR * Math.exp(-altitudeMm / 7_800_000));
}

/** The inverse, `pressure_to_altitude` in core/units.cpp. */
export function mbarToAltitudeMm(mbar: number): number {
  return Math.trunc(Math.log(SEA_LEVEL_MBAR / mbar) * 7_800_000);
}

export function isPlausibleAmbient(mbar: number | null | undefined): mbar is number {
  return (
    typeof mbar === 'number' &&
    Number.isFinite(mbar) &&
    mbar >= AMBIENT_RANGE_MBAR.min &&
    mbar <= AMBIENT_RANGE_MBAR.max
  );
}

export type Ambient = {
  mbar: number;
  source: AmbientSource;
  /** One line saying where the pressure comes from, e.g. "Phone barometer, 1008 mbar". */
  label: string;
  /** Set when the chosen source could not be used. */
  fallbackNote: string | null;
};

export type BarometerState =
  /** Still asking the sensor. */
  | { kind: 'pending' }
  | { kind: 'unavailable' }
  | { kind: 'reading'; mbar: number };

/**
 * The ambient pressure the surface interval is computed for. In order: the
 * phone's barometer when chosen and reading, the altitude setting, 1013 mbar.
 */
export function resolveAmbient(
  source: PressureSource,
  altitudeMm: number,
  barometer: BarometerState,
): Ambient {
  if (source === 'barometer' && barometer.kind === 'reading' && isPlausibleAmbient(barometer.mbar)) {
    const mbar = Math.round(barometer.mbar);
    return { mbar, source: 'barometer', label: `Phone barometer, ${mbar} mbar`, fallbackNote: null };
  }
  let fallbackNote: string | null = null;
  if (source === 'barometer') {
    fallbackNote =
      barometer.kind === 'pending'
        ? 'Waiting for the barometer.'
        : barometer.kind === 'unavailable'
          ? 'This phone has no barometer.'
          : 'The barometer reading is out of range.';
  }
  if (altitudeMm > 0) {
    const mbar = clampAmbient(altitudeToMbar(altitudeMm));
    return { mbar, source: 'altitude', label: `Altitude setting, ${mbar} mbar`, fallbackNote };
  }
  return {
    mbar: SEA_LEVEL_MBAR,
    source: 'default',
    label: `Sea level, ${SEA_LEVEL_MBAR} mbar`,
    fallbackNote,
  };
}

function clampAmbient(mbar: number): number {
  return Math.min(AMBIENT_RANGE_MBAR.max, Math.max(AMBIENT_RANGE_MBAR.min, Math.round(mbar)));
}

/** Altitude for display in the diver's depth unit, rounded the way a map shows it. */
export function formatAltitude(altitudeMm: number, unit: DepthUnit): string {
  if (unit === 'ft') {
    return `${Math.round(altitudeMm / 304.8 / 10) * 10} ft`;
  }
  return `${Math.round(altitudeMm / 1000 / 10) * 10} m`;
}

/** The altitude setting from what the diver typed, in the depth unit. Null when not a number. */
export function parseAltitude(text: string, unit: DepthUnit): number | null {
  const value = Number(text.replace(',', '.').trim());
  if (text.trim() === '' || !Number.isFinite(value)) {
    return null;
  }
  const mm = unit === 'ft' ? value * 304.8 : value * 1000;
  return Math.round(Math.min(ALTITUDE_RANGE_MM.max, Math.max(ALTITUDE_RANGE_MM.min, mm)));
}

/** The step a stepper moves the altitude by: 100 m or 250 ft (in mm). */
export function altitudeStepMm(unit: DepthUnit): number {
  return unit === 'ft' ? 76_200 : 100_000;
}

// --- Preferences ------------------------------------------------------------

export type SurfaceGfSettings = {
  pressureSource: PressureSource;
  /** Altitude above sea level of where the diver is, mm. 0 is sea level. */
  altitudeMm: number;
  /**
   * When the diver plans to be in the water next, ms since the epoch. A
   * preference rather than dive data: it lives in settings.json, not the log.
   */
  plannedEntryMs: number | null;
};

export const DEFAULT_SURFACE_GF_SETTINGS: SurfaceGfSettings = {
  // The barometer when there is one: it knows the altitude and the weather.
  pressureSource: 'barometer',
  altitudeMm: 0,
  plannedEntryMs: null,
};

export function parseSurfaceGfSettings(raw: unknown): SurfaceGfSettings {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SURFACE_GF_SETTINGS;
  }
  const value = raw as Record<string, unknown>;
  const altitude = typeof value.altitudeMm === 'number' && Number.isFinite(value.altitudeMm)
    ? Math.round(Math.min(ALTITUDE_RANGE_MM.max, Math.max(ALTITUDE_RANGE_MM.min, value.altitudeMm)))
    : DEFAULT_SURFACE_GF_SETTINGS.altitudeMm;
  const planned = value.plannedEntryMs;
  return {
    pressureSource: value.pressureSource === 'altitude' ? 'altitude' : 'barometer',
    altitudeMm: altitude,
    plannedEntryMs: typeof planned === 'number' && Number.isFinite(planned) ? planned : null,
  };
}

// --- The series on the phone's clock ----------------------------------------

export type SurfaceGfTimeline = {
  diveId: number;
  diveNumber: number;
  /** Start of the series, the instant of the profile's last point. */
  startMs: number;
  stepMs: number;
  /** Surface GF in percent, one value per step from startMs. */
  values: readonly number[];
  /** Last instant the series covers. */
  endMs: number;
  /** When surface GF reaches 0 %, null when past the series. */
  gfZeroMs: number | null;
  /** When the tissues are clean (see cpp/API.md), null when past the series. */
  cleanMs: number | null;
  /** The value of the profile's last point. */
  endSurfaceGf: number;
  ambientMbar: number;
  /** Earlier dives left nitrogen in the tissues this dive started with. */
  residual: boolean;
};

/**
 * Puts the core's series on the phone's clock. The core keeps the wall clock of
 * the dive as if it were UTC and no time zone, so this assumes the dive was in
 * the phone's current zone (as the surface interval widget does) - true for the
 * dive that matters, the one just done.
 */
export function toTimeline(series: SurfaceGfSeries, timezoneOffsetMinutes: number): SurfaceGfTimeline {
  const startMs = series.startWhen * 1000 + timezoneOffsetMinutes * 60_000;
  const stepMs = series.stepSec * 1000;
  const at = (sec: number | null) => (sec === null ? null : startMs + sec * 1000);
  return {
    diveId: series.diveId,
    diveNumber: series.diveNumber,
    startMs,
    stepMs,
    values: series.surfaceGf,
    endMs: startMs + Math.max(0, series.surfaceGf.length - 1) * stepMs,
    gfZeroMs: at(series.gfZeroSec),
    cleanMs: at(series.cleanSec),
    endSurfaceGf: series.endSurfaceGf,
    ambientMbar: series.ambientMbar,
    residual: series.residualFromSec !== null,
  };
}

/**
 * Surface GF at an instant, interpolated between steps. Null before the series
 * starts (still diving); past its end the last value, which is 0 % once it
 * reached clean.
 */
export function gfAt(timeline: SurfaceGfTimeline, ms: number): number | null {
  const { values, startMs, stepMs } = timeline;
  if (values.length === 0 || ms < startMs) {
    return null;
  }
  const position = (ms - startMs) / stepMs;
  const index = Math.floor(position);
  if (index >= values.length - 1) {
    return values[values.length - 1];
  }
  const fraction = position - index;
  return values[index] + (values[index + 1] - values[index]) * fraction;
}

/**
 * The first instant at or after `fromMs` when surface GF is at or below
 * `threshold` percent, interpolated between steps. Null when the series never
 * gets there.
 */
export function timeBelow(timeline: SurfaceGfTimeline, threshold: number, fromMs: number): number | null {
  const { values, startMs, stepMs } = timeline;
  if (values.length === 0) {
    return null;
  }
  const from = Math.max(fromMs, startMs);
  const current = gfAt(timeline, from);
  if (current !== null && current <= threshold) {
    return from;
  }
  const first = Math.max(1, Math.ceil((from - startMs) / stepMs));
  for (let i = first; i < values.length; i++) {
    if (values[i] <= threshold) {
      const before = values[i - 1];
      const after = values[i];
      const fraction = before === after ? 1 : (before - threshold) / (before - after);
      return Math.max(from, startMs + (i - 1 + fraction) * stepMs);
    }
  }
  return null;
}

/** What the diver is in at an instant: the stages the card and the timeline name. */
export type SurfaceGfPhase =
  /** Before the series starts: the dive was not over yet. */
  | 'diving'
  /** Some compartment is above ambient pressure. */
  | 'supersaturated'
  /** No compartment above ambient, but nitrogen is still carried over. */
  | 'residual'
  | 'clean';

export function phaseAt(timeline: SurfaceGfTimeline, ms: number): SurfaceGfPhase {
  if (ms < timeline.startMs) {
    return 'diving';
  }
  if (timeline.cleanMs !== null && ms >= timeline.cleanMs) {
    return 'clean';
  }
  if (timeline.cleanMs === null && ms > timeline.endMs) {
    // The series ran out before clean (an explicit horizon): say residual, never clean.
    return 'residual';
  }
  const gf = gfAt(timeline, ms) ?? 0;
  return gf > 0 ? 'supersaturated' : 'residual';
}

/**
 * Points for a sparkline, `count` of them evenly over [fromMs, toMs], each
 * `{ x: 0..1, y: percent }`.
 */
export function samplePoints(
  timeline: SurfaceGfTimeline,
  fromMs: number,
  toMs: number,
  count: number,
): { x: number; y: number; ms: number }[] {
  if (toMs <= fromMs || count < 2) {
    return [];
  }
  const points: { x: number; y: number; ms: number }[] = [];
  for (let i = 0; i < count; i++) {
    const ms = fromMs + ((toMs - fromMs) * i) / (count - 1);
    const y = gfAt(timeline, ms);
    if (y !== null) {
      points.push({ x: i / (count - 1), y, ms });
    }
  }
  return points;
}

/**
 * The span the card's sparkline covers: the end of the dive to a bit after GF
 * 0 % - the part with a shape. The flat tail to "clean" is days of nothing.
 */
export function sparklineSpan(timeline: SurfaceGfTimeline): { fromMs: number; toMs: number } {
  const zero = timeline.gfZeroMs ?? timeline.endMs;
  const toMs = Math.min(timeline.endMs, zero + Math.max(30 * 60_000, (zero - timeline.startMs) * 0.15));
  return { fromMs: timeline.startMs, toMs: Math.max(toMs, timeline.startMs + 60 * 60_000) };
}

// --- Planned entry ----------------------------------------------------------

/** The quick presets, minutes from now. */
export const PLANNED_ENTRY_PRESETS = [
  { label: '+30 min', minutes: 30 },
  { label: '+1 h', minutes: 60 },
  { label: '+2 h', minutes: 120 },
  { label: '+3 h', minutes: 180 },
] as const;

/** `minutes` from now, rounded up to the next five minutes as dive briefings are. */
export function plannedFromPreset(nowMs: number, minutes: number): number {
  const five = 5 * 60_000;
  return Math.ceil((nowMs + minutes * 60_000) / five) * five;
}

export type PlannedEntry = {
  atMs: number;
  /** Null when the planned time is before the dive ended. */
  gf: number | null;
  /** The planned time is already over. */
  past: boolean;
  /** "In 1 h 20 min at 15:30" or "Was at 15:30". */
  whenText: string;
  /** "Surface GF 18 %" or a line why there is none. */
  gfText: string;
  /** Spoken version of the two. */
  accessibilityLabel: string;
};

export function plannedEntry(
  timeline: SurfaceGfTimeline,
  atMs: number,
  nowMs: number,
): PlannedEntry {
  const gf = gfAt(timeline, atMs);
  const past = atMs < nowMs;
  const clock = formatClock(atMs, nowMs);
  const whenText = past ? `Was ${clock}` : `In ${formatDuration(atMs - nowMs)}, ${clock}`;
  const gfText = gf === null ? 'Before this dive ended' : `Surface GF ${formatGf(gf)}`;
  return {
    atMs,
    gf,
    past,
    whenText,
    gfText,
    accessibilityLabel: `Planned entry ${whenText}. ${gfText}.`,
  };
}

// --- Texts ------------------------------------------------------------------

/** A surface GF in percent, as the readouts show it: whole percent. */
export function formatGf(gf: number): string {
  return `${Math.max(0, Math.round(gf))} %`;
}

/** "45 min", "2 h 05 min", "1 d 3 h". Never negative. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  }
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * The phone's local time of day, 24 h, with the day when it is not today:
 * "15:30", "tomorrow 09:10", "yesterday 22:05", "12 Mar 14:00".
 */
export function formatClock(ms: number, nowMs: number): string {
  const date = new Date(ms);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const now = new Date(nowMs);
  if (sameDay(date, now)) {
    return time;
  }
  const tomorrow = new Date(nowMs);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(date, tomorrow)) {
    return `tomorrow ${time}`;
  }
  const yesterday = new Date(nowMs);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) {
    return `yesterday ${time}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${months[date.getMonth()]}${year} ${time}`;
}

/** Said once wherever the value is shown. */
export const SURFACE_GF_DISCLAIMER =
  'Surface GF is a Buehlmann model value from your logged profile, not a measurement and not medical advice.';

/** Why one pressure for the whole interval: v1 has no pressure history. */
export const SINGLE_PRESSURE_NOTE =
  'One ambient pressure is applied to the whole surface interval. A drive to altitude part way through is not modelled.';

export const SURFACE_GF_EXPLAINER =
  'Surface GF is how close your leading tissue compartment is to its Buehlmann limit at the surface: 0 % means ' +
  'no compartment holds more nitrogen than the surrounding air pressure, 100 % is the limit itself. Clean means ' +
  'every compartment is within 2 % of the nitrogen it holds at rest; the core forgets a dive after 48 hours.';

/** What the card on the dive list shows. Null when there is nothing to show. */
export type SurfaceGfCard = {
  phase: Exclude<SurfaceGfPhase, 'clean' | 'diving'>;
  /** Big readout, "42 %". */
  gfText: string;
  gf: number;
  /** "Surfaced 1 h 12 min ago" */
  sinceText: string;
  /** "0 % in 2 h 40 min" or "Clean in 31 h". */
  untilText: string;
  /** "Clean in 1 d 7 h, at tomorrow 04:10". */
  cleanText: string | null;
  /** Planned entry, when one is set and still ahead. */
  planned: PlannedEntry | null;
  /** The surface GF is above the diver's gf high: the model would have kept them down. */
  aboveGfHigh: boolean;
  sparkline: { x: number; y: number }[];
  /** Where now is on the sparkline, 0..1. */
  nowX: number;
  accessibilityLabel: string;
};

export function surfaceGfCard(
  timeline: SurfaceGfTimeline,
  nowMs: number,
  options: { gfHigh: number; plannedEntryMs: number | null },
): SurfaceGfCard | null {
  const phase = phaseAt(timeline, nowMs);
  if (phase === 'clean' || phase === 'diving') {
    return null;
  }
  const gf = gfAt(timeline, nowMs) ?? 0;
  const sinceText = `Surfaced ${formatDuration(nowMs - timeline.startMs)} ago`;
  const cleanText =
    timeline.cleanMs !== null
      ? `Clean in ${formatDuration(timeline.cleanMs - nowMs)}, ${formatClock(timeline.cleanMs, nowMs)}`
      : null;
  let untilText: string;
  if (phase === 'supersaturated') {
    untilText =
      timeline.gfZeroMs !== null
        ? `0 % in ${formatDuration(timeline.gfZeroMs - nowMs)}`
        : 'Above 0 % for the whole series';
  } else {
    untilText =
      timeline.cleanMs !== null
        ? `Residual nitrogen, clean in ${formatDuration(timeline.cleanMs - nowMs)}`
        : 'Residual nitrogen';
  }
  const planned =
    options.plannedEntryMs !== null && options.plannedEntryMs >= nowMs
      ? plannedEntry(timeline, options.plannedEntryMs, nowMs)
      : null;
  const span = sparklineSpan(timeline);
  const sparkline = samplePoints(timeline, span.fromMs, span.toMs, 48).map(({ x, y }) => ({ x, y }));
  const nowX = Math.min(1, Math.max(0, (nowMs - span.fromMs) / (span.toMs - span.fromMs)));
  const parts = [`Surface GF ${formatGf(gf)}`, untilText, sinceText];
  if (planned) {
    parts.push(planned.accessibilityLabel);
  }
  return {
    phase,
    gfText: formatGf(gf),
    gf,
    sinceText,
    untilText,
    cleanText,
    planned,
    aboveGfHigh: gf > options.gfHigh,
    sparkline,
    nowX,
    accessibilityLabel: `${parts.join('. ')}.`,
  };
}

/** The thresholds the "when below" picker offers, percent. */
export const BELOW_THRESHOLDS = [50, 30, 20, 10, 0] as const;

/** "Below 30 %: in 1 h 10 min, 15:40" for the "when below X" readout. */
export function belowText(timeline: SurfaceGfTimeline, threshold: number, nowMs: number): string {
  const at = timeBelow(timeline, threshold, nowMs);
  if (at === null) {
    return `Stays above ${threshold} % for the whole series`;
  }
  if (at <= nowMs) {
    return `Already at or below ${threshold} %`;
  }
  return `In ${formatDuration(at - nowMs)}, ${formatClock(at, nowMs)}`;
}
