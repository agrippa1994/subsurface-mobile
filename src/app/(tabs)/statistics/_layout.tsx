// AI-generated (Claude)
// Stack of the Statistics tab: the overview, questions and the builder, a chart, the
// dives behind a chart item, and a dive opened from there.
import { Stack } from 'expo-router';

import { StatisticsProvider } from '@/features/statistics/statistics-context';

export default function StatisticsLayout() {
  return (
    <StatisticsProvider>
      <Stack screenOptions={{ headerLargeTitle: true }}>
        <Stack.Screen name="index" options={{ title: 'Statistics' }} />
        <Stack.Screen name="explore" options={{ title: 'Explore', headerLargeTitle: false }} />
        <Stack.Screen name="chart" options={{ title: 'Chart', headerLargeTitle: false }} />
        <Stack.Screen
          name="builder"
          options={{
            title: 'Customize',
            headerLargeTitle: false,
            presentation: 'formSheet',
            // Half a screen by default: the chart behind it follows every change. Dimmed:
            // undimmed, its back button can pop the chart from under the sheet.
            sheetAllowedDetents: [0.55, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen name="dives" options={{ title: 'Dives', headerLargeTitle: false }} />
        <Stack.Screen name="dive/[id]" options={{ title: 'Dive', headerLargeTitle: false }} />
        <Stack.Screen name="dive/edit/[id]" options={{ title: 'Edit dive', headerLargeTitle: false }} />
        <Stack.Screen name="dive/ssi/[id]" options={{ title: 'Sync to SSI', headerLargeTitle: false }} />
        <Stack.Screen
          name="dive/trip/[id]"
          options={{ title: 'Trip', headerLargeTitle: false, headerBackButtonDisplayMode: 'minimal' }}
        />
        <Stack.Screen name="dive/trip/edit/[id]" options={{ title: 'Edit trip', headerLargeTitle: false }} />
        <Stack.Screen
          name="dive/trip/pick"
          options={{
            title: 'Add to Trip',
            headerLargeTitle: false,
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.6, 1],
          }}
        />
      </Stack>
    </StatisticsProvider>
  );
}
