// AI-generated (Claude)
// The two authenticated calls a dive sync needs.
//
// `get_divelog` returns the user's whole SSI logbook, which is large; only two
// things in it matter here, so the response is typed down to those and read in
// one call rather than two. `save_divelog` returns nothing worth reading: SSI
// answers a rejected write with the refusal body that src/lib/ssi/api.ts turns
// into an SsiApiError, so a call that returns at all succeeded.

import {
  buddyDiveHistory,
  reduceSsiBuddies,
  type RawSsiBuddy,
  type RawSsiLogbookDetail,
  type SsiBuddy,
} from '@/models/ssi/buddies';
import type { CreateDive } from '@/models/ssi/create-dive';
import { ssiGet, ssiPost } from './api';
import { withToken } from './auth';

/** As much of the `get_divelog` response as the sync screen needs. */
type DivelogResponse = {
  logbook_details?: (RawSsiLogbookDetail & { odin_user_log_nr?: number })[];
  logbook_buddies?: RawSsiBuddy[];
};

export type SsiLogbook = {
  /**
   * The number to file the next dive under.
   *
   * SSI numbers dives itself and does not derive the number from the payload,
   * so this is the app's job. It is taken from the SSI logbook rather than from
   * `dive.number` in the Subsurface log: the two logbooks are rarely the same
   * length, and a number already in use would land the dive out of order.
   */
  nextNumber: number;
  /**
   * The diver's own buddy list, to pick from when filing a dive, ordered by who
   * they dived with most recently - which only the logged dives know, so it is
   * worked out here rather than taken from SSI.
   */
  buddies: SsiBuddy[];
};

/** Reads the SSI logbook, reduced to what a sync needs from it. */
export async function fetchSsiLogbook(signal?: AbortSignal): Promise<SsiLogbook> {
  const divelog = await withToken((token) =>
    ssiGet<DivelogResponse>({ what: 'get_divelog', token }, signal)
  );

  const details = divelog.logbook_details ?? [];
  const highest = details.reduce((best, entry) => Math.max(best, entry.odin_user_log_nr ?? 0), 0);

  return {
    nextNumber: highest + 1,
    buddies: reduceSsiBuddies(divelog.logbook_buddies ?? [], buddyDiveHistory(details)),
  };
}

/** Writes one dive into the SSI logbook. */
export async function saveSsiDive(dive: CreateDive, signal?: AbortSignal): Promise<void> {
  await withToken((token) => ssiPost({ what: 'save_divelog', token }, dive, signal));
}
