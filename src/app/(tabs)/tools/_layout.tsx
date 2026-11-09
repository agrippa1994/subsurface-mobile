// AI-generated (Claude)
// Stack of the Tools tab: the list of tools, each tool pushed on top of it.
import { Stack } from 'expo-router';
import { STACK_OPTIONS } from '@/constants/navigation';

export default function ToolsLayout() {
  return (
    <Stack screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="index" options={{ title: 'Tools' }} />
      <Stack.Screen name="nitrox" options={{ title: 'Nitrox', headerLargeTitle: false }} />
      <Stack.Screen name="surface-gf" options={{ title: 'Surface GF', headerLargeTitle: false }} />
      {/* Opaque: the result is pinned right under the bar, not scrolling beneath it. */}
      <Stack.Screen
        name="planner"
        options={{ title: 'Dive planner', headerLargeTitle: false, headerTransparent: false }}
      />
      <Stack.Screen
        name="planner-settings"
        options={{ title: 'Planner settings', headerLargeTitle: false }}
      />
      <Stack.Screen name="planner-notes" options={{ title: 'Plan notes', headerLargeTitle: false }} />
      <Stack.Screen
        name="planner-cylinder"
        options={{
          title: 'Cylinder',
          headerLargeTitle: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen name="gas" options={{ title: 'Gas calculator', headerLargeTitle: false }} />
    </Stack>
  );
}
