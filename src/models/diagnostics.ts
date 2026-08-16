// AI-generated (Claude)
// The problem log (task 12, step 5).
//
// The app sends nothing anywhere. A crash reporting SDK would mean a third
// party receiving a diver's logbook paths and, on a bad day, dive data - and it
// would be one more binary blob linked into a GPL-2.0 app. Instead a failure is
// written to a local file the user can read and share deliberately, from
// Settings, if they want to attach it to a bug report.
//
// This file is the pure half: what an entry says and how the log is trimmed.
// The file itself lives in src/lib/diagnostics.ts.

import { describeError, shortenPaths } from './errors';

/** How many entries the log keeps. Older ones fall off the top. */
export const MAX_ENTRIES = 50;

export type DiagnosticEntry = {
  /** ISO 8601, UTC. */
  at: string;
  /** Where it happened, e.g. "import" or "render". */
  context: string;
  message: string;
  /** Whatever the C++ core reported, when the failure came from the module. */
  details: string[];
};

export function toEntry(context: string, error: unknown, now: Date = new Date()): DiagnosticEntry {
  const info = describeError(error);
  return {
    at: now.toISOString(),
    context,
    // Container paths say nothing to anyone and are different on every install,
    // so only file names are kept - the same treatment the on-screen errors get.
    message: shortenPaths(info.message),
    details: info.details.map(shortenPaths),
  };
}

/** One entry as the single line it occupies in the file. */
export function formatEntry(entry: DiagnosticEntry): string {
  const details = entry.details.length > 0 ? ` | ${entry.details.join(' | ')}` : '';
  return `${entry.at} [${entry.context}] ${entry.message.replace(/\s+/g, ' ')}${details}`;
}

/**
 * The log with `line` appended, trimmed to the newest `max` entries. The log is
 * kept as text rather than JSON because its whole purpose is to be read by a
 * person - in a bug report, or over the shoulder of one.
 */
export function appendLine(log: string, line: string, max = MAX_ENTRIES): string {
  const lines = log.split('\n').filter((entry) => entry.trim() !== '');
  lines.push(line);
  return `${lines.slice(-max).join('\n')}\n`;
}

/** How the Settings row describes the log. */
export function diagnosticsSummary(log: string): string {
  const lines = log.split('\n').filter((entry) => entry.trim() !== '');
  if (lines.length === 0) {
    return 'No problems recorded';
  }
  const last = lines[lines.length - 1].slice(0, 10);
  return `${lines.length} ${lines.length === 1 ? 'entry' : 'entries'}, last on ${last}`;
}
