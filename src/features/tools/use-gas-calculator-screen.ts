// AI-generated (Claude)
// Everything the gas calculator does, minus the rendering. Like the nitrox tool it
// answers synchronously on every change, so there is no Calculate button to forget
// and no answer on screen for another mix.
import { useMemo, useState } from 'react';

import { describeError } from '@/models/errors';
import {
  GAS_CALCULATOR_DEFAULTS,
  gasInfoInput,
  gasRowLevel,
  HE_RANGE,
  hypoxicLine,
  narcoticLabel,
  O2_RANGE,
  rowTexts,
  withHe,
  withO2,
  type GasCalculatorInput,
} from '@/models/gas-calculator';
import {
  depthFromValue,
  depthRange,
  depthUnit,
  depthValue,
  gasName,
  GAS_PRESETS,
  type Water,
} from '@/models/planner';
import { useSettings, useUpdateSettings } from '@/queries/settings';

import { gasInfo } from '../../../modules/ssrf-core/src';

export function useGasCalculatorScreen() {
  const settings = useSettings();
  const units = settings.units;
  const { planner } = settings;
  const update = useUpdateSettings();
  const [input, setInput] = useState<GasCalculatorInput>(GAS_CALCULATOR_DEFAULTS);

  const result = useMemo(() => {
    try {
      return {
        info: gasInfo(
          gasInfoInput(input, {
            o2Narcotic: planner.o2Narcotic,
            surfacePressureMbar: planner.surfacePressureMbar,
            bottomPo2Mbar: planner.bottomPo2Mbar,
            bestMixEndMm: planner.bestMixEndMm,
          }),
        ),
        error: null,
      };
    } catch (error) {
      return { info: null, error: describeError(error).message };
    }
  }, [input, planner]);

  const info = result.info;
  const bestO2 = info?.best ? Math.round(info.best.o2Permille / 10) : null;
  const bestHe = info?.best ? Math.round(info.best.hePermille / 10) : null;

  return {
    input,
    units,
    mix: gasName(input.o2Percent, input.hePercent),
    o2Range: O2_RANGE,
    heRange: HE_RANGE,
    presets: GAS_PRESETS,
    error: result.error,
    rows: (info?.rows ?? []).map((row) => ({
      key: row.po2Mbar,
      level: gasRowLevel(row),
      ...rowTexts(row, units),
    })),
    narcoticLabel: narcoticLabel(planner.o2Narcotic),
    o2Narcotic: planner.o2Narcotic,
    hypoxic: info ? hypoxicLine(info.minDepthMm, units) : null,
    bestMix: bestO2 !== null && bestHe !== null ? gasName(bestO2, bestHe) : null,
    bestDepth: depthValue(input.bestMixDepthMm, units),
    bestDepthRange: depthRange(units),
    bestDepthLabel: `${depthValue(input.bestMixDepthMm, units)} ${depthUnit(units)}`,
    bottomPo2Text: `${(planner.bottomPo2Mbar / 1000).toFixed(2)} bar`,
    setO2: (o2Percent: number) => setInput((prev) => withO2(prev, o2Percent)),
    setHe: (hePercent: number) => setInput((prev) => withHe(prev, hePercent)),
    setPreset: (label: string) => {
      const preset = GAS_PRESETS.find((candidate) => candidate.label === label);
      if (preset) {
        setInput((prev) => ({ ...prev, o2Percent: preset.o2, hePercent: preset.he }));
      }
    },
    setWater: (water: Water) => setInput((prev) => ({ ...prev, water })),
    setBestDepth: (value: number) =>
      setInput((prev) => ({ ...prev, bestMixDepthMm: depthFromValue(value, units) })),
    setO2Narcotic: (o2Narcotic: boolean) =>
      update.mutate({ planner: { ...planner, o2Narcotic } }),
  };
}
