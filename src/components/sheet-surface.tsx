// AI-generated (Claude)
// What the sheet over the map is made of, portable variant: the background colour
// and a shadow to lift it off the map. iOS has sheet-surface.ios.tsx.
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function SheetSurface({ radius }: { radius: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.background,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.2)',
        },
      ]}
    />
  );
}
