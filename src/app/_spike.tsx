// AI-generated (Claude)
//
// Throwaway liquid-glass spike (task 01, step 5). Validates that @expo/ui native
// SwiftUI controls render over an iOS 26 liquid-glass surface on a real device.
// Isolated on purpose: delete or gate this screen before task 07.
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Button, Host, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundColor } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SpikeScreen() {
  const glass = isLiquidGlassAvailable();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <GlassView style={styles.glass} glassEffectStyle="regular" isInteractive>
          <Host matchContents style={styles.host}>
            <VStack spacing={16} alignment="center">
              <Text modifiers={[font({ size: 22, weight: 'semibold' })]}>
                Subsurface liquid-glass spike
              </Text>
              <Text modifiers={[foregroundColor('#8E8E93')]}>
                {glass
                  ? 'Liquid glass available on this device.'
                  : 'Liquid glass unavailable - showing fallback material.'}
              </Text>
              <Button
                label="Native @expo/ui button"
                modifiers={[buttonStyle('glassProminent')]}
                onPress={() => {}}
              />
              <Button
                label="Glass button"
                systemImage="water.waves"
                modifiers={[buttonStyle('glass')]}
                onPress={() => {}}
              />
            </VStack>
          </Host>
        </GlassView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glass: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
  },
  host: {
    alignSelf: 'stretch',
  },
});
