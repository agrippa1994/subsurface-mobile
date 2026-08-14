// AI-generated (Claude)
// Turning failures into something a screen can show.
//
// The bindings report failure as a thrown SsrfCoreError carrying both a summary
// and whatever the C++ core routed through report_error() (see
// modules/ssrf-core/cpp/API.md). The parser is chatty - a malformed logbook
// produces one core message per problem - so the UI shows the summary and keeps
// the details for a secondary line.

import { SsrfCoreError } from './index';

export type ErrorInfo = {
  /** One line, always non-empty. */
  message: string;
  /** Messages the C++ core reported, in order. May be empty. */
  details: string[];
};

export function describeError(error: unknown): ErrorInfo {
  if (error instanceof SsrfCoreError) {
    return {
      message: error.message || 'The logbook could not be read.',
      details: error.coreErrors,
    };
  }
  if (error instanceof Error) {
    return { message: error.message || error.name, details: [] };
  }
  const text = String(error);
  return { message: text === '' ? 'Unknown error' : text, details: [] };
}

/**
 * Replaces absolute paths with just the file name. Everything the app touches
 * lives in its own sandbox, so the full path is a screenful of container UUID
 * that tells the user nothing.
 */
export function shortenPaths(text: string): string {
  return text.replace(/(\/[^\s'"]+)+/g, (match) => match.slice(match.lastIndexOf('/') + 1));
}

/** Comparable form, for spotting a detail that only rephrases the message. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The message plus at most `limit` core details, joined for a single line.
 * Paths are shortened, and details that merely restate the message are dropped -
 * the core reports both a summary and its own message for the same failure.
 */
export function formatErrorLine(info: ErrorInfo, limit = 3): string {
  const message = shortenPaths(info.message);
  const seen = new Set([normalize(message)]);
  const details: string[] = [];
  for (const detail of info.details) {
    const short = shortenPaths(detail);
    const key = normalize(short);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    details.push(short);
  }

  if (details.length === 0) {
    return message;
  }
  const shown = details.slice(0, limit);
  const more = details.length - shown.length;
  const suffix = more > 0 ? ` (+${more} more)` : '';
  return `${message}: ${shown.join('; ')}${suffix}`;
}
