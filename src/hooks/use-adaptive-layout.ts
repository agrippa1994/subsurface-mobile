// AI-generated (Claude)
// The window-size decisions of models/adaptive-layout.ts, on the running device.
import { Dimensions, Platform, useWindowDimensions } from 'react-native';

import { isTabletSize, sidebarWidth, splitsAt } from '@/models/adaptive-layout';

const screen = Dimensions.get('screen');

/** A fact about the device, so it does not change with the window. */
export const IS_TABLET =
  Platform.OS === 'ios' ? Platform.isPad : isTabletSize(screen.width, screen.height);

export function useSplitLayout(): { split: boolean; sidebarWidth: number } {
  const { width } = useWindowDimensions();
  return { split: splitsAt(IS_TABLET, width), sidebarWidth: sidebarWidth(width) };
}
