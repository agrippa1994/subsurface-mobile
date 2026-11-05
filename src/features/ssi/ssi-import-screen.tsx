// AI-generated (Claude)
// Bringing dives in from SSI: tick the ones to add, or replace the whole logbook.
//
// The list is computed against the logbook as it stands, so a dive the log already
// has is shown but cannot be ticked. Replacing is the one destructive action and asks
// first, stating how many dives exist nowhere else.

import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormButtonRow, FormSection } from '@/components/form';
import { HeaderAction } from '@/components/header-action';
import { StatusView } from '@/components/status-view';
import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { formatDate } from '@/models/dive-list';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  countDivesOnlyInLog,
  describeSsiImport,
  previewSsiLogbook,
  type SsiDivePreview,
} from '@/models/ssi/ssrf-import';
import { formatDepth, formatDuration, type UnitSystem } from '@/models/units';
import { useDives, useSites } from '@/queries/logbook';
import { useSettings } from '@/queries/settings';
import {
  useImportSelectedSsiDives,
  useReplaceWithSsiLogbook,
  useSsiDownload,
} from '@/queries/ssi';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function SsiImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { unitSystem } = useSettings();

  const download = useSsiDownload();
  const logDives = useDives();
  const logSites = useSites();
  const importDives = useImportSelectedSsiDives();
  const replaceLog = useReplaceWithSsiLogbook();
  const busy = importDives.isPending || replaceLog.isPending;

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const preview = useMemo(
    () =>
      download.data && logDives.data
        ? previewSsiLogbook({
            ...download.data,
            existingDives: logDives.data,
            existingSites: logSites.data ?? [],
          })
        : null,
    [download.data, logDives.data, logSites.data],
  );
  const newKeys = useMemo(
    () => (preview ?? []).filter((dive) => !dive.inLog).map((dive) => dive.key),
    [preview],
  );
  const chosen = newKeys.filter((key) => selected.has(key));

  if (download.isPending || logDives.isPending) {
    return <StatusView kind="loading" title="Reading your SSI logbook" />;
  }
  if (download.isError || !download.data) {
    return (
      <StatusView
        kind="error"
        title="Could not read your SSI logbook"
        description={download.error ? formatErrorLine(describeError(download.error)) : undefined}
        actionLabel="Try again"
        onAction={() => void download.refetch()}
      />
    );
  }
  if (!preview || preview.length === 0) {
    return <StatusView kind="empty" title="No dives in your SSI logbook" />;
  }

  const source = download.data;

  const finish = (title: string, message: string) => {
    operationSucceeded();
    Alert.alert(title, message);
    router.back();
  };
  const fail = (title: string, caught: unknown) => {
    operationFailed();
    Alert.alert(title, formatErrorLine(describeError(caught)));
  };

  const importChosen = () => {
    importDives.mutate(
      { download: source, keys: new Set(chosen) },
      {
        onSuccess: (result) => finish('SSI logbook', describeSsiImport(result)),
        onError: (caught) => fail('Could not import from SSI', caught),
      },
    );
  };

  const replace = () => {
    replaceLog.mutate(source, {
      onSuccess: (result) => finish('Logbook replaced', describeSsiImport(result)),
      onError: (caught) => fail('Could not replace the logbook', caught),
    });
  };

  const confirmReplace = () => {
    const current = logDives.data ?? [];
    const lost = countDivesOnlyInLog(current, preview);
    warned();
    Alert.alert(
      `Replace with ${plural(preview.length, 'SSI dive')}?`,
      `All ${plural(current.length, 'dive')} in this logbook are removed, including your edits and original dive computer data. ` +
        (lost > 0
          ? `${plural(lost, 'dive')} not on SSI will be lost. `
          : 'Every one of them has a copy on SSI. ') +
        'This cannot be undone. Export the logbook first if you may want it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: replace },
      ],
    );
  };

  const toggle = (key: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  };

  const allChosen = newKeys.length > 0 && chosen.length === newKeys.length;

  return (
    <>
      <Stack.Screen options={{ title: 'Add SSI dives' }} />
      <HeaderAction
        label={chosen.length > 0 ? `Import ${chosen.length}` : 'Import'}
        disabled={busy || chosen.length === 0}
        onPress={importChosen}
      />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={preview}
        extraData={selected}
        keyExtractor={(dive) => dive.key}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={theme.accent} />
                <Text style={{ color: theme.textSecondary }}>
                  {replaceLog.isPending ? 'Replacing the logbook...' : 'Importing dives...'}
                </Text>
              </View>
            ) : null}
            <FormSection footer="Removes every dive in this logbook and puts all your SSI dives in its place.">
              <FormButtonRow
                label="Replace logbook with all SSI dives"
                value={String(preview.length)}
                destructive
                onPress={busy ? () => undefined : confirmReplace}
              />
            </FormSection>
            <View style={styles.listTitle}>
              <Text style={[styles.listTitleText, { color: theme.textSecondary }]}>
                {newKeys.length === 0
                  ? 'All SSI dives are in this logbook'
                  : `${plural(newKeys.length, 'new dive')}, ${chosen.length} selected`}
              </Text>
              {newKeys.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={Spacing.two}
                  onPress={() => setSelected(allChosen ? new Set() : new Set(newKeys))}>
                  <Text style={{ color: theme.accent }}>
                    {allChosen ? 'Select none' : 'Select all'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <DiveRow
            dive={item}
            system={unitSystem}
            selected={selected.has(item.key)}
            onToggle={() => toggle(item.key)}
          />
        )}
      />
    </>
  );
}

function DiveRow({
  dive,
  system,
  selected,
  onToggle,
}: {
  dive: SsiDivePreview;
  system: UnitSystem;
  selected: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const title = dive.siteName || 'No dive site';
  const detail = [
    formatDate(dive.when),
    dive.maxDepthMm > 0 ? formatDepth(dive.maxDepthMm, system) : '',
    dive.durationSec > 0 ? formatDuration(dive.durationSec) : '',
  ]
    .filter((part) => part !== '')
    .join(' - ');
  const number = dive.number === null ? '' : `#${dive.number} `;

  return (
    <Pressable
      disabled={dive.inLog}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: dive.inLog }}
      accessibilityLabel={`${number}${title}, ${detail}${dive.inLog ? ', already in the logbook' : ''}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.background },
      ]}>
      {dive.inLog ? (
        <SymbolView name="checkmark" size={20} tintColor={theme.textSecondary} />
      ) : (
        <SymbolView
          name={selected ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          tintColor={selected ? theme.accent : theme.textSecondary}
        />
      )}
      <View style={styles.rowBody}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, { color: dive.inLog ? theme.textSecondary : theme.text }]}>
          {number}
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.rowDetail, { color: theme.textSecondary }]}>
          {dive.inLog ? `${detail} - in logbook` : detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.six,
  },
  header: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  listTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  listTitleText: {
    flexShrink: 1,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTitle: {
    fontSize: 16,
  },
  rowDetail: {
    fontSize: 13,
  },
});
