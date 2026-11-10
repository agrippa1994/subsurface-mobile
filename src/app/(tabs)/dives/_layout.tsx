// AI-generated (Claude)
// Stack of the Dives tab: the list, a dive pushed on top of it, and the editor
// pushed on top of that; a trip with its editor, and the sheet that picks one.
//
// On a tablet with room for it, the list moves out of the stack into a sidebar beside
// it, the way Mail does. The stack stays the same one in the same place, so resizing
// the window keeps whatever is open; only its first screen changes, from the list to
// a placeholder (see index.tsx). The screen right above that placeholder is the root
// of the detail, so it arrives without a transition and has nothing to go back to.
import { Stack, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { STACK_OPTIONS } from '@/constants/navigation';
import { DiveListScreen } from '@/features/dives/dive-list-screen';
import { useSplitLayout } from '@/hooks/use-adaptive-layout';
import { useTheme } from '@/hooks/use-theme';
import { detailIsBusy } from '@/models/adaptive-layout';

export default function DivesLayout() {
  const { split, sidebarWidth } = useSplitLayout();
  const theme = useTheme();
  const pathname = usePathname();
  const busy = split && detailIsBusy(pathname);

  return (
    <View style={styles.row}>
      {split ? (
        <View
          // Picking a dive now would drop the edit or transfer open in the detail.
          pointerEvents={busy ? 'none' : 'auto'}
          style={{
            width: sidebarWidth,
            opacity: busy ? 0.5 : 1,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: theme.separator,
          }}>
          <DiveListScreen pane />
        </View>
      ) : null}
      <View style={styles.detail}>
        <DivesStack split={split} />
      </View>
    </View>
  );
}

function DivesStack({ split }: { split: boolean }) {
  return (
    <Stack
      screenOptions={({ route, navigation }) => {
        const { routes } = navigation.getState();
        const detailRoot =
          split && routes[0]?.name === 'index' && routes[1]?.key === route.key;
        return detailRoot
          ? {
              ...STACK_OPTIONS,
              headerBackVisible: false,
              gestureEnabled: false,
              animation: 'none',
            }
          : STACK_OPTIONS;
      }}>
      <Stack.Screen name="index" options={{ title: 'Dives' }} />
      <Stack.Screen name="[id]" options={{ title: 'Dive', headerLargeTitle: false }} />
      {/* Where a widget's link lands; it hands over to [id] once the dive is found. */}
      <Stack.Screen name="at/[when]" options={{ title: 'Dive', headerLargeTitle: false }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit dive', headerLargeTitle: false }} />
      <Stack.Screen name="ssi/[id]" options={{ title: 'Sync to SSI', headerLargeTitle: false }} />
      <Stack.Screen name="site/[uuid]" options={{ title: 'Dive site', headerLargeTitle: false }} />
      <Stack.Screen
        name="add"
        // Spelled out: above the placeholder this is the second screen, which the options
        // for the root of the detail would otherwise reach.
        options={{
          title: 'Add Dive',
          headerLargeTitle: false,
          presentation: 'modal',
          animation: 'default',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen name="download" options={{ title: 'Dive computer', headerLargeTitle: false }} />
      <Stack.Screen name="surface-gf" options={{ title: 'Surface GF', headerLargeTitle: false }} />
      <Stack.Screen
        name="trip/[id]"
        options={{ title: 'Trip', headerLargeTitle: false, headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="trip/edit/[id]"
        options={{ title: 'Edit trip', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="trip/pick"
        options={{
          title: 'Add to Trip',
          headerLargeTitle: false,
          animation: 'default',
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 1],
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  detail: {
    flex: 1,
  },
});
