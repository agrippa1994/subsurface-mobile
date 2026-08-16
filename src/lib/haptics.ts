// AI-generated (Claude)
// Haptics, in the three places iOS expects them (task 12, step 1).
//
// The rule followed here is Apple's: feedback confirms something the system
// itself would confirm - a value changing under the finger, an operation
// finishing, an operation failing. Scrolling, navigating and typing get
// nothing, because the OS already handles those and doubling up is noise.
//
// Every call is fire-and-forget and swallows its own failure: a device with
// haptics switched off, or a simulator, must not turn a successful import into
// an error.

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function run(work: () => Promise<void>): void {
  if (!supported) {
    return;
  }
  void work().catch(() => undefined);
}

/** A value changed under the finger: a star tapped, a chip selected. */
export function selectionChanged(): void {
  run(() => Haptics.selectionAsync());
}

/** Something the user waited for finished: an import, an export, a save. */
export function operationSucceeded(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something the user waited for failed. Paired with a message, never alone. */
export function operationFailed(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** A destructive step is about to be confirmed. */
export function warned(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
