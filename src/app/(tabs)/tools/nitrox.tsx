// AI-generated (Claude)
// Nitrox calculator, portable fallback (web). Android has nitrox.android.tsx. iOS
// renders a native Form instead - see nitrox.ios.tsx.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormSection, OptionField } from '@/components/form';
import { StepperRow as Stepper } from '@/components/stepper-row';
import { Spacing } from '@/constants/theme';
import { useNitroxScreen } from '@/features/tools/use-nitrox-screen';
import { useTheme } from '@/hooks/use-theme';
import { calculatorDisclaimer } from '@/models/disclaimer';
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
import { labelled, t } from '@/i18n';

const PO2_OPTIONS = [1200, 1300, 1400, 1500, 1600].map((mbar) => ({
  value: mbar,
  label: (mbar / 1000).toFixed(1),
}));

const WATER_OPTIONS: { value: Water; readonly label: string }[] = [
  labelled({ value: 'salt' as Water }, () => t('planner.water.salt')),
  labelled({ value: 'fresh' as Water }, () => t('planner.water.fresh')),
];

export default function NitroxScreen() {
  const screen = useNitroxScreen();
  const theme = useTheme();
  const { input, plan, units } = screen;
  const depthLabel = `${screen.depth} ${screen.depthUnit}`;
  const mix = mixName(input.o2Percent);
  const warning = plan ? nitroxWarning(input, plan) : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <FormSection title={t('ui.dive')} footer={calculatorDisclaimer()}>
        <Stepper
          label={`${t('units.quantity.depth')}  ${depthLabel}`}
          value={screen.depth}
          min={screen.depthRange.min}
          max={screen.depthRange.max}
          step={screen.depthRange.step}
          onChange={screen.setDepth}
        />
        <OptionField options={WATER_OPTIONS} value={input.water} onChange={screen.setWater} />
      </FormSection>

      <FormSection title={t('ui.gas')}>
        <Stepper
          label={`${t('toolsScreen.oxygen')}  ${input.o2Percent}%  (${mix})`}
          value={input.o2Percent}
          min={O2_RANGE.min}
          max={O2_RANGE.max}
          step={O2_RANGE.step}
          onChange={screen.setO2Percent}
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>{t('toolsScreen.maxPo2Bar')}</Text>
        <OptionField
          options={PO2_OPTIONS}
          value={input.maxPo2Mbar}
          onChange={screen.setMaxPo2Mbar}
        />
      </FormSection>

      {plan ? (
        <>
          <FormSection
            title={t('ui.depthLimits')}
            footer={units.depth === 'ft' ? t('toolsScreen.roundedFoot') : t('toolsScreen.roundedMetre')}
          >
            <Row
              label={t('toolsScreen.modAt', { po2: formatPo2(input.maxPo2Mbar) })}
              value={formatMod(plan.modMm, units)}
            />
            <Row label={t('ui.modAt160Bar')} value={formatMod(plan.contingencyModMm, units)} />
            <Row label={t('toolsScreen.po2At', { depth: depthLabel })} value={formatPo2(plan.po2Mbar)} />
            <Row
              label={t('toolsScreen.bestMixFor', { depth: depthLabel })}
              value={mixName(Math.min(100, Math.floor(plan.bestMixPermille / 10)))}
            />
            {warning ? (
              <Text style={{ color: warning.level === 'danger' ? theme.danger : theme.warning }}>
                {warning.text}
              </Text>
            ) : null}
          </FormSection>

          <FormSection
            title={t('toolsScreen.ndlAt', { depth: depthLabel })}
            footer={t('toolsScreen.ndlFooter', { gfLow: screen.gfLow, gfHigh: screen.gfHigh })}
          >
            <Row label={mix} value={formatNdl(plan.ndlMin)} />
            <Row label={t('ui.air')} value={formatNdl(plan.airNdlMin)} />
            <Text style={{ color: theme.textSecondary }}>{ndlComparison(plan)}</Text>
          </FormSection>
        </>
      ) : (
        <FormSection title={t('ui.result')}>
          <Text style={{ color: theme.text }}>
            {screen.error ?? t('toolsScreen.unavailable')}
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
});
