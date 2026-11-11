// AI-generated (Claude)
// The top of the sidebar on a tablet: what the navigation bar is everywhere else.
//
// The sidebar sits beside the tab's stack rather than inside it, so it has no bar
// of its own to put a title and bar buttons in. Expo Router's SplitView would give
// it one, but refuses to run inside another native navigator, and these tabs are.
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HeaderActionProps } from '@/components/header-action';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SearchField } from '@/components/search-field';
import { Spacing } from '@/constants/theme';
import { useHistoryMenu } from '@/features/history/use-history-actions';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export function PaneHeader({
  title,
  actions,
  history = false,
  search,
}: {
  title: string;
  actions: HeaderActionProps[];
  history?: boolean;
  search?: { value: string; onChangeText: (text: string) => void; placeholder: string };
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const menu = useHistoryMenu();

  return (
    // The inset already clears the tab bar, which iPadOS floats along the top.
    <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.titleLine}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.actions}>
          {history && menu?.canUndo ? (
            <HeaderIconButton label={menu.undoTitle} icon="arrow.uturn.backward" onPress={menu.undo} />
          ) : null}
          {history && menu?.canRedo ? (
            <HeaderIconButton label={menu.redoTitle} icon="arrow.uturn.forward" onPress={menu.redo} />
          ) : null}
          {actions.map(({ label, icon, done, disabled, items, onPress }) =>
            icon ? (
              <HeaderIconButton
                key={label}
                label={label}
                icon={icon}
                onPress={() => {
                  if (items) {
                    // As the portable header action asks. A native bar menu needs the
                    // navigation bar this pane does not have.
                    Alert.alert(label, undefined, [
                      { text: t('ui.cancel'), style: 'cancel' },
                      ...items.map((item) => ({ text: item.label, onPress: item.onPress })),
                    ]);
                  } else {
                    onPress?.();
                  }
                }}
              />
            ) : (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                hitSlop={Spacing.two}
                onPress={onPress}
                style={styles.textAction}>
                <Text style={[styles.textLabel, done ? styles.done : null, { color: theme.accent }]}>
                  {label}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      </View>
      {search ? <SearchField {...search} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textAction: {
    paddingHorizontal: Spacing.two,
  },
  textLabel: {
    fontSize: 17,
  },
  done: {
    fontWeight: '600',
  },
});
