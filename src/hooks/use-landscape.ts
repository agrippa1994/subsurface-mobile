// AI-generated (Claude)
// Orientation policy, in one place.
//
// The app is a portrait app everywhere except the dive profile, which is worth
// the whole screen when the device is turned. app.config.ts therefore declares
// every orientation to the platform (the OS will not rotate to an orientation
// the bundle does not list), and the lock below is what actually holds the rest
// of the app upright.
//
// The lock is a device-wide setting rather than a per-screen one, so both hooks
// restore portrait on unmount: leaving a screen must not leave the app rotatable.
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';

/** Holds the app in portrait. Mounted once, at the root. */
export function usePortraitLock() {
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);
}

/**
 * Lets the device rotate while the calling screen is mounted, and returns
 * whether it currently is in landscape.
 *
 * The reading comes from the window rather than from the orientation API: it is
 * the dimension the layout is about to use, and it updates in the same render as
 * the rotation, where an orientation event would arrive a frame later.
 */
export function useLandscapeCapable(enabled = true): boolean {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void ScreenOrientation.unlockAsync();
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [enabled]);

  return enabled && width > height;
}
