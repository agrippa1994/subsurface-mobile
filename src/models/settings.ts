// AI-generated (Claude)
// Preference shape and its (de)serialization.
//
// Kept apart from the query in src/queries/settings.ts so it stays free of
// expo-file-system and can be tested in Node.

import type { UnitSystem } from './units';

export type Settings = {
  unitSystem: UnitSystem;
  /** Buehlmann gradient factor low, in percent. */
  gfLow: number;
  /** Buehlmann gradient factor high, in percent. */
  gfHigh: number;
};

export const DEFAULT_SETTINGS: Settings = {
  unitSystem: 'metric',
  // The core's own defaults (subsurface/core/pref.cpp, default_prefs).
  gfLow: 30,
  gfHigh: 75,
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
 * Reads a settings file. Anything unrecognised, missing or malformed falls back
 * to the default, so an older or hand-edited file never blocks startup.
 */
export function parseSettings(json: string): Settings {
  try {
    const raw = JSON.parse(json) as Partial<Settings> | null;
    return {
      unitSystem: raw?.unitSystem === 'imperial' ? 'imperial' : 'metric',
      ...clampGradientFactors(
        typeof raw?.gfLow === 'number' ? raw.gfLow : DEFAULT_SETTINGS.gfLow,
        typeof raw?.gfHigh === 'number' ? raw.gfHigh : DEFAULT_SETTINGS.gfHigh,
      ),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({
    unitSystem: settings.unitSystem,
    gfLow: settings.gfLow,
    gfHigh: settings.gfHigh,
  });
}
