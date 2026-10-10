// AI-generated (Claude)
// Stack of the Tools tab: the list of tools, each tool pushed on top of it.
import { Stack } from 'expo-router';

export default function ToolsLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Tools' }} />
      <Stack.Screen name="nitrox" options={{ title: 'Nitrox', headerLargeTitle: false }} />
    </Stack>
  );
}
