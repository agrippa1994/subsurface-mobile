// AI-generated (Claude)
// Nitrox calculator, iOS variant: a native Form. The numbers are the core's -
// see src/models/nitrox.ts and `nitroxPlan` in cpp/bindings/api.cpp.
import { Form, Host, LabeledContent, Picker, Section, Stepper, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, monospacedDigit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

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
  PO2_RANGE,
  type Water,
} from '@/models/nitrox';
import { t } from '@/i18n';

const PO2_OPTIONS = [1200, 1300, 1400, 1500, 1600] as const;

export default function NitroxScreen() {
  const screen = useNitroxScreen();
  const theme = useTheme();
  const { input, plan, units } = screen;
  const depthLabel = `${screen.depth} ${screen.depthUnit}`;
  const mix = mixName(input.o2Percent);
  const warning = plan ? nitroxWarning(input, plan) : null;

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title={t('ui.dive')} footer={<Text>{calculatorDisclaimer()}</Text>}>
          <Stepper
            label={`${t('units.quantity.depth')}  ${depthLabel}`}
            value={screen.depth}
            min={screen.depthRange.min}
            max={screen.depthRange.max}
            step={screen.depthRange.step}
            onValueChange={screen.setDepth}
          />
          <Picker
            label={t('ui.water')}
            selection={input.water}
            onSelectionChange={(value: string) => screen.setWater(value as Water)}
            modifiers={[pickerStyle('segmented')]}
          >
            <Text modifiers={[tag('salt')]}>{t('planner.water.salt')}</Text>
            <Text modifiers={[tag('fresh')]}>{t('planner.water.fresh')}</Text>
          </Picker>
        </Section>

        <Section title={t('ui.gas')}>
          <Stepper
            label={`${t('toolsScreen.oxygen')}  ${input.o2Percent}%  (${mix})`}
            value={input.o2Percent}
            min={O2_RANGE.min}
            max={O2_RANGE.max}
            step={O2_RANGE.step}
            onValueChange={screen.setO2Percent}
          />
          <Picker
            label={t('ui.maxPo2')}
            selection={input.maxPo2Mbar}
            onSelectionChange={(value: number) => screen.setMaxPo2Mbar(value)}
            modifiers={[pickerStyle('segmented')]}
          >
            {PO2_OPTIONS.filter((mbar) => mbar >= PO2_RANGE.min && mbar <= PO2_RANGE.max).map(
              (mbar) => (
                <Text key={mbar} modifiers={[tag(mbar)]}>
                  {(mbar / 1000).toFixed(1)}
                </Text>
              ),
            )}
          </Picker>
        </Section>

        {plan ? (
          <>
            <Section
              title={t('ui.depthLimits')}
              footer={
                <Text>
                  Rounded down to the whole {units.depth === 'ft' ? 'foot' : 'metre'}. The best
                  mix is the richest one the max pO2 allows at the planned depth.
                </Text>
              }
            >
              <LabeledContent label={t('toolsScreen.modAt', { po2: formatPo2(input.maxPo2Mbar) })}>
                <Text modifiers={[monospacedDigit()]}>{formatMod(plan.modMm, units)}</Text>
              </LabeledContent>
              <LabeledContent label={t('ui.modAt160Bar')}>
                <Text modifiers={[monospacedDigit()]}>
                  {formatMod(plan.contingencyModMm, units)}
                </Text>
              </LabeledContent>
              <LabeledContent label={t('toolsScreen.po2At', { depth: depthLabel })}>
                <Text modifiers={[monospacedDigit()]}>{formatPo2(plan.po2Mbar)}</Text>
              </LabeledContent>
              <LabeledContent label={t('toolsScreen.bestMixFor', { depth: depthLabel })}>
                <Text>{mixName(Math.min(100, Math.floor(plan.bestMixPermille / 10)))}</Text>
              </LabeledContent>
              {warning ? (
                <Text
                  modifiers={[
                    foregroundStyle(warning.level === 'danger' ? theme.danger : theme.warning),
                  ]}
                >
                  {warning.text}
                </Text>
              ) : null}
            </Section>

            <Section
              title={t('toolsScreen.ndlAt', { depth: depthLabel })}
              footer={
                <Text>
                  {t('toolsScreen.ndlFooter', { gfLow: screen.gfLow, gfHigh: screen.gfHigh })}
                </Text>
              }
            >
              <LabeledContent label={mix}>
                <Text modifiers={[monospacedDigit()]}>{formatNdl(plan.ndlMin)}</Text>
              </LabeledContent>
              <LabeledContent label={t('ui.air')}>
                <Text modifiers={[monospacedDigit()]}>{formatNdl(plan.airNdlMin)}</Text>
              </LabeledContent>
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {ndlComparison(plan)}
              </Text>
            </Section>
          </>
        ) : (
          <Section title={t('ui.result')}>
            <Text>{screen.error ?? t('toolsScreen.unavailable')}</Text>
          </Section>
        )}
      </Form>
    </Host>
  );
}
