// AI-generated (Claude)
// Route for one dive site: its dives and its position.
//
// Unlike dive ids, dive-site uuids are persisted and stable across a reload of
// the logbook (see modules/ssrf-core/cpp/API.md), so this route can be linked
// to safely.
import { useLocalSearchParams } from 'expo-router';

import { SiteDetail } from '@/features/sites/site-detail';

export default function SiteScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  return <SiteDetail uuid={Number(uuid)} />;
}
