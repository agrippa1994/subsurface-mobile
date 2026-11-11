// AI-generated (Claude)
// Stack of the Sites tab: the map with its list, one site with its dives, a dive
// opened from there with its editor, SSI sync and trip, the site editor, and the
// "new site" form.
import { Stack } from 'expo-router';
import { STACK_OPTIONS } from '@/constants/navigation';
import { t } from '@/i18n';

export default function SitesLayout() {
  return (
    <Stack screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="index" options={{ title: t('nav.sites') }} />
      <Stack.Screen name="[uuid]" options={{ title: t('nav.site'), headerLargeTitle: false }} />
      <Stack.Screen name="ssi-site/[id]" options={{ title: t('nav.ssiSite'), headerLargeTitle: false }} />
      <Stack.Screen name="dive/[id]" options={{ title: t('nav.dive'), headerLargeTitle: false }} />
      <Stack.Screen
        name="dive/edit/[id]"
        options={{ title: t('nav.editDive'), headerLargeTitle: false }}
      />
      <Stack.Screen
        name="dive/ssi/[id]"
        options={{ title: t('nav.syncToSsi'), headerLargeTitle: false }}
      />
      <Stack.Screen name="edit/[uuid]" options={{ title: t('nav.editSite'), headerLargeTitle: false }} />
      <Stack.Screen
        name="new"
        options={{ title: t('nav.newSite'), headerLargeTitle: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="dive/trip/[id]"
        options={{ title: t('nav.trip'), headerLargeTitle: false, headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="dive/trip/edit/[id]"
        options={{ title: t('nav.editTrip'), headerLargeTitle: false }}
      />
      <Stack.Screen
        name="dive/trip/pick"
        options={{
          title: t('nav.addToTrip'),
          headerLargeTitle: false,
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 1],
        }}
      />
    </Stack>
  );
}
