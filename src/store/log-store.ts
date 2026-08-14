// AI-generated (Claude)
// The logbook store.
//
// The native module owns the parsed divelog; this store owns nothing but a
// cache of what the last read returned, plus the screen state around it
// (loading / ready / empty / error). Every mutation from later tasks must call
// `refresh()` so the cache cannot drift from the module - which is also why the
// cached rows are re-read wholesale rather than patched in place.
//
// Dive ids are process-local and are reassigned on every load (see
// modules/ssrf-core/cpp/API.md), so nothing outside a loaded log may hold one.

import { create } from 'zustand';

import {
  importSuunto as importSuuntoNative,
  listDives,
  listDiveSites,
  loadFromXML,
} from '../../modules/ssrf-core/src';
import type { DiveSite, DiveSummary, LoadResult } from '@/models';
import { describeError, type ErrorInfo } from '@/models/errors';
import { ensureLogbook } from '@/lib/logbook-file';

export type LogStatus = 'idle' | 'loading' | 'ready' | 'error';

export type LogState = {
  status: LogStatus;
  /** Newest-first is applied by the list, not here: this mirrors the module. */
  dives: DiveSummary[];
  sites: DiveSite[];
  /** Path of the logbook currently loaded, or null before the first load. */
  path: string | null;
  error: ErrorInfo | null;
  /** Counts of the last load, for the "just imported" style summaries. */
  lastLoad: LoadResult | null;

  /** Seeds the working logbook from the bundled sample if needed, then loads. */
  open(): Promise<void>;
  /** Loads an arbitrary logbook, replacing whatever the module held. */
  loadPath(path: string): Promise<void>;
  /**
   * Merges a Suunto DM4/DM5 database into the loaded log. The dives stay in
   * memory until something saves them - task 11 owns the file side of import.
   */
  importSuunto(path: string): Promise<void>;
  /** Re-reads dives and sites from the module after a mutation. */
  refresh(): void;
  dismissError(): void;
};

export const useLogStore = create<LogState>((set, get) => ({
  status: 'idle',
  dives: [],
  sites: [],
  path: null,
  error: null,
  lastLoad: null,

  async open() {
    if (get().status === 'loading') {
      return;
    }
    set({ status: 'loading', error: null });
    try {
      await get().loadPath(await ensureLogbook());
    } catch (error) {
      set({ status: 'error', error: describeError(error), dives: [], sites: [] });
    }
  },

  async loadPath(path: string) {
    set({ status: 'loading', error: null });
    try {
      const lastLoad = loadFromXML(path);
      set({
        status: 'ready',
        path,
        lastLoad,
        dives: listDives(),
        sites: listDiveSites(),
        error: null,
      });
    } catch (error) {
      // A failed load leaves the module's divelog cleared, so the cache goes
      // with it rather than showing dives that are no longer there.
      set({
        status: 'error',
        path,
        lastLoad: null,
        dives: [],
        sites: [],
        error: describeError(error),
      });
    }
  },

  async importSuunto(path: string) {
    set({ status: 'loading', error: null });
    try {
      importSuuntoNative(path);
      set({ status: 'ready', dives: listDives(), sites: listDiveSites(), error: null });
    } catch (error) {
      set({ status: 'error', error: describeError(error) });
    }
  },

  refresh() {
    try {
      set({ dives: listDives(), sites: listDiveSites(), status: 'ready', error: null });
    } catch (error) {
      set({ status: 'error', error: describeError(error) });
    }
  },

  dismissError() {
    set({ error: null, status: get().dives.length > 0 ? 'ready' : 'idle' });
  },
}));

/** Looks up one cached row. Returns undefined once the log is reloaded. */
export function selectDive(state: LogState, id: number): DiveSummary | undefined {
  return state.dives.find((dive) => dive.id === id);
}
