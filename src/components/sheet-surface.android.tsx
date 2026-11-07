// AI-generated (Claude)
// What the sheet over the map is made of on Android: a Material bottom sheet's surface.
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { StyleSheet, View } from 'react-native';

export function SheetSurface({ radius }: { radius: number }) {
  const palette = useMaterialColors();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: palette.surfaceContainerLow,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          elevation: 1,
        },
      ]}
    />
  );
}
