// AI-generated (Claude)
// Picks the dive site of a dive, and creates one on the spot when the log has
// no matching site yet.
//
// A modal rather than a pushed screen: the choice belongs to the editor behind
// it, and the editor keeps its unsaved draft while this is open. Creating a
// site here goes through the store like any other mutation, so the new site is
// on disk before the dive points at it.

import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeError, formatErrorLine } from '@/models/errors';
import { sortSitesByName, toSiteRow } from '@/models/site-edit';
import { useLogStore } from '@/store/log-store';

export function SitePicker({
  visible,
  selectedUuid,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedUuid: number;
  /** Called with 0 when the dive should have no site. */
  onSelect: (uuid: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const sites = useLogStore((state) => state.sites);
  const saveSite = useLogStore((state) => state.saveSite);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return sortSitesByName(sites)
      .filter((site) => needle === '' || site.name.toLocaleLowerCase().includes(needle))
      .map(toSiteRow);
  }, [query, sites]);

  const name = query.trim();
  const canCreate =
    name !== '' && !sites.some((site) => site.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());

  const create = async () => {
    try {
      const uuid = await saveSite({ name });
      setQuery('');
      onSelect(uuid);
    } catch (caught) {
      setError(formatErrorLine(describeError(caught)));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Dive site</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={Spacing.two}>
            <Text style={[styles.action, { color: theme.accent }]}>Done</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search or name a new site"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          style={[
            styles.search,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <FlatList
          data={rows}
          keyExtractor={(row) => String(row.uuid)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {canCreate ? (
                <Row
                  title={`Create "${name}"`}
                  subtitle="A new site with no position; add one from the Sites tab."
                  onPress={create}
                  accent
                />
              ) : null}
              <Row
                title="No dive site"
                subtitle="Keeps the dive, detaches the place."
                selected={selectedUuid === 0}
                onPress={() => onSelect(0)}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Row
              title={item.title}
              subtitle={`${item.subtitle} - ${item.countText}`}
              selected={item.uuid === selectedUuid}
              onPress={() => onSelect(item.uuid)}
            />
          )}
        />
      </View>
    </Modal>
  );
}

function Row({
  title,
  subtitle,
  selected = false,
  accent = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected?: boolean;
  accent?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.separator },
        pressed ? { backgroundColor: theme.backgroundSelected } : null,
      ]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: accent ? theme.accent : theme.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      {selected ? <Text style={{ color: theme.accent }}>Selected</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  action: {
    fontSize: 17,
    fontWeight: '600',
  },
  search: {
    borderRadius: Spacing.two,
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  error: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTitle: {
    fontSize: 17,
  },
  rowSubtitle: {
    fontSize: 13,
  },
});
