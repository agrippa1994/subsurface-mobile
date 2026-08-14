// AI-generated (Claude)
// Stack of the Sites tab: the list, the editor, and the "new site" form.
import { Stack } from 'expo-router';

export default function SitesLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Sites' }} />
      <Stack.Screen name="[uuid]" options={{ title: 'Edit site', headerLargeTitle: false }} />
      <Stack.Screen
        name="new"
        options={{ title: 'New site', headerLargeTitle: false, presentation: 'modal' }}
      />
    </Stack>
  );
}
