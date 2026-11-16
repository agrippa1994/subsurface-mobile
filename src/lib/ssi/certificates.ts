// AI-generated (Claude)
// The diver's certification cards, and the name that goes on them.

import {
  diverName,
  parseSsiCertificates,
  type SsiCertificate,
} from '@/models/ssi/certificates';

import { createSsiClient, ssiData } from './api';
import { withToken } from './auth';

export type SsiCards = {
  cards: SsiCertificate[];
  /** The holder, from the SSI profile. Null when the profile has no name. */
  holder: string | null;
};

export async function fetchSsiCards(signal?: AbortSignal): Promise<SsiCards> {
  return withToken(async (token) => {
    const client = createSsiClient(token);
    // The name is decoration: a profile that will not load must not cost the
    // cards, so it is asked for alongside and dropped on failure.
    const [cards, profile] = await Promise.all([
      ssiData(client.certificates(undefined, { signal })),
      ssiData(client.profile(undefined, { signal })).catch(() => null),
    ]);
    return { cards: parseSsiCertificates(cards), holder: diverName(profile) };
  });
}
