// AI-generated (Claude)
import { parseSsiSiteDetail } from '@/models/ssi/site-browse';
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
