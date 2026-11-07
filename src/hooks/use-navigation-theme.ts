// AI-generated (Claude)
// The colours of the navigation bars. iOS draws them from the system; Android has its
// own variant, see use-navigation-theme.android.ts.
import { DarkTheme, DefaultTheme } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';

export function useNavigationTheme() {
  return useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
}

/** What every screen starts from. */
export function useRootScreenOptions() {
  return { headerShown: false };
}

/** What the tab bar is told beyond its icons: nothing here, see the Android variant. */
export function useTabBarStyle() {
  return {};
}
