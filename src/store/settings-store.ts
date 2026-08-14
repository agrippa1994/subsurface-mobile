// AI-generated (Claude)
// User preferences.
//
// Small enough to keep in one JSON file next to the logbook - there is no
// database in this app on purpose. Reads and writes are synchronous, which is
// fine for a file this size and keeps the store free of async state. The shape
// and its parsing live in src/models/settings.ts so they stay testable in Node.

import { create } from 'zustand';
import { File, Paths } from 'expo-file-system';

import type { UnitSystem } from '@/models';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from '@/models/settings';

const SETTINGS_FILENAME = 'settings.json';

function settingsFile(): File {
  return new File(Paths.document, SETTINGS_FILENAME);
}

function readSettings(): Settings {
  try {
    const file = settingsFile();
    return file.exists ? parseSettings(file.textSync()) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: Settings): void {
  try {
    const file = settingsFile();
    if (!file.exists) {
      file.create({ intermediates: true });
    }
    file.write(serializeSettings(settings));
  } catch {
    // A preference that cannot be persisted still applies for this session;
    // failing the interaction over it would be worse.
  }
}

export type SettingsState = Settings & {
  hydrated: boolean;
  /** Reads the file once at startup. Safe to call again; it just re-reads. */
  hydrate(): void;
  setUnitSystem(system: UnitSystem): void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  hydrate() {
    set({ ...readSettings(), hydrated: true });
  },

  setUnitSystem(unitSystem) {
    set({ unitSystem });
    writeSettings({ unitSystem });
  },
}));

/** Convenience selector: the unit system every formatter takes. */
export function useUnitSystem(): UnitSystem {
  return useSettingsStore((state) => state.unitSystem);
}
