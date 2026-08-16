// AI-generated (Claude)
// The problem log on disk, and the handlers that feed it.
//
// See src/models/diagnostics.ts for what is written and why nothing is sent
// anywhere. This half is the file and the two hooks that catch failures the
// screens never see: an uncaught JS error (which in a release build shows the
// user a blank red screen and then nothing) and an unhandled promise rejection.

import { File, Paths } from 'expo-file-system';

import {
  appendLine,
  formatEntry,
  toEntry,
  type DiagnosticEntry,
} from '@/models/diagnostics';

/** Kept in the cache directory: useful, but never worth restoring from backup. */
export const DIAGNOSTICS_FILENAME = 'diagnostics.log';

export function diagnosticsFile(): File {
  return new File(Paths.cache, DIAGNOSTICS_FILENAME);
}

export function readDiagnostics(): string {
  const file = diagnosticsFile();
  // Synchronous on purpose: the Settings screen reads this while rendering, and
  // the file is a few kilobytes at most (see MAX_ENTRIES).
  return file.exists ? file.textSync() : '';
}

export function clearDiagnostics(): void {
  const file = diagnosticsFile();
  if (file.exists) {
    file.delete();
  }
}

/**
 * Appends one failure. Deliberately swallows its own errors: a problem log that
 * throws while recording a problem would replace the failure the user is
 * actually hitting with a less interesting one.
 */
export function recordProblem(context: string, error: unknown): DiagnosticEntry | null {
  try {
    const entry = toEntry(context, error);
    const file = diagnosticsFile();
    const next = appendLine(readDiagnostics(), formatEntry(entry));
    if (!file.exists) {
      file.create({ intermediates: true });
    }
    file.write(next);
    return entry;
  } catch {
    return null;
  }
}

let installed = false;

/**
 * Routes uncaught errors into the log, once per launch. The previous handler is
 * still called, so the dev-client's red screen keeps working in development.
 */
export function installProblemHandlers(): void {
  if (installed) {
    return;
  }
  installed = true;

  const globals = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
    };
  };

  const errorUtils = globals.ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      recordProblem(isFatal ? 'crash' : 'error', error);
      previous(error, isFatal);
    });
  }

  // Hermes reports these through a global hook rather than through window
  // events; without it a failed save inside a fire-and-forget promise would
  // leave no trace at all.
  const rejectionTracking = globalThis as typeof globalThis & {
    HermesInternal?: { hasPromise?: () => boolean };
  };
  if (rejectionTracking.HermesInternal) {
    const onRejection = (event: { reason?: unknown }) => recordProblem('rejection', event.reason);
    globalThis.addEventListener?.('unhandledrejection', onRejection as EventListener);
  }
}
