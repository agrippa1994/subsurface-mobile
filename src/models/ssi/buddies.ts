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

import type { Buddy, DiveLog } from 'divessi-client';

import { MAX_RESULTS, MIN_QUERY_LENGTH } from './sites';

/** The display and history fields inferred from the buddy mapping. */
export type SsiBuddy = ReturnType<typeof reduceSsiBuddies>[number];

/** How often and how recently each buddy has been on a dive, keyed by id. */
export type SsiBuddyHistory = ReadonlyMap<number, { lastDive: string; dives: number }>;

function text(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Counts the dives each buddy was on, and dates the most recent one.
 *
 * This is the whole reason the picker can lead with the people you actually
 * dive with: SSI's buddy list itself has no usage in it, only the dives do.
 * Deleted dives are skipped - they are not dives you were on.
 */
export function buddyDiveHistory(details: readonly DiveLog[]): SsiBuddyHistory {
  const history = new Map<number, { lastDive: string; dives: number }>();

  for (const detail of details) {
    const ids = detail.odin_user_log_buddy_ids;
    if (detail.odin_user_log_deleted === true || !Array.isArray(ids)) {
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
function nameOf(raw: Buddy): string {
  const first = text(raw.firstname) || text(raw.forename);
  const last = text(raw.lastname);
  return [first, last].filter((part) => part !== '').join(' ') || text(raw.nickname);
}

/**
 * An SSI professional: a leader number that is still active. Both halves are
 * needed - the number outlives the rating, and a lapsed pro is not one.
 */
function isPro(raw: Buddy): boolean {
  const number = typeof raw.leader_nr === 'number' ? String(raw.leader_nr) : text(raw.leader_nr);
  return number !== '' && number !== '0' && raw.leader_active === true;
}

/** SSI sends this ready to use, so anything else is not a picture we can show. */
function avatarUrlOf(raw: Buddy): string {
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
  raw: readonly Buddy[],
  history: SsiBuddyHistory = new Map()
) {
  const buddies = [];

  for (const entry of raw) {
    if (typeof entry.id !== 'number' || !Number.isFinite(entry.id)) {
      continue;
    }
    if (entry.deleted === true) {
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
      favorite: entry.favorite === true,
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
