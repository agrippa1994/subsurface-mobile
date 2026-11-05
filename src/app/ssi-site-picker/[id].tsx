// AI-generated (Claude)
// One SSI site inside the picker modal, with the way to file the dive under it.
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { SsiSiteDetailScreen } from '@/features/ssi/ssi-site-details';
import { useSsiPickerSession } from '@/features/ssi/ssi-site-picker-session';

export default function SsiSitePickerDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSsiPickerSession();
  const navigation = useNavigation();
  return (
    <SsiSiteDetailScreen
      id={Number(id)}
      onSelect={
        session
          ? (site) => {
              // The modal itself, from the root stack: going back here would only
              // return to the browser.
              navigation.getParent()?.goBack();
              session.onSelect(site);
            }
          : undefined
      }
    />
  );
}
