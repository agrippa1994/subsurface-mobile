// AI-generated (Claude)
// Loading / empty / error placeholder, portable fallback.
//
// iOS gets the system ContentUnavailableView instead - see status-view.ios.tsx.
// This variant is what Android (task 13) and web render.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatusViewProps = {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  /** SF Symbol name; only the iOS variant uses it. */
  systemImage?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatusView({ kind, title, description, actionLabel, onAction }: StatusViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {kind === 'loading' ? <ActivityIndicator /> : null}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
  },
  action: {
    fontSize: 17,
    color: '#0A84FF',
  },
});
