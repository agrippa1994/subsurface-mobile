// AI-generated (Claude)
// A modal list to pick one string or device from: there are a few dozen vendors and
// products, which is too many for a menu and too few to need more than a filter.

import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export type Choice<T> = { key: string; label: string; detail?: string; value: T };

export function ChoicePicker<T>({
  visible,
  title,
  choices,
  selectedKey,
  searchable = true,
  emptyText,
  footer,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  choices: readonly Choice<T>[];
  selectedKey?: string;
  searchable?: boolean;
  emptyText?: string;
  /** Under the list: what the connection picker keeps its rescan in. */
  footer?: React.ReactNode;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return choices.filter(
      (choice) => needle === '' || choice.label.toLocaleLowerCase().includes(needle),
    );
  }, [choices, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={Spacing.two}>
            <Text style={[styles.action, { color: theme.accent }]}>{t('ui.done')}</Text>
          </Pressable>
        </View>
        {searchable ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('ui.search')}
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />
        ) : null}
        <FlatList
          data={rows}
          keyExtractor={(choice) => choice.key}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            emptyText ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>{emptyText}</Text>
            ) : undefined
          }
          ListFooterComponent={footer ? <View style={styles.footer}>{footer}</View> : undefined}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item.key === selectedKey }}
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.separator },
                pressed ? { opacity: 0.6 } : null,
              ]}>
              <View style={styles.rowText}>
                <Text style={{ color: theme.text, fontSize: 17 }}>{item.label}</Text>
                {item.detail ? (
                  <Text style={[styles.detail, { color: theme.textSecondary }]}>{item.detail}</Text>
                ) : null}
              </View>
              {item.key === selectedKey ? (
                <SymbolView name="checkmark" size={18} tintColor={theme.accent} />
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  title: { fontSize: 20, fontWeight: '600' },
  action: { fontSize: 17, fontWeight: '600' },
  search: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.two,
    borderRadius: 10,
    fontSize: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1 },
  detail: { fontSize: 13, marginTop: 2 },
  empty: { padding: Spacing.three, textAlign: 'center' },
  footer: { padding: Spacing.three },
});
