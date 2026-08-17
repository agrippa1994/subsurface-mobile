// AI-generated (Claude)
// Route for the SSI sync screen, pushed from a dive's detail screen.
import { useLocalSearchParams } from 'expo-router';

import { SsiSyncScreen } from '@/features/ssi/ssi-sync-screen';

export default function SsiSyncRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SsiSyncScreen diveId={Number(id)} />;
}
