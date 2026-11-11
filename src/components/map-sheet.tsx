// AI-generated (Claude)
// A list in a sheet over a map, the way Maps does it: it rests at three stops, the
// map stays usable around it, and the list only scrolls once the sheet is fully open.
// On a tablet with room for it the sheet becomes a panel along the left edge.
//
// Drawn here rather than presented as a native sheet (a formSheet, or @expo/ui's
// BottomSheet): those are modal presentations over the whole window, so they would
// cover the tab bar and stay up when the tab changes. This one belongs to the tab.
//
// The drag lives on the UI thread and moves the sheet by a transform. React only
// hears about the stop it lands on, which is what decides whether the list scrolls.
import { type ReactElement, type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { type FlatList, Keyboard, type ListRenderItem, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { SheetSurface } from '@/components/sheet-surface';
import { Spacing } from '@/constants/theme';
import { useSplitLayout } from '@/hooks/use-adaptive-layout';
import { useTheme } from '@/hooks/use-theme';
import { selectionChanged } from '@/lib/haptics';
import {
  detentAfterDrag,
  nextDetent,
  sheetPositions,
  type SheetDetent,
} from '@/models/sheet-detents';
import { t } from '@/i18n';

/** Hands the worklet below a function of the React Native runtime to call back. */
const dismissKeyboard = () => Keyboard.dismiss();

const RADIUS = 26;
const PANEL_WIDTH = 380;
/** Space between the open sheet and the navigation bar above it. */
const TOP_GAP = Spacing.two;
const SPRING = {
  duration: 300,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};

export type MapSheetHandle = {
  /** Opens the sheet all the way, as when its search field takes focus. */
  expand: () => void;
};

export type MapSheetProps<T> = {
  ref?: Ref<MapSheetHandle>;
  /** Above the list, and all that stays in view at the smallest stop. */
  header: ReactElement;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  ListEmptyComponent?: ReactElement;
};

export function MapSheet<T>(props: MapSheetProps<T>) {
  // Its own provider: the one at the root measures the window, and this has to know
  // what covers this screen, which is the tab bar and the navigation bar as well.
  return (
    <SafeAreaProvider style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <SheetBody {...props} />
    </SafeAreaProvider>
  );
}

function SheetBody<T>({
  ref,
  header,
  data,
  renderItem,
  keyExtractor,
  ListEmptyComponent,
}: MapSheetProps<T>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { split: panel } = useSplitLayout();
  const [areaHeight, setAreaHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  // A panel has the room to show the list from the start.
  const [detent, setDetent] = useState<SheetDetent>(panel ? 'large' : 'medium');
  const list = useRef<FlatList<T>>(null);

  const top = insets.top + TOP_GAP;
  const sheetHeight = Math.max(0, areaHeight - top);
  const positions = useMemo(
    () => sheetPositions({ sheetHeight, areaHeight, headerHeight, bottomInset: insets.bottom }),
    [sheetHeight, areaHeight, headerHeight, insets.bottom],
  );

  const position = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const onHeader = useSharedValue(false);
  const measuredHeader = useSharedValue(0);
  const scrolled = useSharedValue(0);

  // A stop caught is felt. And a list left scrolled at a smaller stop could neither
  // scroll nor let go of the drag, so it goes back to its top.
  const landed = useRef(detent);
  useEffect(() => {
    if (landed.current === detent) {
      return;
    }
    landed.current = detent;
    selectionChanged();
    if (detent !== 'large') {
      list.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [detent]);

  const moveTo = useCallback(
    (next: SheetDetent) => {
      position.set(withSpring(positions[next], SPRING));
      setDetent(next);
    },
    [position, positions],
  );

  useImperativeHandle(ref, () => ({ expand: () => moveTo('large') }), [moveTo]);

  // Follows the stops when they move: rotation, a resized window, the first layout.
  const placed = useRef(false);
  useEffect(() => {
    if (areaHeight === 0 || headerHeight === 0) {
      return;
    }
    position.set(placed.current ? withSpring(positions[detent], SPRING) : positions[detent]);
    placed.current = true;
    // Only the stops: a change of detent has already animated through moveTo or the drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, areaHeight, headerHeight]);

  const nativeList = useMemo(() => Gesture.Native(), []);
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-24, 24])
        .simultaneousWithExternalGesture(nativeList)
        .onBegin((event) => {
          dragStart.set(position.get());
          onHeader.set(event.y < measuredHeader.get());
        })
        .onStart(() => {
          scheduleOnRN(dismissKeyboard);
        })
        .onUpdate((event) => {
          // A scrolled list keeps the drag for itself until it is back at its top;
          // the sheet then follows from there rather than jumping to the finger.
          if (scrolled.get() > 0 && !onHeader.get()) {
            dragStart.set(position.get() - event.translationY);
            return;
          }
          const moved = dragStart.get() + event.translationY;
          position.set(Math.min(positions.small, Math.max(0, moved)));
        })
        .onEnd((event) => {
          const next = detentAfterDrag(position.get(), event.velocityY, positions);
          position.set(withSpring(positions[next], { ...SPRING, velocity: event.velocityY }));
          scheduleOnRN(setDetent, next);
        }),
    [dragStart, measuredHeader, nativeList, onHeader, position, positions, scrolled],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrolled.set(event.contentOffset.y);
  });
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: position.get() }],
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}>
      {areaHeight > 0 ? (
        <GestureDetector gesture={drag}>
          <Animated.View
            style={[
              styles.sheet,
              { top, height: sheetHeight },
              panel ? { left: Spacing.three, width: PANEL_WIDTH } : styles.fullWidth,
              sheetStyle,
            ]}>
            <SheetSurface radius={RADIUS} />
            <View
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                measuredHeader.set(height);
                setHeaderHeight(height);
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('ui.resizeTheList')}
                accessibilityValue={{ text: detentName(detent) }}
                onPress={() => moveTo(nextDetent(detent))}
                style={styles.grabberArea}>
                <View style={[styles.grabber, { backgroundColor: theme.textSecondary }]} />
              </Pressable>
              <View style={styles.header}>{header}</View>
            </View>
            <GestureDetector gesture={nativeList}>
              <Animated.FlatList
                ref={list as never}
                data={data as T[]}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListEmptyComponent={ListEmptyComponent}
                onScroll={onScroll}
                scrollEventThrottle={16}
                scrollEnabled={detent === 'large'}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                // The stops hide the end of the list behind the tab bar only until
                // it is open, which is when this inset applies.
                contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.three }}
                style={styles.list}
              />
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

function detentName(detent: SheetDetent): string {
  return t(`charts.detent.${detent}`);
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
  },
  fullWidth: {
    left: 0,
    right: 0,
  },
  grabberArea: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.4,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  list: {
    flex: 1,
  },
});
