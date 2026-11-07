// AI-generated (Claude)
// The app's colours on Android: the Material You palette of the device, so the React
// Native parts of a screen match the Compose parts and the rest of the system. Compose
// takes the same palette by itself (Host), with the static baseline below Android 12.
//
// The names are the ones every screen already reads; only warning stays fixed, since
// Material has no such role and a warning must not change colour with the wallpaper.
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useMemo } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The palette's colours are #RRGGBBAA and all opaque. Some screens append an alpha of
 * their own to a colour, which only works on the six digit form.
 */
const opaque = (color: string) => color.slice(0, 7);

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = useMaterialColors();
  return useMemo(
    () => ({
      text: opaque(palette.onSurface),
      background: opaque(palette.surface),
      backgroundElement: opaque(palette.surfaceContainer),
      backgroundSelected: opaque(palette.secondaryContainer),
      textSecondary: opaque(palette.onSurfaceVariant),
      accent: opaque(palette.primary),
      warning: Colors[scheme].warning,
      danger: opaque(palette.error),
      separator: opaque(palette.outlineVariant),
    }),
    [palette, scheme],
  );
}
