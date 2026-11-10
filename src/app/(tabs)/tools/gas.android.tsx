// AI-generated (Claude)
// The gas calculator, Android variant, in Compose. It is the legacy calculator's table
// with a live answer in place of its Calculate button; the depths are the core's, see
// src/models/gas-calculator.ts and `gasInfo` in cpp/bindings/planner.cpp.
import { useMaterialColors } from '@expo/ui/jetpack-compose';

import {
  M3MenuRow,
  M3Note,
  M3Screen,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
  M3SwitchRow,
  M3ValueRow,
} from '@/components/material/list';
import { useGasCalculatorScreen } from '@/features/tools/use-gas-calculator-screen';
import { useTheme } from '@/hooks/use-theme';
import { CALCULATOR_DISCLAIMER } from '@/models/disclaimer';
import { WATER_OPTIONS } from '@/models/planner';

export default function GasCalculatorScreen() {
  const screen = useGasCalculatorScreen();
  const theme = useTheme();
  const palette = useMaterialColors();
  const { input } = screen;

  return (
    <M3Screen>
      <M3Section title="Gas" footer={CALCULATOR_DISCLAIMER}>
        <M3MenuRow
          label="Mix"
          value={screen.mix}
          shown={screen.mix}
          options={screen.presets.map((preset) => ({ value: preset.label, label: preset.label }))}
          onChange={screen.setPreset}
        />
        <M3StepperRow
          label={`Oxygen  ${input.o2Percent}%`}
          value={input.o2Percent}
          {...screen.o2Range}
          onChange={screen.setO2}
        />
        <M3StepperRow
          label={`Helium  ${input.hePercent}%`}
          value={input.hePercent}
          {...screen.heRange}
          onChange={screen.setHe}
        />
        <M3SegmentedRow
          label="Water"
          options={WATER_OPTIONS}
          value={input.water}
          onChange={screen.setWater}
        />
        <M3SwitchRow
          label="Oxygen is narcotic"
          value={screen.o2Narcotic}
          onChange={screen.setO2Narcotic}
        />
        {screen.hypoxic ? <M3Note color={palette.error}>{screen.hypoxic}</M3Note> : null}
      </M3Section>

      {screen.error ? (
        <M3Section title="Result">
          <M3Note>{screen.error}</M3Note>
        </M3Section>
      ) : (
        <M3Section
          title={`pO₂ · MOD · ${screen.narcoticLabel}`}
          footer="MOD rounded down, END or EAD up. Orange is past the 1.4 bar working limit, red past the 1.6 bar contingency limit.">
          {screen.rows.map((row) => (
            <M3ValueRow
              key={row.key}
              inline
              label={row.po2}
              value={`${row.mod}  ·  ${row.narcotic}`}
              color={
                row.level === 'beyond'
                  ? palette.error
                  : row.level === 'contingency'
                    ? theme.warning
                    : undefined
              }
            />
          ))}
        </M3Section>
      )}

      <M3Section
        title="Best mix"
        footer={`The richest oxygen the bottom pO₂ of ${screen.bottomPo2Text} allows, and the helium the best mix END calls for. Both are in the planner settings.`}>
        <M3StepperRow
          label={`Depth  ${screen.bestDepthLabel}`}
          value={screen.bestDepth}
          {...screen.bestDepthRange}
          onChange={screen.setBestDepth}
        />
        {screen.bestMix ? <M3ValueRow inline label="Best mix" value={screen.bestMix} /> : null}
      </M3Section>
    </M3Screen>
  );
}
