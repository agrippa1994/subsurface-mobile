// AI-generated (Claude)
// Useful questions and the way to a chart of one's own, portable variant. iOS has a
// native list, see explore.ios.tsx.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormSection } from '@/components/form';
import { SymbolView, type SFSymbol } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useExploreScreen } from '@/features/statistics/use-explore-screen';
import { useTheme } from '@/hooks/use-theme';

export default function ExploreScreen() {
  const screen = useExploreScreen();
  const theme = useTheme();

  const row = (key: string, icon: string, title: string, detail: string, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <SymbolView name={icon as SFSymbol} size={22} tintColor={theme.accent} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={theme.textSecondary} />
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <FormSection title="Your chart">
        {screen.last
          ? row('last', 'chart.xyaxis.line', screen.last.title, screen.last.detail, screen.openLast)
          : null}
        {row('build', 'slider.horizontal.3', 'Build your own', 'Choose what to compare and how to show it', screen.build)}
      </FormSection>
      <FormSection title="Questions">
        {screen.presets.map((preset) =>
          row(preset.key, preset.icon, preset.title, preset.detail, () => screen.openPreset(preset)),
        )}
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
  },
  detail: {
    fontSize: 13,
  },
});
