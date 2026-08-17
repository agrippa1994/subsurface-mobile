// AI-generated (Claude)
// Stack of the Dives tab: the list, a dive pushed on top of it, and the editor
// pushed on top of that.
import { Stack } from 'expo-router';

export default function DivesLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Dives' }} />
      <Stack.Screen name="[id]" options={{ title: 'Dive', headerLargeTitle: false }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit dive', headerLargeTitle: false }} />
      <Stack.Screen name="ssi/[id]" options={{ title: 'Sync to SSI', headerLargeTitle: false }} />
    </Stack>
  );
}
