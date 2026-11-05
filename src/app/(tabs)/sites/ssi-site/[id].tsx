// AI-generated (Claude)
// One SSI site, opened from the SSI browser in the Sites tab.
import { useLocalSearchParams } from 'expo-router';

import { SsiSiteDetailScreen } from '@/features/ssi/ssi-site-details';

export default function SsiSiteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SsiSiteDetailScreen id={Number(id)} />;
}
