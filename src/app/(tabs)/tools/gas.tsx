// AI-generated (Claude)
// The gas calculator, portable fallback. iOS renders a native Form, see gas.ios.tsx.
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormSection, OptionField } from '@/components/form';
import { StepperRow } from '@/components/stepper-row';
import { Spacing } from '@/constants/theme';
import { useGasCalculatorScreen } from '@/features/tools/use-gas-calculator-screen';
import { useTheme } from '@/hooks/use-theme';
import { CALCULATOR_DISCLAIMER } from '@/models/disclaimer';
import { WATER_OPTIONS } from '@/models/planner';

export default function GasCalculatorScreen() {
  const screen = useGasCalculatorScreen();
  const theme = useTheme();
  const { input } = screen;
  const color = (level: string) =>
    level === 'beyond' ? theme.danger : level === 'contingency' ? theme.warning : theme.text;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <FormSection title="Gas" footer={CALCULATOR_DISCLAIMER}>
        <OptionField
          options={screen.presets.map((preset) => ({ value: preset.label, label: preset.label }))}
          value={screen.mix}
          onChange={screen.setPreset}
        />
        <StepperRow
          label={`Oxygen  ${input.o2Percent}%`}
          value={input.o2Percent}
          {...screen.o2Range}
          onChange={screen.setO2}
        />
        <StepperRow
          label={`Helium  ${input.hePercent}%`}
          value={input.hePercent}
          {...screen.heRange}
          onChange={screen.setHe}
        />
        <OptionField options={WATER_OPTIONS} value={input.water} onChange={screen.setWater} />
        <View style={styles.row}>
          <Text style={{ color: theme.text }}>Oxygen is narcotic</Text>
          <Switch
            accessibilityLabel="Oxygen is narcotic"
            value={screen.o2Narcotic}
            onValueChange={screen.setO2Narcotic}
          />
        </View>
        {screen.hypoxic ? (
          <Text accessibilityRole="alert" style={{ color: theme.danger }}>
            {screen.hypoxic}
          </Text>
        ) : null}
      </FormSection>

      {screen.error ? (
        <FormSection title="Result">
          <Text style={{ color: theme.text }}>{screen.error}</Text>
        </FormSection>
      ) : (
        <FormSection
          title={`pO₂ · MOD · ${screen.narcoticLabel}`}
          footer="MOD rounded down, END or EAD up. Orange is past the 1.4 bar working limit, red past the 1.6 bar contingency limit."
        >
          {screen.rows.map((row) => (
            <View
              key={row.key}
              style={styles.row}
              accessible
              accessibilityLabel={`pO2 ${row.po2}, maximum depth ${row.mod}, ${screen.narcoticLabel} ${row.narcotic}`}
            >
              <Text style={{ color: color(row.level) }}>{row.po2}</Text>
              <Text style={[styles.value, { color: color(row.level) }]}>
                {`${row.mod}  ·  ${row.narcotic}`}
              </Text>
            </View>
          ))}
        </FormSection>
      )}

      <FormSection
        title="Best mix"
        footer={`The richest oxygen the bottom pO₂ of ${screen.bottomPo2Text} allows, and the helium the best mix END calls for. Both are in the planner settings.`}
      >
        <StepperRow
          label={`Depth  ${screen.bestDepthLabel}`}
          value={screen.bestDepth}
          {...screen.bestDepthRange}
          onChange={screen.setBestDepth}
        />
        {screen.bestMix ? (
          <View style={styles.row}>
            <Text style={{ color: theme.text }}>Best mix</Text>
            <Text style={{ color: theme.textSecondary }}>{screen.bestMix}</Text>
          </View>
        ) : null}
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: { fontVariant: ['tabular-nums'] },
});
