// AI-generated (Claude)
// Stack of the Dives tab: the list, and a dive pushed on top of it.
import { Stack } from 'expo-router';

export default function DivesLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Dives' }} />
      <Stack.Screen name="[id]" options={{ title: 'Dive', headerLargeTitle: false }} />
    </Stack>
  );
}
