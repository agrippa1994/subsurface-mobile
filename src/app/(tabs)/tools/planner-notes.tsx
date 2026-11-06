// AI-generated (Claude)
// The core's full notes for the plan on screen, on every platform. Worked out from
// the same draft and settings as the plan screen, so it cannot show an older plan.
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PlanNotesView } from '@/components/plan-notes-view';
import { StatusView } from '@/components/status-view';
import { Spacing } from '@/constants/theme';
import { usePlanner } from '@/features/tools/use-planner';
import { useTheme } from '@/hooks/use-theme';

export default function PlannerNotesScreen() {
  const { outcome } = usePlanner();
  const theme = useTheme();

  if (outcome.kind === 'problem' || outcome.kind === 'error') {
    return <StatusView kind="error" title="No plan to show" description={outcome.message} />;
  }
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <PlanNotesView notes={outcome.result.notes} />
      <Text selectable style={[styles.disclaimer, { color: theme.textSecondary }]}>
        {outcome.result.disclaimer}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
  disclaimer: { fontSize: 13, lineHeight: 18 },
});
