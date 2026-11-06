// AI-generated (Claude)
// The gas calculator, iOS variant. It is the legacy calculator's table with a live
// answer in place of its Calculate button; the depths are the core's, see
// src/models/gas-calculator.ts and `gasInfo` in cpp/bindings/planner.cpp.
import { Form, Host, LabeledContent, Picker, Section, Stepper, Text, Toggle } from '@expo/ui/swift-ui';
import { foregroundStyle, monospacedDigit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useGasCalculatorScreen } from '@/features/tools/use-gas-calculator-screen';
import { useTheme } from '@/hooks/use-theme';
import { WATER_OPTIONS, type Water } from '@/models/planner';

export default function GasCalculatorScreen() {
  const screen = useGasCalculatorScreen();
  const theme = useTheme();
  const { input } = screen;
  const isPreset = screen.presets.some((preset) => preset.label === screen.mix);

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section title="Gas">
          <Picker
            label="Mix"
            selection={isPreset ? screen.mix : 'Custom'}
            onSelectionChange={(value: string) => screen.setPreset(value)}
            modifiers={[pickerStyle('menu')]}
          >
            {[
              ...(isPreset ? [] : [<Text key="Custom" modifiers={[tag('Custom')]}>{screen.mix}</Text>]),
              ...screen.presets.map((preset) => (
                <Text key={preset.label} modifiers={[tag(preset.label)]}>
                  {preset.label}
                </Text>
              )),
            ]}
          </Picker>
          <Stepper
            label={`Oxygen  ${input.o2Percent}%`}
            value={input.o2Percent}
            {...screen.o2Range}
            onValueChange={screen.setO2}
          />
          <Stepper
            label={`Helium  ${input.hePercent}%`}
            value={input.hePercent}
            {...screen.heRange}
            onValueChange={screen.setHe}
          />
          <Picker
            label="Water"
            selection={input.water}
            onSelectionChange={(value: string) => screen.setWater(value as Water)}
            modifiers={[pickerStyle('segmented')]}
          >
            {WATER_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
          <Toggle label="Oxygen is narcotic" isOn={screen.o2Narcotic} onIsOnChange={screen.setO2Narcotic} />
          {screen.hypoxic ? (
            <Text modifiers={[foregroundStyle(theme.danger)]}>{screen.hypoxic}</Text>
          ) : null}
        </Section>

        {screen.error ? (
          <Section title="Result">
            <Text>{screen.error}</Text>
          </Section>
        ) : (
          <Section
            title={`pO₂ · MOD · ${screen.narcoticLabel}`}
            footer={
              <Text>
                MOD rounded down, END or EAD up. Orange is past the 1.4 bar working limit, red past the
                1.6 bar contingency limit.
              </Text>
            }
          >
            {screen.rows.map((row) => (
              <LabeledContent
                key={row.key}
                label={row.po2}
                modifiers={[
                  foregroundStyle(
                    row.level === 'beyond'
                      ? theme.danger
                      : row.level === 'contingency'
                        ? theme.warning
                        : { type: 'hierarchical', style: 'primary' },
                  ),
                ]}
              >
                <Text modifiers={[monospacedDigit()]}>{`${row.mod}  ·  ${row.narcotic}`}</Text>
              </LabeledContent>
            ))}
          </Section>
        )}

        <Section
          title="Best mix"
          footer={
            <Text>{`The richest oxygen the bottom pO₂ of ${screen.bottomPo2Text} allows, and the helium the best mix END calls for. Both are in the planner settings.`}</Text>
          }
        >
          <Stepper
            label={`Depth  ${screen.bestDepthLabel}`}
            value={screen.bestDepth}
            {...screen.bestDepthRange}
            onValueChange={screen.setBestDepth}
          />
          {screen.bestMix ? (
            <LabeledContent label="Best mix">
              <Text>{screen.bestMix}</Text>
            </LabeledContent>
          ) : null}
        </Section>
      </Form>
    </Host>
  );
}
