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
import { calculatorDisclaimer } from '@/models/disclaimer';
import { WATER_OPTIONS } from '@/models/planner';
import { t } from '@/i18n';

export default function GasCalculatorScreen() {
  const screen = useGasCalculatorScreen();
  const theme = useTheme();
  const palette = useMaterialColors();
  const { input } = screen;

  return (
    <M3Screen>
      <M3Section title={t('ui.gas')} footer={calculatorDisclaimer()}>
        <M3MenuRow
          label={t('ui.mix')}
          value={screen.mix}
          shown={screen.mix}
          options={screen.presets.map((preset) => ({ value: preset.label, label: preset.label }))}
          onChange={screen.setPreset}
        />
        <M3StepperRow
          label={`${t('toolsScreen.oxygen')}  ${input.o2Percent}%`}
          value={input.o2Percent}
          {...screen.o2Range}
          onChange={screen.setO2}
        />
        <M3StepperRow
          label={`${t('toolsScreen.helium')}  ${input.hePercent}%`}
          value={input.hePercent}
          {...screen.heRange}
          onChange={screen.setHe}
        />
        <M3SegmentedRow
          label={t('ui.water')}
          options={WATER_OPTIONS}
          value={input.water}
          onChange={screen.setWater}
        />
        <M3SwitchRow
          label={t('ui.oxygenIsNarcotic')}
          value={screen.o2Narcotic}
          onChange={screen.setO2Narcotic}
        />
        {screen.hypoxic ? <M3Note color={palette.error}>{screen.hypoxic}</M3Note> : null}
      </M3Section>

      {screen.error ? (
        <M3Section title={t('ui.result')}>
          <M3Note>{screen.error}</M3Note>
        </M3Section>
      ) : (
        <M3Section
          title={`pO₂ · MOD · ${screen.narcoticLabel}`}
          footer={t('ui.modRoundedDownEndOrEad')}>
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
        title={t('ui.bestMix')}
        footer={t('toolsScreen.bestMixFooter', { po2: screen.bottomPo2Text })}>
        <M3StepperRow
          label={`${t('units.quantity.depth')}  ${screen.bestDepthLabel}`}
          value={screen.bestDepth}
          {...screen.bestDepthRange}
          onChange={screen.setBestDepth}
        />
        {screen.bestMix ? <M3ValueRow inline label={t('ui.bestMix')} value={screen.bestMix} /> : null}
      </M3Section>
    </M3Screen>
  );
}
