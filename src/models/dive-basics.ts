// AI-generated (Claude)
// When a dive was, how long and how deep: the part of the dive form a manually added
// dive is made of, and the part of the editor that can correct it.
//
// Pure functions only. Fields are text, as in cylinder-edit.ts, and for the same
// reasons: a half-typed number has to survive, and a field shows a rendering of the
// value, so a save compares text with text and an untouched field stays untouched by
// construction. 24.38 m shows as "24.4", and re-parsing that would quietly move the dive.
//
// Which fields a dive may change is legacy's rule (mobile-widgets/qmlmanager.cpp):
// date, temperatures and number on any dive, depth and duration only on a manually
// added one, since elsewhere they come from the samples. The bindings refuse the rest.

import { parseNumberInput } from './cylinder-edit';
import type { Dive, DivePatch, DiveSummary, NewDiveInput, Trip } from './index';
import {
  celsiusToMkelvin,
  feetToMm,
  metersToMm,
  mkelvinToCelsius,
  mkelvinToFahrenheit,
  mmToFeet,
  mmToMeters,
  type UnitSystem,
} from './units';

/** `manual_dc_name` in core/divecomputer.cpp, which is how the core recognizes one. */
export const MANUAL_DC_MODEL = 'manually added dive';

export function isManualDive(dive: Pick<DiveSummary, 'dcModel'>): boolean {
  return dive.dcModel === MANUAL_DC_MODEL;
}

// The bindings' limits (api.cpp), said here first so that they can be said in words.
export const MIN_DEPTH_MM = 1000;
export const MAX_DEPTH_MM = 500000;
export const MAX_DURATION_SEC = 24 * 3600;
const MIN_WATER_TEMP_MKELVIN = celsiusToMkelvin(-5);
const MAX_WATER_TEMP_MKELVIN = celsiusToMkelvin(50);
const MIN_AIR_TEMP_MKELVIN = celsiusToMkelvin(-70);
const MAX_AIR_TEMP_MKELVIN = celsiusToMkelvin(70);
/** The core's date parser gives 0 for any year past 2029 (`utc_mktime`). */
export const MAX_WHEN = 1893456000;
/** A day ahead, since a diver's phone can be on a different time from the dive's. */
const FUTURE_SLACK_SEC = 24 * 3600;

// --- Local time --------------------------------------------------------------

/**
 * Now, as the core would store it: dive times are wall-clock time written as if it
 * were UTC. To the minute, as nobody logs the seconds of a start.
 */
export function localNowWhen(nowMs: number, tzOffsetMin: number): number {
  return Math.floor((nowMs / 1000 - tzOffsetMin * 60) / 60) * 60;
}

// --- Duration ----------------------------------------------------------------

/**
 * What a diver types for a duration, as legacy's `checkDuration` takes it: "45" is
 * minutes, "1:05" is an hour and five minutes, "1:05:30" has seconds, and "45 min",
 * "1 h 5 min" and "1h" say so. Undefined for empty, null for anything else.
 */
export function parseDurationInput(text: string): number | null | undefined {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '') {
    return undefined;
  }
  let match = /^(\d+)$/.exec(trimmed) ?? /^(\d+)\s*min$/.exec(trimmed);
  if (match) {
    return Number(match[1]) * 60;
  }
  match = /^(\d+):(\d{2})(?::(\d{1,2}))?$/.exec(trimmed);
  if (match) {
    const [minutes, seconds] = [Number(match[2]), Number(match[3] ?? 0)];
    return minutes < 60 && seconds < 60 ? Number(match[1]) * 3600 + minutes * 60 + seconds : null;
  }
  match = /^(\d+)\s*h(?:\s*(\d+)\s*min)?$/.exec(trimmed);
  if (match) {
    return Number(match[1]) * 3600 + Number(match[2] ?? 0) * 60;
  }
  return null;
}

