// AI-generated (Claude)
// What a toast sits in on Android: a Material snackbar's inverse surface.
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export function ToastLayer({ children }: { children: ReactNode }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {children}
    </View>
  );
}

/** The toast's text and action on this surface. */
export function useToastColors() {
  const palette = useMaterialColors();
  return { text: palette.inverseOnSurface, action: palette.inversePrimary };
}

export function ToastSurface({ children }: { children: ReactNode }) {
  const palette = useMaterialColors();
  return (
    <View style={[styles.surface, { backgroundColor: palette.inverseSurface }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 6,
  },
});
