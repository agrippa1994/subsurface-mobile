// AI-generated (Claude)
// A dive site opened from a dive, kept in the Dives stack so Back returns to the
// dive rather than to the Sites tab. Same screen as the Sites tab's; its dives open
// in this stack too, and editing the site stays the Sites tab's.
import { useLocalSearchParams } from 'expo-router';

import { SiteDetail } from '@/features/sites/site-detail';

export default function DiveSiteScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  return <SiteDetail uuid={Number(uuid)} divePath="/dives" editable={false} />;
}