/** Minutes, as most dives are; h:mm:ss when there are seconds to keep. */
export function formatDurationInput(seconds: number): string {
  if (seconds <= 0) {
    return '';
  }
  if (seconds % 60 === 0) {
    return String(seconds / 60);
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  return `${hours}:${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

// --- Depth and temperature ---------------------------------------------------

export function depthUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'ft' : 'm';
}

export function temperatureUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'F' : 'C';
}

function trimmed(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

export function formatDepthInput(mm: number, system: UnitSystem): string {
  if (mm <= 0) {
    return '';
  }
  return system === 'imperial' ? trimmed(mmToFeet(mm), 0) : trimmed(mmToMeters(mm), 1);
}

export function parseDepthInput(text: string, system: UnitSystem): number | null | undefined {
  const value = parseNumberInput(text);
  if (value === null || value === undefined) {
    return value;
  }
  return system === 'imperial' ? feetToMm(value) : metersToMm(value);
}

export function formatTemperatureInput(mkelvin: number, system: UnitSystem): string {
  if (mkelvin <= 0) {
    return '';
  }
  return trimmed(
    system === 'imperial' ? mkelvinToFahrenheit(mkelvin) : mkelvinToCelsius(mkelvin),
    1,
  );
}

/** Unlike the other fields a temperature can be below zero. */
export function parseTemperatureInput(text: string, system: UnitSystem): number | null | undefined {
  const raw = text.trim().replace(',', '.').replace(/^−/, '-');
  if (raw === '') {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  return celsiusToMkelvin(system === 'imperial' ? ((value - 32) * 5) / 9 : value);
}

// --- The draft ---------------------------------------------------------------

export type DiveBasicsDraft = {
  when: number;
  durationText: string;
  maxDepthText: string;
  meanDepthText: string;
  airTempText: string;
  waterTempText: string;
  numberText: string;
};

export function diveBasicsDraftFrom(dive: Dive, system: UnitSystem): DiveBasicsDraft {
  return {
    when: dive.when,
    durationText: formatDurationInput(dive.durationSec),
    maxDepthText: formatDepthInput(dive.maxDepthMm, system),
    meanDepthText: formatDepthInput(dive.meanDepthMm, system),
    airTempText: formatTemperatureInput(dive.airTempMkelvin, system),
    waterTempText: formatTemperatureInput(dive.waterTempMkelvin, system),
    numberText: dive.number > 0 ? String(dive.number) : '',
  };
}

export function newDiveBasicsDraft(when: number): DiveBasicsDraft {
  return {
    when,
    durationText: '',
    maxDepthText: '',
    meanDepthText: '',
    airTempText: '',
    waterTempText: '',
    numberText: '',
  };
}

export type DiveBasicsErrors = Partial<Record<keyof DiveBasicsDraft, string>>;

export type DiveBasicsRules = {
  /** Depth and duration are the diver's to set: required, and checked. */
  profileEditable: boolean;
  /** A plan is dated ahead on purpose. */
  allowFuture: boolean;
  /** `localNowWhen`. */
  now: number;
  /** The draft as it opened: what was there already is not the diver's mistake. */
  seed?: DiveBasicsDraft;
};

function temperatureError(
  text: string,
  system: UnitSystem,
  min: number,
  max: number,
): string | undefined {
  const mkelvin = parseTemperatureInput(text, system);
  if (mkelvin === undefined) {
    return undefined;
  }
  if (mkelvin === null) {
    return 'Enter a temperature, such as 18.';
  }
  return mkelvin < min || mkelvin > max
    ? `Enter a temperature from ${formatTemperatureInput(min, system)} to ${formatTemperatureInput(max, system)} ${temperatureUnit(system)}.`
    : undefined;
}

/** What is wrong, per field. Empty when the draft can be saved. */
export function validateDiveBasics(
  draft: DiveBasicsDraft,
  system: UnitSystem,
  rules: DiveBasicsRules,
): DiveBasicsErrors {
  const errors: DiveBasicsErrors = {};
  const { seed } = rules;

  if (draft.when !== seed?.when) {
    if (draft.when >= MAX_WHEN) {
      errors.when = 'The logbook cannot hold a date after 2029.';
    } else if (draft.when <= 0) {
      errors.when = 'The logbook cannot hold a date before 1970.';
    } else if (!rules.allowFuture && draft.when > rules.now + FUTURE_SLACK_SEC) {
      errors.when = 'This date is in the future.';
    }
  }

  if (rules.profileEditable) {
    const seconds = parseDurationInput(draft.durationText);
    if (seconds === undefined) {
      errors.durationText = 'Enter how long the dive lasted.';
    } else if (seconds === null) {
      errors.durationText = 'Enter minutes, such as 45, or hours and minutes, such as 1:05.';
    } else if (seconds < 1) {
      errors.durationText = 'A dive lasts longer than that.';
    } else if (seconds > MAX_DURATION_SEC) {
      errors.durationText = 'A dive cannot last more than 24 hours.';
    }

    const depth = parseDepthInput(draft.maxDepthText, system);
    const range = `from ${formatDepthInput(MIN_DEPTH_MM, system)} to ${formatDepthInput(MAX_DEPTH_MM, system)} ${depthUnit(system)}`;
    if (depth === undefined) {
      errors.maxDepthText = 'Enter how deep the dive went.';
    } else if (depth === null) {
      errors.maxDepthText = `Enter a depth ${range}.`;
    } else if (depth < MIN_DEPTH_MM || depth > MAX_DEPTH_MM) {
      errors.maxDepthText = `Enter a depth ${range}.`;
    }

    const mean = parseDepthInput(draft.meanDepthText, system);
    if (mean === null) {
      errors.meanDepthText = 'Enter a depth, or leave this empty.';
    } else if (
      typeof mean === 'number' &&
      typeof depth === 'number' &&
      // After a new maximum the old average is the core's to replace (see below).
      draft.meanDepthText !== seed?.meanDepthText
    ) {
      if (mean >= depth) {
        errors.meanDepthText = 'The average has to be less than the maximum depth.';
      } else if (mean < depth / 10) {
        // `fake_dc` would quietly put a figure of its own in place of this one.
        errors.meanDepthText = 'The average has to be at least a tenth of the maximum depth.';
      }
    }
  }

  errors.airTempText = temperatureError(
    draft.airTempText,
    system,
    MIN_AIR_TEMP_MKELVIN,
    MAX_AIR_TEMP_MKELVIN,
  );
  errors.waterTempText = temperatureError(
    draft.waterTempText,
    system,
    MIN_WATER_TEMP_MKELVIN,
    MAX_WATER_TEMP_MKELVIN,
  );
  if (draft.airTempText === seed?.airTempText) {
    delete errors.airTempText;
  }
  if (draft.waterTempText === seed?.waterTempText) {
    delete errors.waterTempText;
  }

  if (!/^\d*$/.test(draft.numberText.trim())) {
    errors.numberText = 'Enter a whole number, or leave this empty for no number.';
  }

  for (const key of Object.keys(errors) as (keyof DiveBasicsDraft)[]) {
    if (errors[key] === undefined) {
      delete errors[key];
    }
  }
  return errors;
}

/**
 * The smallest patch for these fields. A temperature left empty is cleared. A new
 * depth or duration with the average left as it was sends no average, and the core
 * drops it for a new one (`EditDepth`): that average described the old profile.
 */
export function buildDiveBasicsPatch(
  dive: Dive,
  draft: DiveBasicsDraft,
  system: UnitSystem,
): DivePatch {
  const seed = diveBasicsDraftFrom(dive, system);
  const patch: DivePatch = {};

  if (draft.when !== seed.when) {
    patch.when = draft.when;
  }
  if (draft.airTempText.trim() !== seed.airTempText) {
    patch.airTempMkelvin = parseTemperatureInput(draft.airTempText, system) ?? 0;
  }
  if (draft.waterTempText.trim() !== seed.waterTempText) {
    patch.waterTempMkelvin = parseTemperatureInput(draft.waterTempText, system) ?? 0;
  }
  if (draft.numberText.trim() !== seed.numberText) {
    patch.number = Number(draft.numberText.trim() || 0);
  }
  if (isManualDive(dive)) {
    if (draft.durationText.trim() !== seed.durationText) {
      patch.durationSec = parseDurationInput(draft.durationText) ?? 0;
    }
    if (draft.maxDepthText.trim() !== seed.maxDepthText) {
      patch.maxDepthMm = parseDepthInput(draft.maxDepthText, system) ?? 0;
    }
    if (draft.meanDepthText.trim() !== seed.meanDepthText) {
      patch.meanDepthMm = parseDepthInput(draft.meanDepthText, system) ?? 0;
    }
  }
  return patch;
}

/** The figures of a new dive, once `validateDiveBasics` has passed them. */
export function buildNewDiveBasics(draft: DiveBasicsDraft, system: UnitSystem): NewDiveInput {
  const input: NewDiveInput = {
    when: draft.when,
    durationSec: parseDurationInput(draft.durationText) ?? 0,
    maxDepthMm: parseDepthInput(draft.maxDepthText, system) ?? 0,
  };
  const mean = parseDepthInput(draft.meanDepthText, system);
  if (typeof mean === 'number' && mean > 0) {
    input.meanDepthMm = mean;
  }
  const air = parseTemperatureInput(draft.airTempText, system);
  if (typeof air === 'number') {
    input.airTempMkelvin = air;
  }
  const water = parseTemperatureInput(draft.waterTempText, system);
  if (typeof water === 'number') {
    input.waterTempMkelvin = water;
  }
  return input;
}

// --- What a date runs into ---------------------------------------------------

/**
 * The dives the time span overlaps. They are told about rather than refused: two
 * computers on one dive, or a clock that was wrong, are both real.
 */
export function overlappingDives<T extends Pick<DiveSummary, 'id' | 'when' | 'durationSec'>>(
  dives: readonly T[],
  when: number,
  durationSec: number,
  selfId?: number,
): T[] {
  return dives.filter(
    (dive) =>
      dive.id !== selfId && dive.when < when + durationSec && when < dive.when + dive.durationSec,
  );
}

/** The trip whose dates the time falls between, if any. */
export function tripAround(trips: readonly Trip[], when: number): Trip | undefined {
  return trips.find((trip) => trip.when <= when && when <= trip.lastDiveWhen);
}

/**
 * The core numbers a new dive only at the end of the log; before that it has none,
 * rather than renumber what is already there (`get_dive_nr_at_idx`).
 */
export function staysUnnumbered(
  dives: readonly Pick<DiveSummary, 'when'>[],
  when: number,
): boolean {
  return dives.some((dive) => dive.when > when);
}

/** Notes under the date. Warnings only: none of them stops a save. */
export function dateNotes(input: {
  dives: readonly Pick<DiveSummary, 'id' | 'when' | 'durationSec' | 'number' | 'siteName'>[];
  trips: readonly Trip[];
  when: number;
  durationSec: number;
  /** Set when editing: the dive itself, its trip, and whether the date moved. */
  dive?: Pick<DiveSummary, 'id' | 'when' | 'tripId' | 'tripLocation'>;
}): string[] {
  const { dives, trips, when, durationSec, dive } = input;
  if (dive && dive.when === when) {
    return [];
  }
  const notes: string[] = [];
  const [first, ...others] = overlappingDives(dives, when, durationSec, dive?.id);
  if (first) {
    const name = first.number > 0 ? `dive ${first.number}` : first.siteName.trim() || 'another dive';
    notes.push(
      others.length > 0
        ? `This overlaps ${name} and ${others.length} more.`
        : `This overlaps ${name}.`,
    );
  }
  if (dive) {
    if (dive.tripId !== 0) {
      notes.push(`The dive stays in ${dive.tripLocation.trim() || 'its trip'} and keeps its number.`);
    }
    return notes;
  }
  const trip = tripAround(trips, when);
  if (trip) {
    notes.push(
      `This falls within ${trip.location.trim() || 'a trip'}. The dive is not added to it; you can do that from the dive.`,
    );
  }
  if (staysUnnumbered(dives, when)) {
    notes.push('Later dives exist, so this one gets no number. You can set one afterwards.');
  }
  return notes;
}
