// AI-generated (Claude)
// Stack of the Settings tab.
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="ssi" options={{ title: 'SSI', headerLargeTitle: false }} />
    </Stack>
  );
}
