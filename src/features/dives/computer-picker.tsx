// AI-generated (Claude)
// Switches the dive computer a dive is shown from, portable variant (web). Android has computer-picker.android.tsx.
// A row that opens the app's list picker. iOS keeps a native menu, see
// computer-picker.ios.tsx.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { ChoicePicker } from '@/features/dive-computer/choice-picker';
import { useTheme } from '@/hooks/use-theme';
import { computerPositionText } from '@/models/dive-computers';
import { t } from '@/i18n';

export type ComputerPickerProps = {
  /** One name per computer, from computerLabels. */
  labels: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Drops the "Computer" caption, for the title line of the fullscreen profile. */
  compact?: boolean;
  /**
   * Moves the selected computer to the front, offered where the picker has a menu
   * and only for a computer that is not first already. The portable row has none:
   * the dive screen has its own action for it.
   */
  onMakeFirst?: (index: number) => void;
};

export function ComputerPicker({
  labels,
  selectedIndex,
  onSelect,
  compact = false,
}: ComputerPickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const choices = useMemo(
    () => labels.map((label, index) => ({ key: String(index), label, value: index })),
    [labels],
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.diveComputer')}
        accessibilityValue={{
          text: computerPositionText(labels[selectedIndex], selectedIndex, labels.length),
        }}
        accessibilityHint={t('ui.showsTheProfileAndDetailsFrom')}
        onPress={() => setOpen(true)}
        android_ripple={{ color: theme.backgroundSelected }}
        style={[styles.row, compact ? styles.compact : null]}>
        {compact ? null : (
          <Text style={[styles.caption, { color: theme.text }]}>{t('ui.computer')}</Text>
        )}
        <Text style={[styles.value, { color: theme.accent }]} numberOfLines={1}>
          {labels[selectedIndex]}
        </Text>
        <SymbolView name="chevron.up.chevron.down" size={13} tintColor={theme.accent} />
      </Pressable>
      <ChoicePicker
        visible={open}
        title={t('ui.diveComputer')}
        searchable={false}
        choices={choices}
        selectedKey={String(selectedIndex)}
        onSelect={(index) => {
          setOpen(false);
          onSelect(index);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  compact: {
    flexShrink: 1,
  },
  caption: {
    flex: 1,
    fontSize: 17,
  },
  value: {
    flexShrink: 1,
    fontSize: 17,
  },
});
