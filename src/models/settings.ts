// AI-generated (Claude)
// Preference shape and its (de)serialization.
//
// Kept apart from the query in src/queries/settings.ts so it stays free of
// expo-file-system and can be tested in Node.

import { parseRememberedComputers, type RememberedComputer } from './dive-computer';
import {
  DEFAULT_PLANNER_SETTINGS,
  parsePlannerSettings,
  type PlannerSettings,
} from './planner-settings';
import { parseStatsConfig } from './stats-chart';
import type { StatsChartConfig } from './index';
import { METRIC_UNITS, parseUnits, unitPreset, unitsForSystem, type Units } from './units';

export type Settings = {
  /**
   * One unit per quantity. Metric and imperial are presets of these; anything
   * else is what the legacy app calls "personalized".
   */
  units: Units;
  /** Buehlmann gradient factor low, in percent. */
  gfLow: number;
  /** Buehlmann gradient factor high, in percent. */
  gfHigh: number;
  /** Draw the leading tissue's gradient factor at depth on the profile. */
  showGfNow: boolean;
  /** Draw the gradient factor the diver would surface with on the profile. */
  showGfSurface: boolean;
  /** The dive computers downloaded from lately, latest first. */
  diveComputers: RememberedComputer[];
  /** Set the dive computer's clock after a download. */
  syncDiveComputerTime: boolean;
  /** What the dive planner's settings screen holds. */
  planner: PlannerSettings;
  /** The last chart of the configurable statistics. Null until there has been one. */
  statsChart: StatsChartConfig | null;
  /**
   * The cylinder type new dives start with, by its name in the core's tank table,
   * or "" for none - the core's `default_cylinder` (core/pref.h).
   */
  defaultCylinder: string;
};

export const DEFAULT_SETTINGS: Settings = {
  units: METRIC_UNITS,
  // The core's own defaults (subsurface/core/pref.cpp, default_prefs).
  gfLow: 30,
  gfHigh: 75,
  // Off: the profile is busy enough, and both are for divers who went looking
  // for them. Neither costs a recomputation, only a curve.
  showGfNow: false,
  showGfSurface: false,
  diveComputers: [],
  // Off, as in the legacy app: this changes something on the dive computer.
  syncDiveComputerTime: false,
  planner: DEFAULT_PLANNER_SETTINGS,
  statsChart: null,
  // None, as in the core's default_prefs: a guessed tank would change the SAC.
  defaultCylinder: '',
};

/**
 * Allowed range for either gradient factor, in percent. Matches what the
 * bindings clamp to (modules/ssrf-core/cpp/bindings/api.cpp); keeping the UI
 * inside it means the value shown is the value the profile was plotted with.
 */
export const GF_RANGE = { min: 10, max: 150 } as const;

function clampGf(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(GF_RANGE.max, Math.max(GF_RANGE.min, Math.round(value)));
}

/**
 * Puts a pair of gradient factors into range and in order. A gf low above gf
 * high has no meaning for the model, so the low one wins and high is raised to
 * it - the same rule the bindings apply, so the two cannot disagree.
 */
export function clampGradientFactors(
  gfLow: number,
  gfHigh: number,
): Pick<Settings, 'gfLow' | 'gfHigh'> {
  const low = clampGf(gfLow, DEFAULT_SETTINGS.gfLow);
  const high = clampGf(gfHigh, DEFAULT_SETTINGS.gfHigh);
  return { gfLow: low, gfHigh: Math.max(low, high) };
}

/**
 * A boolean preference out of a parsed file. Anything that is not a boolean -
 * missing, a string, a number a hand-edit left behind - is the default, never a
 * truthiness test.
 */
function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

type RawSettings = Partial<Omit<Settings, 'units'>> & { units?: unknown; unitSystem?: unknown };

/**
 * Files written before units could be chosen one by one hold only
 * `unitSystem`. That becomes its preset, and any per-quantity entry a later
 * file has wins over it.
 */
function readUnits(raw: RawSettings | null): Units {
  const preset = unitsForSystem(raw?.unitSystem === 'imperial' ? 'imperial' : 'metric');
  return parseUnits(raw?.units, preset);
}

function legacyUnitSystem(units: Units): 'metric' | 'imperial' {
  const preset = unitPreset(units);
  if (preset !== 'personalized') {
    return preset;
  }
  return units.depth === 'ft' ? 'imperial' : 'metric';
}

/**
 * Reads a settings file. Anything unrecognised, missing or malformed falls back
 * to the default, so an older or hand-edited file never blocks startup.
 */
export function parseSettings(json: string): Settings {
  try {
    const raw = JSON.parse(json) as RawSettings | null;
    return {
      units: readUnits(raw),
      ...clampGradientFactors(
        typeof raw?.gfLow === 'number' ? raw.gfLow : DEFAULT_SETTINGS.gfLow,
        typeof raw?.gfHigh === 'number' ? raw.gfHigh : DEFAULT_SETTINGS.gfHigh,
      ),
      showGfNow: flag(raw?.showGfNow, DEFAULT_SETTINGS.showGfNow),
      showGfSurface: flag(raw?.showGfSurface, DEFAULT_SETTINGS.showGfSurface),
      diveComputers: parseRememberedComputers(raw?.diveComputers),
      syncDiveComputerTime: flag(raw?.syncDiveComputerTime, DEFAULT_SETTINGS.syncDiveComputerTime),
      planner: parsePlannerSettings(raw?.planner),
      statsChart: parseStatsConfig(raw?.statsChart),
      defaultCylinder: typeof raw?.defaultCylinder === 'string' ? raw.defaultCylinder.trim() : '',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({
    units: settings.units,
    // Still written, for an older build reading this file: it knew only the two
    // presets, and a personalized choice reads best as the system of its depth.
    unitSystem: legacyUnitSystem(settings.units),
    gfLow: settings.gfLow,
    gfHigh: settings.gfHigh,
    showGfNow: settings.showGfNow,
    showGfSurface: settings.showGfSurface,
    diveComputers: settings.diveComputers,
    syncDiveComputerTime: settings.syncDiveComputerTime,
    planner: settings.planner,
    statsChart: settings.statsChart,
    defaultCylinder: settings.defaultCylinder,
  });
}

/** Footers of the Settings sections the three platforms share, so they say the same. */
export const SETTINGS_FOOTERS = {
  newDives:
    'Dives you add start with this cylinder, and so do cylinders added in the editor and the planner. ' +
    'A dive downloaded from a computer that does not report its tank size takes it too. ' +
    'It starts full at its working pressure; set the end pressure on the dive.',
} as const;
