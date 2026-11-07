// AI-generated (Claude)
// What every tab's stack asks of its navigation bar. iOS collapses a large title; on
// Android, which has none, a Material top app bar sits flat on the screen below it.
import { Platform } from 'react-native';

export const STACK_OPTIONS = {
  headerLargeTitle: true,
  ...(Platform.OS === 'android' ? { headerShadowVisible: false } : {}),
};
