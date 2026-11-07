// AI-generated (Claude)
// What the sheet over the map is made of, iOS variant: liquid glass where the system
// has it, tinted so rows stay readable over a busy map. The portable variant is
// sheet-surface.tsx.
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function SheetSurface({ radius }: { radius: number }) {
  const theme = useTheme();
  const shape = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderCurve: 'continuous',
  } as const;
  return isLiquidGlassAvailable() ? (
    <GlassView
      style={[StyleSheet.absoluteFill, shape]}
      tintColor={`${theme.background}B3`}
    />
  ) : (
    <View style={[StyleSheet.absoluteFill, shape, { backgroundColor: theme.background }]} />
  );
}
