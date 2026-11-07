// AI-generated (Claude)
// The actions a screen puts at the right of its navigation bar, portable
// variant (web; Android draws them in Compose, see header-action.android.tsx). expo-router's Stack.Toolbar draws only bitmap icons on
// Android - no text, no SF Symbols - so they go into the header's
// right slot instead: a Material Symbol icon button, or a text button for a
// labelled action such as "Save". iOS keeps the native toolbar item, see
// header-action.ios.tsx.
import { Stack } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolView, type SFSymbol } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useHistoryMenu } from '@/features/history/use-history-actions';
import { useTheme } from '@/hooks/use-theme';

export type HeaderActionProps = {
  /** What the action does; the visible text, or the accessibility label of an icon. */
  label: string;
  /** Draw an icon instead of the label. */
  icon?: SFSymbol;
  /** The confirming action of a form (iOS draws it prominent). */
  done?: boolean;
  disabled?: boolean;
  /** Pressing it offers these instead of calling `onPress`. */
  items?: HeaderMenuItem[];
  onPress?: () => void;
};

export type HeaderMenuItem = { label: string; icon?: SFSymbol; onPress: () => void };

/** The way out of a sheet, where the back button would be. */
export function HeaderCancel({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const headerLeft = () => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={Spacing.two}>
      <Text style={[styles.label, { color: theme.accent }]}>Cancel</Text>
    </Pressable>
  );
  return <Stack.Screen options={{ headerLeft }} />;
}

export function HeaderAction({ history, ...props }: HeaderActionProps & { history?: boolean }) {
  return <HeaderActions actions={[props]} history={history} />;
}

/**
 * Several actions side by side: the header has one right slot. `history` adds an
 * undo button, while there is anything to undo or redo. It asks which, by name,
 * since this is the one way to get at the history once the toast has gone.
 */
export function HeaderActions({
  actions,
  history = false,
}: {
  actions: HeaderActionProps[];
  history?: boolean;
}) {
  const theme = useTheme();
  const menu = useHistoryMenu();
  const all: HeaderActionProps[] =
    history && menu
      ? [
          {
            label: 'Undo and redo',
            icon: 'arrow.uturn.backward',
            onPress: () =>
              Alert.alert('Undo and redo', undefined, [
                { text: 'Cancel', style: 'cancel' },
                ...(menu.canRedo ? [{ text: menu.redoTitle, onPress: menu.redo }] : []),
                ...(menu.canUndo ? [{ text: menu.undoTitle, onPress: menu.undo }] : []),
              ]),
          },
          ...actions,
        ]
      : actions;
  const headerRight = () => (
    <View style={styles.row}>
      {all.map(({ label, icon, disabled = false, items, onPress }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={
            items
              ? () =>
                  Alert.alert(label, undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    ...items.map((item) => ({ text: item.label, onPress: item.onPress })),
                  ])
              : onPress
          }
          hitSlop={Spacing.two}
          android_ripple={{ color: theme.backgroundSelected, borderless: true }}
          style={[styles.button, disabled ? styles.disabled : null]}>
          {icon ? (
            <SymbolView
              name={icon}
              size={24}
              tintColor={theme.accent}
              fallback={<Text style={[styles.label, { color: theme.accent }]}>{label}</Text>}
            />
          ) : (
            <Text style={[styles.label, { color: theme.accent }]}>{label}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
  return <Stack.Screen options={{ headerRight }} />;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
