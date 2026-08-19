// AI-generated (Claude)
// The diver's own SSI buddy list, and the lookups the sync screen does on it.
//
// SSI files buddies as numeric ids, and this app's logbook has no buddy table
// at all - `dive::buddy` is a comma-separated string of names (core/dive.h).
// The two have no shared identity, so no attempt is made to match one against
// the other: the sync screen offers SSI's own list and the diver taps the
// people who were there.
//
// The list arrives inside the `get_divelog` response as `logbook_buddies`, the
// same call that yields the next free dive number (src/lib/ssi/divelog.ts), so
// having it costs nothing extra. Like the site catalogue it is reduced to the
// handful of fields the picker shows or matches on.
//
// Which id: an entry carries both `id` and `buddy_master_id`, and the captured
// `save_divelog` request only proves that some number goes into
// `odin_user_log_buddy_ids`. `id` is the buddy row's own key and is what this
// file uses; `buddy_master_id` is the other candidate if a dive ever comes back
// from SSI with no buddy attached.
//
// This file stays free of the file system and the network so vitest can cover
// the matching rules directly.

import { MAX_RESULTS, MIN_QUERY_LENGTH } from './sites';

/** One buddy, reduced to the fields the picker shows or matches on. */
export type SsiBuddy = {
  id: number;
  /** "Firstname Lastname". Never empty - an entry without one is dropped. */
  name: string;
  /** Often empty. Matched on as well as shown, since some divers only use it. */
  nickname: string;
  city: string;
  /** An ISO-3166 alpha-3 code such as "AUT", or empty. */
  country: string;
  /** Starred in SSI. */
  favorite: boolean;
  /**
   * An SSI professional - divemaster, instructor - with an active leader
   * number. Worth showing: it is usually why they were on the dive.
   */
  pro: boolean;
  /**
   * The buddy's photo, as an absolute URL, or empty when there is none. SSI
   * sends this ready to use; a value that is not an http(s) URL is dropped
   * rather than guessed at, since the base it would be relative to is unknown.
   */
  avatarUrl: string;
  /**
   * The last dive in the SSI logbook this buddy was on, as "YYYY-MM-DD", or
   * empty for a buddy who has never been on one. The picker's sort key.
   */
  lastDive: string;
  /** How many dives in the SSI logbook they were on. */
  dives: number;
};

/**
 * The fields of a `logbook_buddies` entry this app reads. Everything else -
 * email, phone, address, certifications, image timestamps - is dropped.
 */
export type RawSsiBuddy = {
  id?: unknown;
  firstname?: unknown;
  lastname?: unknown;
  /** SSI's other spelling of the given name. Used when `firstname` is absent. */
  forename?: unknown;
  nickname?: unknown;
  city?: unknown;
  country?: unknown;
  /** 0 or 1, not a boolean. */
  favorite?: unknown;
  /** Non-zero for a buddy the diver has removed. SSI keeps the row. */
  deleted?: unknown;
  /** The professional's number. A string in some rows, a number in others. */
  leader_nr?: unknown;
  /** Whether that number is still current. A pro needs both. */
  leader_active?: unknown;
  /** An absolute URL, or empty. */
  image?: unknown;
};

/**
 * The fields of a `logbook_details` entry the buddy history is built from. The
 * rest of a logged dive - depths, gases, datasets - is nothing to do with who
 * was on it.
 */
export type RawSsiLogbookDetail = {
  odin_user_log_buddy_ids?: unknown;
  /** "YYYY-MM-DD". Compared as a string, which sorts correctly in that format. */
  odin_user_log_date?: unknown;
  /** Non-zero for a dive the diver has deleted. SSI keeps the row. */
  odin_user_log_deleted?: unknown;
};

/** How often and how recently each buddy has been on a dive, keyed by id. */
export type SsiBuddyHistory = ReadonlyMap<number, { lastDive: string; dives: number }>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isTruthyFlag(value: unknown): boolean {
  return typeof value === 'number' ? value !== 0 : value === true;
}

/**
 * Counts the dives each buddy was on, and dates the most recent one.
 *
 * This is the whole reason the picker can lead with the people you actually
 * dive with: SSI's buddy list itself has no usage in it, only the dives do.
 * Deleted dives are skipped - they are not dives you were on.
 */
export function buddyDiveHistory(details: readonly RawSsiLogbookDetail[]): SsiBuddyHistory {
  const history = new Map<number, { lastDive: string; dives: number }>();

  for (const detail of details) {
    const ids = detail.odin_user_log_buddy_ids;
    if (isTruthyFlag(detail.odin_user_log_deleted) || !Array.isArray(ids)) {
      continue;
    }
    const date = text(detail.odin_user_log_date);

    for (const id of ids) {
      if (typeof id !== 'number' || !Number.isFinite(id)) {
        continue;
      }
      const seen = history.get(id);
      if (seen === undefined) {
        history.set(id, { lastDive: date, dives: 1 });
      } else {
        seen.dives += 1;
        if (date > seen.lastDive) {
          seen.lastDive = date;
        }
      }
    }
  }

  return history;
}

