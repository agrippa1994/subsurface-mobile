// AI-generated (Claude)
// Stack of the Settings tab.
import { Stack } from 'expo-router';
import { STACK_OPTIONS } from '@/constants/navigation';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="ssi" options={{ title: 'SSI', headerLargeTitle: false }} />
      <Stack.Screen
        name="ssi-import"
        options={{ title: 'Add SSI dives', headerLargeTitle: false }}
      />
      <Stack.Screen name="git" options={{ title: 'Git sync', headerLargeTitle: false }} />
      <Stack.Screen name="download" options={{ title: 'Dive computer', headerLargeTitle: false }} />
    </Stack>
  );
}
