// AI-generated (Claude)
// The two authenticated calls a dive sync needs.
//
// `get_divelog` returns the user's whole SSI logbook, which is large; the only
// thing this app wants from it is the highest dive number in use, so the
// response is typed down to that. `save_divelog` returns nothing worth reading:
// SSI answers a rejected write with the refusal body that src/lib/ssi/api.ts
// turns into an SsiApiError, so a call that returns at all succeeded.

import type { CreateDive } from '@/models/ssi/create-dive';
import { ssiGet, ssiPost } from './api';
import { withToken } from './auth';

/** As much of the `get_divelog` response as the next dive number needs. */
type DivelogResponse = {
  logbook_details?: { odin_user_log_nr?: number }[];
};

/**
 * The number to file the next dive under.
 *
 * SSI numbers dives itself and does not derive the number from the payload, so
 * this is the app's job. It is taken from the SSI logbook rather than from
 * `dive.number` in the Subsurface log: the two logbooks are rarely the same
 * length, and a number already in use would land the dive out of order.
 */
export async function nextSsiDiveNumber(signal?: AbortSignal): Promise<number> {
  const divelog = await withToken((token) =>
    ssiGet<DivelogResponse>({ what: 'get_divelog', token }, signal)
  );

  const highest = (divelog.logbook_details ?? []).reduce(
    (best, entry) => Math.max(best, entry.odin_user_log_nr ?? 0),
    0
  );

  return highest + 1;
}

/** Writes one dive into the SSI logbook. */
export async function saveSsiDive(dive: CreateDive, signal?: AbortSignal): Promise<void> {
  await withToken((token) => ssiPost({ what: 'save_divelog', token }, dive, signal));
}
