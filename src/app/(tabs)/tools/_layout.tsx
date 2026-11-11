// AI-generated (Claude)
// Stack of the Tools tab: the list of tools, each tool pushed on top of it.
import { Stack } from 'expo-router';
import { STACK_OPTIONS } from '@/constants/navigation';
import { t } from '@/i18n';

export default function ToolsLayout() {
  return (
    <Stack screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="index" options={{ title: t('nav.tools') }} />
      <Stack.Screen name="nitrox" options={{ title: t('nav.nitrox'), headerLargeTitle: false }} />
      <Stack.Screen name="surface-gf" options={{ title: t('nav.surfaceGf'), headerLargeTitle: false }} />
      {/* Opaque: the result is pinned right under the bar, not scrolling beneath it. */}
      <Stack.Screen
        name="planner"
        options={{ title: t('nav.divePlanner'), headerLargeTitle: false, headerTransparent: false }}
      />
      <Stack.Screen
        name="planner-settings"
        options={{ title: t('nav.plannerSettings'), headerLargeTitle: false }}
      />
      <Stack.Screen name="planner-notes" options={{ title: t('nav.planNotes'), headerLargeTitle: false }} />
      <Stack.Screen
        name="planner-cylinder"
        options={{
          title: t('nav.cylinder'),
          headerLargeTitle: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen name="gas" options={{ title: t('nav.gasCalculator'), headerLargeTitle: false }} />
    </Stack>
  );
}
