// AI-generated (Claude)
// Stack of the Sites tab: the list (or map), one site with its dives, a dive
// opened from there with its editor and SSI sync, the site editor, and the
// "new site" form.
import { Stack } from 'expo-router';

export default function SitesLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Sites' }} />
      <Stack.Screen name="[uuid]" options={{ title: 'Site', headerLargeTitle: false }} />
      <Stack.Screen name="dive/[id]" options={{ title: 'Dive', headerLargeTitle: false }} />
      <Stack.Screen
        name="dive/edit/[id]"
        options={{ title: 'Edit dive', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="dive/ssi/[id]"
        options={{ title: 'Sync to SSI', headerLargeTitle: false }}
      />
      <Stack.Screen name="edit/[uuid]" options={{ title: 'Edit site', headerLargeTitle: false }} />
      <Stack.Screen
        name="new"
        options={{ title: 'New site', headerLargeTitle: false, presentation: 'modal' }}
      />
    </Stack>
  );
}
