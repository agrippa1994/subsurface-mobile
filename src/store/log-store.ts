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

import { AppState } from 'react-native';
import { create } from 'zustand';

import {
  deleteDiveSite as deleteDiveSiteNative,
  importFile as importFileNative,
  listDives,
  listDiveSites,
  loadFromXML,
  saveToXML,
  updateDive as updateDiveNative,
  upsertDiveSite as upsertDiveSiteNative,
} from '../../modules/ssrf-core/src';
import type {
  Dive,
  DivePatch,
  DiveSite,
  DiveSiteInput,
  DiveSummary,
  ImportResult,
  LoadResult,
} from '@/models';
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
   * Merges a file of any supported format into the loaded log and writes the
   * logbook straight away - an import is not a change the user would expect to
   * lose, so it does not wait for the mutation debounce.
   */
  importFile(path: string): Promise<ImportResult>;
  /**
   * Replaces the working logbook with `path`: the file is loaded and then saved
   * over the app's own logbook, so the picked file itself - which may be a
   * temporary copy handed over by another app - is never the file the app keeps
   * writing to.
   */
  replaceWith(path: string): Promise<LoadResult>;
  /** Writes the current logbook to `path` for sharing. Flushes first. */
  exportTo(path: string): Promise<void>;
  /** Re-reads dives and sites from the module after a mutation. */
  refresh(): void;
  dismissError(): void;

  // --- Mutations (task 10) --------------------------------------------------
  //
  // Every one of these applies the change in the module, re-reads the cache and
  // schedules a save of the whole logbook - the SSRF file is the source of
  // truth, so nothing is a change until it is on disk.

  /** True between the first unsaved mutation and the write completing. */
  saving: boolean;
  /** Applies a dive patch and persists. Returns the module's updated dive. */
  updateDive(id: number, patch: DivePatch): Promise<Dive>;
  /** Creates or updates a dive site and persists. Returns its uuid. */
  saveSite(input: DiveSiteInput): Promise<number>;
  /** Deletes a site, detaching its dives, and persists. */
  deleteSite(uuid: number): Promise<void>;
  /** Writes the logbook now, if a mutation is still waiting for the debounce. */
  flush(): Promise<void>;
};

// Rapid edits (a rating tapped three times, a slider dragged) must not
// re-serialize the whole logbook once per keystroke, so a mutation only marks
// the log dirty and arms this timer. `flush()` writes immediately, and every
// editor calls it when it closes, so a force-quit cannot land in the window.
const SAVE_DEBOUNCE_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Promise<void> | null = null;
let lastSaveError: unknown = null;

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

  async importFile(path: string) {
    // Nothing is caught here: an import is something the user started from a
    // screen, and that screen shows the failure next to the button that caused
    // it rather than replacing the dive list with an error state.
    const result = importFileNative(path);
    get().refresh();
    schedulePersist(set, get);
    await get().flush();
    return result;
  },

  async replaceWith(path: string) {
    const target = await ensureLogbook();
    let result: LoadResult;
    try {
      result = loadFromXML(path);
    } catch (error) {
      // A failed parse leaves the module's divelog cleared, so the app would be
      // sitting on a cache of dives that are no longer there. Put the working
      // logbook back before handing the failure to the screen.
      await get().loadPath(target);
      throw error;
    }
    set({
      status: 'ready',
      path: target,
      lastLoad: result,
      dives: listDives(),
      sites: listDiveSites(),
      error: null,
    });
    schedulePersist(set, get);
    await get().flush();
    return result;
  },

  async exportTo(path: string) {
    // Anything still inside the debounce belongs in the export too.
    await get().flush();
    saveToXML(path);
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

  saving: false,

  async updateDive(id: number, patch: DivePatch) {
    const dive = updateDiveNative(id, patch);
    get().refresh();
    schedulePersist(set, get);
    return dive;
  },

  async saveSite(input: DiveSiteInput) {
    const uuid = upsertDiveSiteNative(input);
    get().refresh();
    schedulePersist(set, get);
    return uuid;
  },

  async deleteSite(uuid: number) {
    deleteDiveSiteNative(uuid);
    get().refresh();
    schedulePersist(set, get);
  },

  async flush() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
      persist(set, get);
    }
    await pendingSave;
    // A write that failed inside the debounce had nobody to report to; the
    // caller of flush() is that somebody, so it is raised here rather than
    // left sitting in the store as a message no screen shows.
    if (lastSaveError !== null) {
      const error = lastSaveError;
      lastSaveError = null;
      throw error;
    }
  },
}));

type SetState = (partial: Partial<LogState>) => void;
type GetState = () => LogState;

function schedulePersist(set: SetState, get: GetState): void {
  set({ saving: true });
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist(set, get);
  }, SAVE_DEBOUNCE_MS);
}

function persist(set: SetState, get: GetState): void {
  const path = get().path;
  if (path === null) {
    set({ saving: false });
    return;
  }
  // The write itself is synchronous in the module (save_dives to path.tmp, then
  // rename), so `pendingSave` exists only so that flush() has something to await
  // and a caller can be sure the file is on disk before it returns.
  pendingSave = (async () => {
    try {
      saveToXML(path);
      lastSaveError = null;
      set({ saving: false });
    } catch (error) {
      // The in-memory log still holds the edit; only the file is behind. The
      // error is kept rather than swallowed, because the file is the source of
      // truth and the user has to know it did not get the change: flush()
      // rethrows it, and the editor that called flush() shows it.
      lastSaveError = error;
      set({ saving: false, error: describeError(error) });
    } finally {
      pendingSave = null;
    }
  })();
}

// A logbook must not be left behind in memory when the app is swiped away, so
// anything still inside the debounce window is written as the app backgrounds.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') {
    void useLogStore.getState().flush();
  }
});

/** Looks up one cached row. Returns undefined once the log is reloaded. */
export function selectDive(state: LogState, id: number): DiveSummary | undefined {
  return state.dives.find((dive) => dive.id === id);
}
