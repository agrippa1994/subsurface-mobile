// AI-generated (Claude)
import { parseSsiSiteDetail } from '@/models/ssi/site-browse';
import { parseSsiSiteLookups, type SsiSiteLookups } from '@/models/ssi/site-lookups';
import { createClient } from 'divessi-client';
import { createSsiClient, ssiData } from './api';

export async function fetchSsiSiteDetail(id: number, signal?: AbortSignal) {
  const response = await ssiData(createSsiClient().siteDetail({ site_id: id }, { signal }));
  if (response && !Array.isArray(response) && typeof response === 'object' && response.error) {
    const error = response.error;
    throw new Error(
      typeof error === 'object' && !Array.isArray(error) && error && typeof error.error === 'string'
        ? error.error
        : 'SSI could not provide this site. Refresh the catalogue in Settings.',
    );
  }
  return parseSsiSiteDetail(response, id);
}

/**
 * A read-only action divessi-client does not wrap. Reuses its `get_vars` call and
 * rewrites the action, so the app identity SSI requires stays the library's job.
 */
function readSsiAction(action: string, signal?: AbortSignal): Promise<unknown> {
  const client = createClient({
    metadata: { lang: 'eng' },
    fetch: (url, init) => fetch(String(url).replace('what=get_vars', `what=${action}`), init),
  });
  return ssiData(client.countries(undefined, { signal, decode: (raw: unknown) => raw }));
}

/**
 * The labels for a site's codes. One failed table only costs its own labels; with
 * all three gone there is nothing to keep, so that fails and is tried again later.
 */
export async function fetchSsiSiteLookups(signal?: AbortSignal): Promise<SsiSiteLookups> {
  const results = await Promise.allSettled(
    ['get_divelog_vars', 'get_wildlife_vars', 'get_translations'].map((action) =>
      readSsiAction(action, signal),
    ),
  );
  if (results.every((result) => result.status === 'rejected')) {
    throw new Error('SSI provided no lookup tables.');
  }
  const [vars, wildlife, translations] = results.map((result) =>
    result.status === 'fulfilled' ? result.value : null,
  );
  return parseSsiSiteLookups(vars, wildlife, translations);
}
