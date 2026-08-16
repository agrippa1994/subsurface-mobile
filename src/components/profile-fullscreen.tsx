// AI-generated (Claude)
// The dive profile, given the whole screen while the device is held in
// landscape.
//
// It is a modal rather than another route: the native tab bar belongs to the
// (tabs) layout and cannot be hidden from a screen pushed inside it, and a
// profile sharing the screen with a tab bar is not full screen. A modal is its
// own window, so the chart gets everything.
//
// Being its own window is also why the two providers below are repeated here.
// A React Native modal is a separate native view hierarchy: gestures need a
// GestureHandlerRootView inside it, and the safe area insets have to be measured
// there rather than inherited from the portrait window behind it.
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ProfileChart, type ProfileChartProps } from '@/components/profile-chart';
import { Spacing } from '@/constants/theme';
import { useLandscapeCapable } from '@/hooks/use-landscape';
import { useTheme } from '@/hooks/use-theme';

/**
 * Vertical space the chart's own chrome takes: the scrubber readout above it and
 * the legend plus footnote below. Subtracted from the measured height so the
 * canvas fills what is actually left, since ProfileChart is told a height rather
 * than flexing into one.
 */
const CHROME_HEIGHT = 96;

export type ProfileFullscreenProps = Omit<ProfileChartProps, 'height'> & {
  /** Named above the chart, since the modal covers the navigation bar. */
  title: string;
};

export function ProfileFullscreen({ title, ...chart }: ProfileFullscreenProps) {
  const landscape = useLandscapeCapable();
  const theme = useTheme();
  const [available, setAvailable] = useState(0);

  return (
    <Modal
      visible={landscape}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      // Without these the modal itself stays portrait while the window rotates.
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      // Rotating back is the only way out, and the OS handles that; this is here
      // for the Android back button.
      onRequestClose={() => {}}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
            <Text style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>
              {title}
            </Text>
            <View
              style={styles.body}
              onLayout={(event) => setAvailable(event.nativeEvent.layout.height)}>
              {available > 0 ? (
                <ProfileChart {...chart} height={Math.max(160, available - CHROME_HEIGHT)} />
              ) : null}
            </View>
          </SafeAreaView>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.three,
  },
  title: {
    fontSize: 12,
    paddingTop: Spacing.one,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
});
