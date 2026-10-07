// AI-generated (Claude)
// The "same as last time" card at the top of the dive editor.
//
// On a trip the buddy, the tank and the lead rarely change between dives, so
// the card offers the previous dive's values as one-tap copies: one tile per
// kind, plus "Copy all" for the common case of a freshly imported dive. A tile
// only appears when the previous dive has something for it, and a copied tile
// turns into a checkmark so the tap visibly did something - the values
// themselves land further down the form, usually off screen.
//
// Nothing is saved here: the copies go into the form, where they can still be
// corrected before Save.

import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { selectionChanged } from '@/lib/haptics';
import { formatGasMix, formatWeight, type Dive, type UnitSystem } from '@/models';
import { formatNameList, parseNameList } from '@/models/dive-edit';
import { toDiveRow } from '@/models/dive-list';

type CopyKind = 'buddies' | 'cylinders' | 'weights';

type CopyAction = {
  kind: CopyKind;
  label: string;
  value: string;
  symbol: SymbolViewProps['name'];
  run: () => void;
};

export function PreviousDiveCard({
  previous,
  unitSystem,
  onCopyBuddies,
  onCopyCylinders,
  onCopyWeights,
}: {
  previous: Dive;
  unitSystem: UnitSystem;
  onCopyBuddies: () => void;
  onCopyCylinders: () => void;
  onCopyWeights: () => void;
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState<ReadonlySet<CopyKind>>(new Set());

  const actions: CopyAction[] = (
    [
      {
        kind: 'buddies',
        label: 'Buddies',
        value: formatNameList([
          ...parseNameList(previous.buddy),
          ...parseNameList(previous.diveguide),
        ]),
        symbol: 'person.2.fill',
        run: onCopyBuddies,
      },
      {
        kind: 'cylinders',
        label: 'Cylinders',
        value: previous.cylinders
          .map(
            (cylinder) =>
              cylinder.description.trim() ||
              formatGasMix(cylinder.gasmix.o2Permille, cylinder.gasmix.hePermille)
          )
          .join(', '),
        symbol: 'cylinder.fill',
        run: onCopyCylinders,
      },
      {
        kind: 'weights',
        label: 'Weights',
        value:
          previous.weightsystems.length > 0
            ? formatWeight(
                previous.weightsystems.reduce((sum, weight) => sum + weight.weightGrams, 0),
                unitSystem
              )
            : '',
        symbol: 'scalemass.fill',
        run: onCopyWeights,
      },
    ] satisfies CopyAction[]
  ).filter((action) => action.value !== '');

  if (actions.length === 0) {
    return null;
  }

  const copy = (selected: readonly CopyAction[]) => {
    selectionChanged();
    selected.forEach((action) => action.run());
    setCopied((done) => new Set([...done, ...selected.map((action) => action.kind)]));
  };

  const row = toDiveRow(previous, unitSystem);
  const allCopied = actions.every((action) => copied.has(action.kind));

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.header}>
        <SymbolView
          name="clock.arrow.circlepath"
          size={22}
          tintColor={theme.accent}
          fallback={null}
        />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>Same as previous dive</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {[row.numberText, row.title].filter(Boolean).join(' ')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {row.dateText}, {row.timeText}
          </Text>
        </View>
        {actions.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy everything from the previous dive"
            onPress={() => copy(actions)}
            style={({ pressed }) => [
              styles.allButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={styles.allButtonText}>{allCopied ? 'Copied' : 'Copy all'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tiles}>
        {actions.map((action) => {
          const done = copied.has(action.kind);
          return (
            <Pressable
              key={action.kind}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${action.label.toLowerCase()}: ${action.value}`}
              accessibilityState={{ checked: done }}
              onPress={() => copy([action])}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: pressed ? theme.backgroundSelected : theme.background,
                  borderColor: done ? theme.accent : theme.separator,
                },
              ]}>
              <View style={styles.tileHeader}>
                <SymbolView
                  name={done ? 'checkmark.circle.fill' : action.symbol}
                  size={15}
                  tintColor={theme.accent}
                  fallback={null}
                />
                <Text style={[styles.tileLabel, { color: theme.accent }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </View>
              <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1}>
                {action.value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
  },
  allButton: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two - Spacing.half,
  },
  allButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    borderRadius: Spacing.two + Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tileValue: {
    fontSize: 15,
  },
});
