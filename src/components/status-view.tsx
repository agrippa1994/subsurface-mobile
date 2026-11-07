// AI-generated (Claude)
// Loading / empty / error placeholder, portable fallback.
//
// iOS gets the system ContentUnavailableView instead - see status-view.ios.tsx.
// This variant is what web renders; Android has status-view.android.tsx.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolView, type SFSymbol } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatusViewProps = {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  /** SF Symbol name; drawn as its Material Symbol on Android. */
  systemImage?: SFSymbol;
  actionLabel?: string;
  onAction?: () => void;
  /** A second way forward, drawn with less weight than the first. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export function StatusView({
  kind,
  title,
  description,
  systemImage,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: StatusViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {kind === 'loading' ? <ActivityIndicator color={theme.accent} /> : null}
      {kind !== 'loading' && systemImage ? (
        <SymbolView name={systemImage} size={48} tintColor={theme.textSecondary} fallback={null} />
      ) : null}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <Pressable onPress={onSecondaryAction} accessibilityRole="button">
          <Text style={styles.action}>{secondaryActionLabel}</Text>
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
