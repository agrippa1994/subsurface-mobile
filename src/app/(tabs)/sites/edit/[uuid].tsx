// AI-generated (Claude)
// Route for editing one dive site.
//
// Unlike dive ids, dive-site uuids are persisted and stable across a reload of
// the logbook (see modules/ssrf-core/cpp/API.md), so this route can be linked
// to safely.
import { useLocalSearchParams } from 'expo-router';

import { SiteEditor } from '@/features/sites/site-editor';

export default function SiteScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  return <SiteEditor uuid={Number(uuid)} />;
}
