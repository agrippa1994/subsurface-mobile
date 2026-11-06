// AI-generated (Claude)
// What the plan comes to, pinned above the form, on every platform.
//
// Its height does not depend on the plan. A warning that appeared above the form
// would push the steppers out from under the thumb that is using them, and the next
// tap would land on something else. So everything in here has its lines reserved,
// and the full list of warnings sits in the form below the controls.
import { StyleSheet, Text, View } from 'react-native';

import { SymbolView } from '@/components/symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlanGasRow, PlanWarning } from '@/models/planner';
import { PLAN_SHORT_DISCLAIMER } from '@/models/planner';

export function PlanSummaryBar({
  runtime,
  depth,
  decoLine,
  gas,
  warnings,
  problem,
}: {
  runtime: string | null;
  depth: string;
  decoLine: string;
  /** The cylinder closest to running out. */
  gas: PlanGasRow | null;
  warnings: readonly PlanWarning[];
  /** Why there is no plan, in place of the figures. */
  problem: string | null;
}) {
  const theme = useTheme();
  const [first] = warnings;
  const alert = problem ?? first?.text ?? null;
  const alertColor = problem || first?.level === 'danger' ? theme.danger : theme.warning;
  const more = warnings.length > 1 ? ` (+${warnings.length - 1} more below)` : '';
  const levelColor =
    gas?.level === 'danger' ? theme.danger : gas?.level === 'caution' ? theme.warning : theme.accent;

  return (
    <View style={[styles.bar, { backgroundColor: theme.background, borderBottomColor: theme.separator }]}>
      <View
        accessible
        accessibilityLabel={
          runtime
            ? `Runtime ${runtime}. ${decoLine}. Maximum depth ${depth}.${gas ? ` ${gas.name}: ${gas.usedText}.` : ''}`
            : 'No plan'
        }
      >
        <View style={styles.headline}>
          <Text style={[styles.runtime, { color: runtime ? theme.text : theme.textSecondary }]}>
            {runtime ?? 'No plan'}
          </Text>
          <Text numberOfLines={1} style={[styles.depth, { color: theme.textSecondary }]}>
            {depth}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.deco, { color: theme.textSecondary }]}>
          {decoLine || ' '}
        </Text>
        <View style={styles.gasLine}>
          <Text numberOfLines={1} style={[styles.gasText, { color: theme.text }]}>
            {gas ? gas.name : ' '}
          </Text>
          <Text numberOfLines={1} style={[styles.gasUsed, { color: theme.textSecondary }]}>
            {gas ? gas.usedText : ''}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(100, (gas?.usedFraction ?? 0) * 100)}%`,
                backgroundColor: levelColor,
              },
            ]}
          />
        </View>
      </View>
      <View
        style={styles.alert}
        accessible={alert !== null}
        accessibilityRole={alert !== null ? 'alert' : undefined}
        accessibilityLiveRegion="polite"
      >
        {alert !== null ? (
          <>
            <SymbolView
              name="exclamationmark.triangle"
              size={16}
              tintColor={alertColor}
              fallback={<Text style={{ color: alertColor }}>!</Text>}
            />
            <Text numberOfLines={2} style={[styles.alertText, { color: alertColor }]}>
              {alert}
              {more}
            </Text>
          </>
        ) : (
          <Text numberOfLines={2} style={[styles.alertText, { color: theme.textSecondary }]}>
            {PLAN_SHORT_DISCLAIMER}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  runtime: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  depth: { fontSize: 20, fontVariant: ['tabular-nums'] },
  deco: { fontSize: 15 },
  gasLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  gasText: { fontSize: 15, flexShrink: 1 },
  gasUsed: { fontSize: 15, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  fill: { height: 6, borderRadius: 3 },
  // Two lines' worth at the base size, whatever is in it.
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    minHeight: 38,
    marginTop: Spacing.one,
  },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
