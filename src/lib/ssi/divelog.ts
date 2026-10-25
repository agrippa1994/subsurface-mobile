// AI-generated (Claude)
// The two authenticated calls a dive sync needs.
//
// The library handles requests and decoding; the app reduces the logbook to
// the next dive number and buddy suggestions, and rejects SSI's refusal bodies.

import type { DiveLog } from 'divessi-client';

import {
  buddyDiveHistory,
  reduceSsiBuddies,
  type SsiBuddy,
} from '@/models/ssi/buddies';
import { createSsiClient, ssiData } from './api';
import { withToken } from './auth';

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
    ssiData(createSsiClient(token).get_divelog(undefined, { signal }))
  );

  const details = divelog.logbook_details ?? [];
  const highest = details.reduce((best, entry) => Math.max(best, entry.odin_user_log_nr ?? 0), 0);

  return {
    nextNumber: highest + 1,
    buddies: reduceSsiBuddies(
      divelog.logbook_buddies ?? [],
      buddyDiveHistory(details)
    ),
  };
}

/** Writes one dive into the SSI logbook. */
export async function saveSsiDive(dive: DiveLog, signal?: AbortSignal): Promise<void> {
  await withToken((token) =>
    ssiData(createSsiClient(token).save_divelog({ json_data: dive }, { signal }))
  );
}
