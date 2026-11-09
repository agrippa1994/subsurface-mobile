// AI-generated (Claude)
// Nitrox calculator, Android variant, in Compose. The numbers are the core's - see
// src/models/nitrox.ts and `nitroxPlan` in cpp/bindings/api.cpp.
import { useMaterialColors } from '@expo/ui/jetpack-compose';

import {
  M3Note,
  M3Screen,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
  M3ValueRow,
} from '@/components/material/list';
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
  PO2_RANGE,
  type Water,
} from '@/models/nitrox';

const WATER: { value: Water; label: string }[] = [
  { value: 'salt', label: 'Salt' },
  { value: 'fresh', label: 'Fresh' },
];
const PO2_OPTIONS = [1200, 1300, 1400, 1500, 1600]
  .filter((mbar) => mbar >= PO2_RANGE.min && mbar <= PO2_RANGE.max)
  .map((mbar) => ({ value: mbar, label: (mbar / 1000).toFixed(1) }));

export default function NitroxScreen() {
  const screen = useNitroxScreen();
  const theme = useTheme();
  const palette = useMaterialColors();
  const { input, plan, units } = screen;
  const depthLabel = `${screen.depth} ${screen.depthUnit}`;
  const mix = mixName(input.o2Percent);
  const warning = plan ? nitroxWarning(input, plan) : null;

  return (
    <M3Screen>
      <M3Section title="Dive">
        <M3StepperRow
          label={`Depth  ${depthLabel}`}
          value={screen.depth}
          min={screen.depthRange.min}
          max={screen.depthRange.max}
          step={screen.depthRange.step}
          onChange={screen.setDepth}
        />
        <M3SegmentedRow label="Water" options={WATER} value={input.water} onChange={screen.setWater} />
      </M3Section>

      <M3Section title="Gas">
        <M3StepperRow
          label={`Oxygen  ${input.o2Percent}%  (${mix})`}
          value={input.o2Percent}
          min={O2_RANGE.min}
          max={O2_RANGE.max}
          step={O2_RANGE.step}
          onChange={screen.setO2Percent}
        />
        <M3SegmentedRow
          label="Max pO2"
          options={PO2_OPTIONS}
          value={input.maxPo2Mbar}
          onChange={screen.setMaxPo2Mbar}
        />
      </M3Section>

      {plan ? (
        <>
          <M3Section
            title="Depth limits"
            footer={`Rounded down to the whole ${units.depth === 'ft' ? 'foot' : 'metre'}. The best mix is the richest one the max pO2 allows at the planned depth.`}>
            <M3ValueRow
              inline
              label={`MOD at ${formatPo2(input.maxPo2Mbar)}`}
              value={formatMod(plan.modMm, units)}
            />
            <M3ValueRow
              inline
              label="MOD at 1.60 bar"
              value={formatMod(plan.contingencyModMm, units)}
            />
            <M3ValueRow inline label={`pO2 at ${depthLabel}`} value={formatPo2(plan.po2Mbar)} />
            <M3ValueRow
              inline
              label={`Best mix for ${depthLabel}`}
              value={mixName(Math.min(100, Math.floor(plan.bestMixPermille / 10)))}
            />
            {warning ? (
              <M3Note color={warning.level === 'danger' ? palette.error : theme.warning}>
                {warning.text}
              </M3Note>
            ) : null}
          </M3Section>

          <M3Section
            title={`No-deco limit at ${depthLabel}`}
            footer={`Buehlmann ZHL-16C with gradient factors ${screen.gfLow}/${screen.gfHigh} from Settings, for a square dive: arriving at the depth and staying there. A planning aid, not a substitute for a dive computer.`}>
            <M3ValueRow inline label={mix} value={formatNdl(plan.ndlMin)} />
            <M3ValueRow inline label="Air" value={formatNdl(plan.airNdlMin)} />
            <M3Note color={palette.onSurfaceVariant}>{ndlComparison(plan)}</M3Note>
          </M3Section>
        </>
      ) : (
        <M3Section title="Result">
          <M3Note>{screen.error ?? 'The calculation is unavailable.'}</M3Note>
        </M3Section>
      )}
    </M3Screen>
  );
}