/**
 * The display name, or an empty string when the entry has nothing to show.
 * `firstname`/`lastname` first, then `forename`, then the nickname on its own -
 * a buddy added by nickname alone is still a buddy worth offering.
 */
function nameOf(raw: RawSsiBuddy): string {
  const first = text(raw.firstname) || text(raw.forename);
  const last = text(raw.lastname);
  return [first, last].filter((part) => part !== '').join(' ') || text(raw.nickname);
}

/**
 * An SSI professional: a leader number that is still active. Both halves are
 * needed - the number outlives the rating, and a lapsed pro is not one.
 */
function isPro(raw: RawSsiBuddy): boolean {
  const number = typeof raw.leader_nr === 'number' ? String(raw.leader_nr) : text(raw.leader_nr);
  return number !== '' && number !== '0' && isTruthyFlag(raw.leader_active);
}

/** SSI sends this ready to use, so anything else is not a picture we can show. */
function avatarUrlOf(raw: RawSsiBuddy): string {
  const url = text(raw.image);
  return url.startsWith('https://') || url.startsWith('http://') ? url : '';
}

/**
 * Reduces the `logbook_buddies` array, folding in what the dives say about each
 * buddy. Entries without a usable numeric id, and entries SSI has marked
 * deleted, are dropped; so is an entry that yields no name, since it can be
 * neither searched for nor shown.
 *
 * The order is the picker's: whoever you dived with most recently first, then
 * the buddies with no shared dive - favourites among them ahead of the rest,
 * and names within each group. Recency beats the favourite star deliberately.
 * The star is a standing opinion; the last dive is what actually happened, and
 * on a boat the person you want is almost always the one from yesterday.
 */
export function reduceSsiBuddies(
  raw: readonly RawSsiBuddy[],
  history: SsiBuddyHistory = new Map()
): SsiBuddy[] {
  const buddies: SsiBuddy[] = [];

  for (const entry of raw) {
    if (typeof entry.id !== 'number' || !Number.isFinite(entry.id)) {
      continue;
    }
    if (isTruthyFlag(entry.deleted)) {
      continue;
    }

    const name = nameOf(entry);
    if (name === '') {
      continue;
    }

    const seen = history.get(entry.id);
    buddies.push({
      id: entry.id,
      name,
      nickname: text(entry.nickname),
      city: text(entry.city),
      country: text(entry.country),
      favorite: isTruthyFlag(entry.favorite),
      pro: isPro(entry),
      avatarUrl: avatarUrlOf(entry),
      lastDive: seen?.lastDive ?? '',
      dives: seen?.dives ?? 0,
    });
  }

  return buddies.sort((a, b) => {
    if (a.lastDive !== b.lastDive) {
      // Descending, and "" sorts below every real date, which is what we want.
      return a.lastDive < b.lastDive ? 1 : -1;
    }
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Case-insensitive substring match on the name and the nickname, capped at
 * MAX_RESULTS. Prefix matches first, on the same reasoning as the site search:
 * someone typing "and" means Andrea long before Alexander.
 */
export function searchSsiBuddies(buddies: readonly SsiBuddy[], query: string): SsiBuddy[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const prefix: SsiBuddy[] = [];
  const contains: SsiBuddy[] = [];

  for (const buddy of buddies) {
    const fields = [buddy.name.toLocaleLowerCase(), buddy.nickname.toLocaleLowerCase()];
    if (fields.some((field) => field !== '' && field.startsWith(needle))) {
      prefix.push(buddy);
    } else if (fields.some((field) => field !== '' && field.includes(needle))) {
      contains.push(buddy);
    }
    if (prefix.length >= MAX_RESULTS) {
      break;
    }
  }

  return [...prefix, ...contains].slice(0, MAX_RESULTS);
}

/**
 * What the picker offers before anything is typed: the head of the list, which
 * `reduceSsiBuddies` has already put the most recent dive buddies at.
 */
export function suggestedSsiBuddies(buddies: readonly SsiBuddy[]): SsiBuddy[] {
  return buddies.slice(0, MAX_RESULTS);
}

/**
 * How a buddy reads under their name in the picker.
 *
 * The shared dives come first when there are any: that is what tells one Anna
 * from another. A buddy you have never dived with falls back to the nickname
 * and the place, which is all SSI knows about them.
 */
export function describeSsiBuddy(buddy: SsiBuddy): string {
  if (buddy.dives > 0) {
    const dives = `${buddy.dives} ${buddy.dives === 1 ? 'dive' : 'dives'}`;
    return buddy.lastDive === '' ? dives : `${dives}, last ${buddy.lastDive}`;
  }

  const place = [buddy.city, buddy.country].filter((part) => part !== '').join(', ');
  const parts = [buddy.nickname === '' ? '' : `"${buddy.nickname}"`, place].filter(
    (part) => part !== ''
  );
  return parts.length === 0 ? 'No dives together' : parts.join(' - ');
}
