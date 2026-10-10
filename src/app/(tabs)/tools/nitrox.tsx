// AI-generated (Claude)
// Nitrox calculator, portable fallback (Android in task 13, and web). iOS
// renders a native Form instead - see nitrox.ios.tsx.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormSection, OptionField } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useNitroxScreen } from '@/features/tools/use-nitrox-screen';
import { useTheme } from '@/hooks/use-theme';
import {
  formatMod,
  formatNdl,
  formatPo2,
  mixName,
  ndlComparison,
  nitroxWarning,
  O2_RANGE,
  type Water,
} from '@/models/nitrox';

const PO2_OPTIONS = [1200, 1300, 1400, 1500, 1600].map((mbar) => ({
  value: mbar,
  label: (mbar / 1000).toFixed(1),
}));

const WATER_OPTIONS: { value: Water; label: string }[] = [
  { value: 'salt', label: 'Salt' },
  { value: 'fresh', label: 'Fresh' },
];

export default function NitroxScreen() {
  const screen = useNitroxScreen();
  const theme = useTheme();
  const { input, plan, unitSystem } = screen;
  const depthLabel = `${screen.depth} ${screen.depthUnit}`;
  const mix = mixName(input.o2Percent);
  const warning = plan ? nitroxWarning(input, plan) : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <FormSection title="Dive">
        <Stepper
          label={`Depth  ${depthLabel}`}
          value={screen.depth}
          min={screen.depthRange.min}
          max={screen.depthRange.max}
          step={screen.depthRange.step}
          onChange={screen.setDepth}
        />
        <OptionField options={WATER_OPTIONS} value={input.water} onChange={screen.setWater} />
      </FormSection>

      <FormSection title="Gas">
        <Stepper
          label={`Oxygen  ${input.o2Percent}%  (${mix})`}
          value={input.o2Percent}
          min={O2_RANGE.min}
          max={O2_RANGE.max}
          step={O2_RANGE.step}
          onChange={screen.setO2Percent}
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Max pO2 (bar)</Text>
        <OptionField
          options={PO2_OPTIONS}
          value={input.maxPo2Mbar}
          onChange={screen.setMaxPo2Mbar}
        />
      </FormSection>

      {plan ? (
        <>
          <FormSection
            title="Depth limits"
            footer={`Rounded down to the whole ${unitSystem === 'imperial' ? 'foot' : 'metre'}. The best mix is the richest one the max pO2 allows at the planned depth.`}
          >
            <Row
              label={`MOD at ${formatPo2(input.maxPo2Mbar)}`}
              value={formatMod(plan.modMm, unitSystem)}
            />
            <Row label="MOD at 1.60 bar" value={formatMod(plan.contingencyModMm, unitSystem)} />
            <Row label={`pO2 at ${depthLabel}`} value={formatPo2(plan.po2Mbar)} />
            <Row
              label={`Best mix for ${depthLabel}`}
              value={mixName(Math.min(100, Math.floor(plan.bestMixPermille / 10)))}
            />
            {warning ? (
              <Text style={{ color: warning.level === 'danger' ? theme.danger : theme.warning }}>
                {warning.text}
              </Text>
            ) : null}
          </FormSection>

          <FormSection
            title={`No-deco limit at ${depthLabel}`}
            footer={`Buehlmann ZHL-16C with gradient factors ${screen.gfLow}/${screen.gfHigh} from Settings, for a square dive: arriving at the depth and staying there. A planning aid, not a substitute for a dive computer.`}
          >
            <Row label={mix} value={formatNdl(plan.ndlMin)} />
            <Row label="Air" value={formatNdl(plan.airNdlMin)} />
            <Text style={{ color: theme.textSecondary }}>{ndlComparison(plan)}</Text>
          </FormSection>
        </>
      ) : (
        <FormSection title="Result">
          <Text style={{ color: theme.text }}>
            {screen.error ?? 'The calculation is unavailable.'}
          </Text>
        </FormSection>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  );
}

// Stands in for the iOS variant's native Stepper.
function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  const button = (text: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text === '-' ? 'Decrease' : 'Increase'} ${label}`}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.stepButton, { backgroundColor: theme.backgroundSelected }]}
    >
      <Text style={{ color: disabled ? theme.textSecondary : theme.text }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.stepButtons}>
        {button('-', Math.max(min, value - step), value <= min)}
        {button('+', Math.min(max, value + step), value >= max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  label: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  rowLabel: {
    flexShrink: 1,
    fontSize: 17,
  },
  rowValue: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  stepButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
});
