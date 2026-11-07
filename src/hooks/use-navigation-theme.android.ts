// AI-generated (Claude)
// The navigation bars and the bottom navigation bar on Android, in the device's
// Material You palette rather than React Navigation's blue.
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { DarkTheme, DefaultTheme } from 'expo-router';
import { useMemo } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

export function useNavigationTheme() {
  const base = useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
  const palette = useMaterialColors();
  return useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.surface,
        card: palette.surface,
        text: palette.onSurface,
        border: palette.outlineVariant,
        notification: palette.error,
      },
    }),
    [base, palette],
  );
}

/**
 * What every screen starts from. Spells out the status bar's icons: the window's theme
 * leaves them light whatever the appearance, which cannot be read on a light surface.
 */
export function useRootScreenOptions() {
  const dark = useColorScheme() === 'dark';
  return { headerShown: false, statusBarStyle: dark ? ('light' as const) : ('dark' as const) };
}

export function useTabBarStyle() {
  const palette = useMaterialColors();
  return {
    backgroundColor: palette.surfaceContainer,
    tintColor: palette.onSecondaryContainer,
    iconColor: palette.onSurfaceVariant,
    indicatorColor: palette.secondaryContainer,
    labelStyle: { color: palette.onSurfaceVariant },
    labelVisibilityMode: 'labeled' as const,
  };
}
