// AI-generated (Claude)
// User preferences.
//
// Small enough to keep in one JSON file next to the logbook - there is no
// database in this app on purpose. Reads and writes are synchronous, which is
// fine for a file this size. The shape and its parsing live in
// src/models/settings.ts so they stay testable in Node.
//
// The read is seeded as `initialData` rather than fetched: it cannot throw (it
// falls back to the defaults) and units must not flash imperial-then-metric on
// the first frame of every screen.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';

import type { UnitSystem } from '@/models';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from '@/models/settings';
import { queryKeys } from '@/lib/query-keys';

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

export function useSettings(): Settings {
  const { data } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: readSettings,
    initialData: readSettings,
  });
  return data;
}

/** Convenience selector: the unit system every formatter takes. */
export function useUnitSystem(): UnitSystem {
  return useSettings().unitSystem;
}

export function useSetUnitSystem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (unitSystem: UnitSystem): Promise<Settings> => {
      const settings: Settings = { unitSystem };
      writeSettings(settings);
      return settings;
    },
    onSuccess: (settings) => client.setQueryData(queryKeys.settings(), settings),
  });
}
