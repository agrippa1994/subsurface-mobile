// AI-generated (Claude)
// The confirmation after a change, with its Undo, for every change there is: it
// listens to the history rather than to any screen, so a new mutation needs nothing
// here. It covers nothing the diver has to deal with, goes away by itself, and leaves
// the same action in the header menu of the Dives tab.
//
// Motion: an occasional, non-gesture appearance, so an ease-out layout animation of
// transform and opacity on the UI thread, which Reanimated reduces to a fade when
// Reduce Motion is on. A finger on it is a shared value and a spring.
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ToastLayer, ToastSurface, useToastColors } from '@/components/toast-surface';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useHistoryActions } from '@/features/history/use-history-actions';
import { subscribeLogbookHistory } from '@/lib/logbook-history';
import { historyToast, type HistoryToast } from '@/models/logbook-history';

const VISIBLE_MS = 5000;
/** VoiceOver has to read it and then find the button. */
const VISIBLE_WITH_SCREEN_READER_MS = 12000;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const DISMISS_DISTANCE = 32;
const DISMISS_VELOCITY = 400;

export function UndoToastHost() {
  const [toast, setToast] = useState<HistoryToast | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(
    () =>
      subscribeLogbookHistory((state) => {
        const next = historyToast(state);
        setToast(next);
        if (next) {
          AccessibilityInfo.announceForAccessibility(next.announcement);
        }
      }),
    [],
  );

  const key = toast?.key;
  useEffect(() => {
    if (key === undefined) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then((reading) => {
      if (!cancelled) {
        timer = setTimeout(() => setToast(null), reading ? VISIBLE_WITH_SCREEN_READER_MS : VISIBLE_MS);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  return (
    <ToastLayer>
      <View
        pointerEvents="box-none"
        style={[
          styles.placement,
          {
            bottom: insets.bottom + BottomTabInset + Spacing.two,
            left: insets.left + Spacing.three,
            right: insets.right + Spacing.three,
          },
        ]}>
        {toast ? <Toast key={toast.key} toast={toast} onDismiss={() => setToast(null)} /> : null}
      </View>
    </ToastLayer>
  );
}

function Toast({ toast, onDismiss }: { toast: HistoryToast; onDismiss: () => void }) {
  const colors = useToastColors();
  const { step } = useHistoryActions();
  const dragged = useSharedValue(0);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onUpdate((event) => {
          // Down only, with some give upwards so that it does not feel stuck.
          dragged.set(event.translationY > 0 ? event.translationY : event.translationY / 6);
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
            scheduleOnRN(onDismiss);
          } else {
            dragged.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: event.velocityY }));
          }
        }),
    [dragged, onDismiss],
  );

  const draggedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragged.get() }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(250).easing(EASE_OUT)}
      exiting={FadeOutDown.duration(180).easing(EASE_OUT)}
      style={styles.width}>
      <GestureDetector gesture={drag}>
        <Animated.View style={draggedStyle}>
          <ToastSurface>
            <View style={styles.row}>
              <Text
                accessibilityRole="alert"
                numberOfLines={2}
                style={[styles.message, { color: colors.text }]}>
                {toast.message}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.actionAccessibilityLabel}
                hitSlop={Spacing.two}
                onPress={() => step(toast.action)}
                style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}>
                <Text style={[styles.actionLabel, { color: colors.action }]}>
                  {toast.actionLabel}
                </Text>
              </Pressable>
            </View>
          </ToastSurface>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  placement: {
    position: 'absolute',
    alignItems: 'center',
  },
  width: {
    width: '100%',
    maxWidth: 520,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingLeft: Spacing.three + Spacing.one,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.one,
  },
  message: {
    flex: 1,
    fontSize: 15,
  },
  action: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.two + Spacing.one,
  },
  pressed: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
