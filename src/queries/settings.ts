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
import { useCallback, useMemo } from 'react';

import type { GradientFactors, Units } from '@/models';
import { rememberComputer, type RememberedComputer } from '@/models/dive-computer';
import {
  clampGradientFactors,
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  type Settings,
} from '@/models/settings';
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

/**
 * Convenience selector: the units every formatter takes. Selected, so that a
 * preference nothing here reads (the last chart, say) does not re-render a whole list.
 * The object keeps its identity until a unit changes (structural sharing), so it
 * is safe in a dependency list or a query key.
 */
export function useUnits(): Units {
  const { data } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: readSettings,
    initialData: readSettings,
    select: (settings) => settings.units,
  });
  return data;
}

/**
 * The gradient factors every profile is plotted with. Memoized because it feeds
 * a query key and a queryFn.
 */
export function useGradientFactors(): GradientFactors {
  const { gfLow, gfHigh } = useSettings();
  return useMemo(() => ({ gfLow, gfHigh }), [gfLow, gfHigh]);
}

/**
 * Which gradient factor curves the profile draws. Purely a display choice: it
 * is deliberately NOT part of `queryKeys.profile()`, unlike gf low and high,
 * because it changes nothing the core computes - both series are in every
 * plot_info already. Keying on it would recompute the whole plot natively on
 * every tap of the switch.
 */
export type GfSeries = { showGfNow: boolean; showGfSurface: boolean };

/** Memoized: it feeds the profile chart's path-building memo. */
export function useGfSeries(): GfSeries {
  const { showGfNow, showGfSurface } = useSettings();
  return useMemo(() => ({ showGfNow, showGfSurface }), [showGfNow, showGfSurface]);
}

export function useSetGfSeries(): (patch: Partial<GfSeries>) => void {
  const update = useUpdateSettings();
  return useCallback((patch: Partial<GfSeries>) => update.mutate(patch), [update]);
}

/**
 * Writes some of the preferences, merged onto the rest. Every setter goes
 * through this: a mutation that rebuilt the whole object would drop the
 * settings it does not know about.
 */
export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Settings> => {
      const current = client.getQueryData<Settings>(queryKeys.settings()) ?? readSettings();
      const settings: Settings = { ...current, ...patch };
      writeSettings(settings);
      return settings;
    },
    onSuccess: (settings) => client.setQueryData(queryKeys.settings(), settings),
  });
}

/** The dive computers offered for a quick download. */
export function useRememberedComputers(): RememberedComputer[] {
  return useSettings().diveComputers;
}

export function useRememberComputer(): (computer: RememberedComputer) => void {
  const client = useQueryClient();
  // `mutate` is stable where the mutation object is not; the download screen's
  // subscription to the module depends on this callback.
  const { mutate } = useUpdateSettings();
  return useCallback(
    (computer: RememberedComputer) => {
      // Off the cache, not a closure: a download outlasts many renders.
      const current = client.getQueryData<Settings>(queryKeys.settings()) ?? readSettings();
      mutate({ diveComputers: rememberComputer(current.diveComputers, computer) });
    },
    [client, mutate],
  );
}

export function useForgetComputers(): () => void {
  const { mutate } = useUpdateSettings();
  return useCallback(() => mutate({ diveComputers: [] }), [mutate]);
}

/** Sets some of the units; a preset is all five at once. */
export function useSetUnits(): (patch: Partial<Units>) => void {
  const client = useQueryClient();
  const { mutate } = useUpdateSettings();
  return useCallback(
    (patch: Partial<Units>) => {
      const current = client.getQueryData<Settings>(queryKeys.settings()) ?? readSettings();
      mutate({ units: { ...current.units, ...patch } });
    },
    [client, mutate],
  );
}

/** Sets both gradient factors at once, in range and in order. */
export function useSetGradientFactors(): (gf: GradientFactors) => void {
  const update = useUpdateSettings();
  return useCallback(
    (gf: GradientFactors) => update.mutate(clampGradientFactors(gf.gfLow, gf.gfHigh)),
    [update],
  );
}
