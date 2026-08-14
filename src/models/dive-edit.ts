// AI-generated (Claude)
// Presentation model of the dive editor.
//
// Pure functions only - no React, no native module. The module owns the dive
// (see modules/ssrf-core/cpp/API.md); this file turns a dive into an editable
// draft, turns the draft back into the smallest `DivePatch` that expresses the
// user's changes, and builds the autocomplete suggestions.
//
// Sending a minimal patch matters: `updateDive` overwrites every field the
// patch mentions, so echoing untouched fields back would resurrect stale values
// if the log were reloaded underneath the editor.

import type { Dive, DivePatch, DiveSummary } from './index';

/**
 * The editor's own state. Everything is a string or a number the UI can bind
 * to directly; `buddy` and `diveguide` stay comma-separated exactly as the core
 * stores them (`dive::buddy`, `dive::diveguide` in core/dive.h are plain
 * comma-separated `std::string`s).
 */
export type DiveDraft = {
  notes: string;
  buddy: string;
  diveguide: string;
  suit: string;
  rating: number;
  visibility: number;
  tags: string[];
  /** 0 means "no site". */
  siteUuid: number;
};

export function diveDraftFrom(dive: Dive): DiveDraft {
  return {
    notes: dive.notes,
    buddy: dive.buddy,
    diveguide: dive.diveguide,
    suit: dive.suit,
    rating: dive.rating,
    visibility: dive.visibility,
    tags: [...dive.tags],
    siteUuid: dive.siteUuid,
  };
}

// --- Comma-separated name lists --------------------------------------------

/**
 * Splits a comma-separated name field into its names, dropping empties and
 * duplicates (case-insensitively, first spelling wins) but preserving order.
 */
export function parseNameList(value: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of value.split(',')) {
    const name = raw.trim();
    const key = name.toLocaleLowerCase();
    if (name === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** The inverse of `parseNameList`, in the core's own spelling: ", " joined. */
export function formatNameList(names: readonly string[]): string {
  return parseNameList(names.join(',')).join(', ');
}

/**
 * Every buddy and diveguide name in the loaded log, deduplicated
 * case-insensitively and sorted. This is the autocomplete corpus: the core has
 * no buddy table, so the only source of known names is the dives themselves.
 */
export function harvestNames(dives: readonly DiveSummary[]): string[] {
  const byKey = new Map<string, string>();
  for (const dive of dives) {
    for (const name of [...parseNameList(dive.buddy), ...parseNameList(dive.diveguide)]) {
      const key = name.toLocaleLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, name);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** Every tag used in the loaded log, deduplicated and sorted. */
export function harvestTags(dives: readonly DiveSummary[]): string[] {
  const byKey = new Map<string, string>();
  for (const dive of dives) {
    for (const tag of dive.tags) {
      const name = tag.trim();
      const key = name.toLocaleLowerCase();
      if (name !== '' && !byKey.has(key)) {
        byKey.set(key, name);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Suggestions for the token the user is typing at the end of `value`.
 *
 * Names already in the field are never suggested again, matching is a
 * case-insensitive substring (a diver types the surname of "Anna Meier" as
 * often as the first name), and an empty trailing token suggests nothing -
 * a dropdown covering the keyboard before a single character is typed is
 * noise.
 */
export function suggestNames(
  value: string,
  corpus: readonly string[],
  limit = 5
): string[] {
  const trailing = value.slice(value.lastIndexOf(',') + 1).trim().toLocaleLowerCase();
  if (trailing === '') {
    return [];
  }
  const taken = new Set(parseNameList(value).map((name) => name.toLocaleLowerCase()));
  const matches = corpus.filter((name) => {
    const key = name.toLocaleLowerCase();
    return key.includes(trailing) && !taken.has(key);
  });
  // Prefix matches first: typing "an" should offer "Anna" before "Susan".
  matches.sort((a, b) => {
    const aPrefix = a.toLocaleLowerCase().startsWith(trailing) ? 0 : 1;
    const bPrefix = b.toLocaleLowerCase().startsWith(trailing) ? 0 : 1;
    return aPrefix - bPrefix || a.localeCompare(b);
  });
  return matches.slice(0, limit);
}

/** Replaces the token being typed with `name`, leaving the earlier ones alone. */
export function applySuggestion(value: string, name: string): string {
  const head = parseNameList(value.slice(0, value.lastIndexOf(',') + 1));
  return formatNameList([...head, name]) + ', ';
}

// --- Patch building --------------------------------------------------------

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

/**
 * The smallest patch that turns `dive` into `draft`. Returns an empty object
 * when nothing changed, which the caller uses to skip the write (and with it
 * the re-serialization of the whole logbook).
 *
 * Name lists and tags are normalized before comparison, so re-spacing
 * "Alice,Bob" to "Alice, Bob" is not a change.
 */
export function buildDivePatch(dive: Dive, draft: DiveDraft): DivePatch {
  const patch: DivePatch = {};

  if (draft.notes !== dive.notes) {
    patch.notes = draft.notes;
  }
  const buddy = formatNameList(parseNameList(draft.buddy));
  if (buddy !== formatNameList(parseNameList(dive.buddy))) {
    patch.buddy = buddy;
  }
  const diveguide = formatNameList(parseNameList(draft.diveguide));
  if (diveguide !== formatNameList(parseNameList(dive.diveguide))) {
    patch.diveguide = diveguide;
  }
  if (draft.suit.trim() !== dive.suit.trim()) {
    patch.suit = draft.suit.trim();
  }
  if (clampRating(draft.rating) !== dive.rating) {
    patch.rating = clampRating(draft.rating);
  }
  if (clampRating(draft.visibility) !== dive.visibility) {
    patch.visibility = clampRating(draft.visibility);
  }

  const tags = normalizeTags(draft.tags);
  if (!sameTags(tags, normalizeTags(dive.tags))) {
    patch.tags = tags;
  }
  if (draft.siteUuid !== dive.siteUuid) {
    patch.siteUuid = draft.siteUuid;
  }

  return patch;
}

export function isEmptyPatch(patch: DivePatch): boolean {
  return Object.keys(patch).length === 0;
}

/** Ratings and visibility are 0-5 in the core (`dive::rating`). */
export function clampRating(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

/**
 * Trims, drops empties and deduplicates case-insensitively. The core's
 * `taglist_add_tag` deduplicates too, so this only keeps the draft comparable
 * to what a reload would hand back.
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    const key = tag.toLocaleLowerCase();
    if (tag === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Splits a comma-separated tag input, for the single-line tag field. */
export function parseTagInput(value: string): string[] {
  return normalizeTags(value.split(','));
}
