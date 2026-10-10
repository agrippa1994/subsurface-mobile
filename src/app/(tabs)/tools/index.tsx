// AI-generated (Claude)
// The Tools tab, portable fallback (Android in task 13, and web). iOS renders
// a native Form instead - see index.ios.tsx.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { TOOLS } from '@/features/tools/tools';
import { useTheme } from '@/hooks/use-theme';

export default function ToolsScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <FormSection title="Planning">
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.key}
            accessibilityRole="button"
            onPress={() => router.push(tool.href)}
            style={({ pressed }) => [styles.row, pressed ? { opacity: 0.6 } : null]}
          >
            <Text style={[styles.title, { color: theme.text }]}>{tool.title}</Text>
            <Text style={[styles.summary, { color: theme.textSecondary }]}>{tool.summary}</Text>
          </Pressable>
        ))}
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  row: {
    gap: Spacing.half,
  },
  title: {
    fontSize: 17,
  },
  summary: {
    fontSize: 13,
  },
});
