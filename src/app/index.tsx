import * as Device from 'expo-device';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { File, Paths } from 'expo-file-system';

import { add, smokeCountDivesInFile, smokeSerializeMinimalLog } from '../../modules/ssrf-core/src';

// Task 02 plumbing check: calls into the ssrf-core native module, which calls
// Objective-C++, which calls ssrf::add in portable C++ (see the device log for
// "[ssrf-core] C++ add(2, 3)"). Remove with this template screen in task 07.
function getNativeCoreHint() {
  try {
    return <ThemedText type="code">add(2, 3) = {add(2, 3)}</ThemedText>;
  } catch (error) {
    return <ThemedText type="small">unavailable: {String(error)}</ThemedText>;
  }
}

// Task 03/04 check: the vendored Subsurface core serializes a divelog to SSRF
// XML and parses it back, which exercises save-xml, parse-xml and libxml2 on
// device. The full parity run (all 89 logbooks in subsurface/dives/) happens on
// the host via modules/ssrf-core/scripts/build-host.sh. Remove in task 07.
function getCoreRoundTripHint() {
  try {
    const xml = smokeSerializeMinimalLog();
    if (!xml) {
      return <ThemedText type="small">serialization returned nothing</ThemedText>;
    }
    const file = new File(Paths.cache, 'ssrf-smoke.ssrf');
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(xml);
    const dives = smokeCountDivesInFile(file.uri.replace('file://', ''));
    return (
      <ThemedText type="code">
        {xml.length} bytes out, {dives} dive(s) back
      </ThemedText>
    );
  } catch (error) {
    return <ThemedText type="small">unavailable: {String(error)}</ThemedText>;
  }
}

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow title="ssrf-core (C++)" hint={getNativeCoreHint()} />
          <HintRow title="ssrf-core round trip" hint={getCoreRoundTripHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
