// AI-generated (Claude)
// A dive site opened from a dive in the Statistics stack, kept in that stack so
// Back returns to the dive. Same screen as the Sites tab's.
import { useLocalSearchParams } from 'expo-router';

import { SiteDetail } from '@/features/sites/site-detail';

export default function StatisticsSiteScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  return <SiteDetail uuid={Number(uuid)} divePath="/statistics/dive" editable={false} />;
}
