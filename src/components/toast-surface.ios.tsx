// AI-generated (Claude)
// What a toast sits in, iOS variant: above everything, sheets included, on liquid
// glass where the system has it. The portable variant is toast-surface.tsx.
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';

import { useTheme } from '@/hooks/use-theme';

/** The toast's text and action on this surface. */
export function useToastColors() {
  const theme = useTheme();
  return { text: theme.text, action: theme.accent };
}

export function ToastLayer({ children }: { children: ReactNode }) {
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </GestureHandlerRootView>
    </FullWindowOverlay>
  );
}

export function ToastSurface({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (isLiquidGlassAvailable()) {
    // Tinted: the list scrolling behind it must not read through the words on it.
    return (
      <GlassView style={styles.surface} tintColor={`${theme.backgroundElement}D9`}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.surface, styles.solid, { backgroundColor: theme.backgroundElement }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  solid: {
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  },
});
