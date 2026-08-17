// AI-generated (Claude)
// Writing the logbook back to disk.
//
// The SSRF file is the source of truth, so nothing is a change until it is on
// disk - but rapid edits (a rating tapped three times, a field typed into) must
// not re-serialize the whole logbook once per keystroke. A mutation therefore
// only marks the log dirty and arms a timer; `flush()` writes immediately, and
// every editor calls it when it closes, so a force-quit cannot land in the
// window.
//
// This lives outside React and outside the query cache on purpose: it is a
// debounce over a file, not state a screen renders, and keeping it free of
// React Native imports keeps it reachable from the Node test suite.

import { saveToXML } from '../../modules/ssrf-core/src';

const SAVE_DEBOUNCE_MS = 400;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Promise<void> | null = null;
let lastSaveError: unknown = null;

/** Where `saveToXML` writes. Set by whoever loads a logbook. */
let target: string | null = null;

let saving = false;
const listeners = new Set<() => void>();

function setSaving(next: boolean): void {
  if (saving === next) {
    return;
  }
  saving = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Points the debounce at a logbook. Passing null closes it: a change scheduled
 * while no logbook is open is reported as a save failure, not dropped.
 */
export function setPersistTarget(path: string | null): void {
  target = path;
}

export function persistTarget(): string | null {
  return target;
}

/** True between the first unsaved mutation and the write completing. */
export function isSaving(): boolean {
  return saving;
}

export function subscribeSaving(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Marks the log dirty and arms the debounce. */
export function schedulePersist(): void {
  setSaving(true);
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, SAVE_DEBOUNCE_MS);
}

/** Writes the logbook now, if a mutation is still waiting for the debounce. */
export async function flush(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    persist();
  }
  await pendingSave;
  // A write that failed inside the debounce had nobody to report to; the caller
  // of flush() is that somebody, so it is raised here rather than left sitting
  // as a message no screen shows.
  if (lastSaveError !== null) {
    const error = lastSaveError;
    lastSaveError = null;
    throw error;
  }
}

/**
 * The last write failure, if one is still unreported. Screens that show the
 * logbook use this to surface a background save failure that no `flush()`
 * caller happened to be waiting for.
 */
export function lastPersistError(): unknown {
  return lastSaveError;
}

function persist(): void {
  if (target === null) {
    // No logbook is open, so there is nowhere to write. This is kept as a
    // failure rather than skipped: a change that cannot be written is a change
    // the user is about to be told about and will never get back, and silence
    // here is what made an import report "complete" while the file on disk
    // never saw it.
    lastSaveError = new Error('No logbook is open, so the change could not be saved.');
    setSaving(false);
    return;
  }
  const path = target;
  // The write itself is synchronous in the module (save_dives to path.tmp, then
  // rename), so `pendingSave` exists only so that flush() has something to await
  // and a caller can be sure the file is on disk before it returns.
  pendingSave = (async () => {
    try {
      saveToXML(path);
      lastSaveError = null;
    } catch (error) {
      // The in-memory log still holds the edit; only the file is behind. The
      // error is kept rather than swallowed, because the file is the source of
      // truth and the user has to know it did not get the change: flush()
      // rethrows it, and the editor that called flush() shows it.
      lastSaveError = error;
    } finally {
      pendingSave = null;
      setSaving(false);
    }
  })();
}
