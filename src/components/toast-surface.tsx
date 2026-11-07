// AI-generated (Claude)
// What a toast sits in, portable variant: a Material snackbar's surface, over the
// screen it is reporting on. iOS has its own, see toast-surface.ios.tsx.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** The toast's text and action on this surface. */
export function useToastColors() {
  const theme = useTheme();
  return { text: theme.text, action: theme.accent };
}

export function ToastLayer({ children }: { children: ReactNode }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {children}
    </View>
  );
}

export function ToastSurface({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.surface, { backgroundColor: theme.backgroundSelected }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
  },
});
