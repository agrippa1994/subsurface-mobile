// AI-generated (Claude)
// Loading placeholders for screens built from plain React Native views. A list drawn
// by SwiftUI gets the same effect from `redacted('placeholder')` instead.
//
// Each bar is real text drawn invisible over a grey fill, so it has the exact line
// height of what replaces it and nothing moves when the content arrives.

import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const PULSE = {
  animationName: { from: { opacity: 1 }, to: { opacity: 0.45 } },
  animationDuration: '800ms',
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

/**
 * One pulse for everything inside it, read out as one thing by a screen reader. The
 * pulse runs on the UI thread, so it keeps going while JS parses a large response.
 * With reduced motion the placeholders hold still: their shape already says "loading".
 */
export function SkeletonGroup({
  label,
  style,
  children,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[style, reducedMotion ? null : PULSE]}>
      {children}
    </Animated.View>
  );
}

/** A bar as wide as `text`, in the font of the text it stands in for. */
export function SkeletonText({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return (
    <Text
      style={[
        style,
        styles.bar,
        { color: 'transparent', backgroundColor: theme.backgroundSelected },
      ]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
});
