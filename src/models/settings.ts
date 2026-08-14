// AI-generated (Claude)
// Preference shape and its (de)serialization.
//
// Kept apart from the store in src/store/settings-store.ts so it stays free of
// expo-file-system and can be tested in Node.

import type { UnitSystem } from './units';

export type Settings = {
  unitSystem: UnitSystem;
};

export const DEFAULT_SETTINGS: Settings = {
  unitSystem: 'metric',
};

/**
 * Reads a settings file. Anything unrecognised, missing or malformed falls back
 * to the default, so an older or hand-edited file never blocks startup.
 */
export function parseSettings(json: string): Settings {
  try {
    const raw = JSON.parse(json) as Partial<Settings> | null;
    return {
      unitSystem: raw?.unitSystem === 'imperial' ? 'imperial' : 'metric',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ unitSystem: settings.unitSystem });
}
