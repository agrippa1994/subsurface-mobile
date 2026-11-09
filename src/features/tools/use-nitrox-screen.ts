// AI-generated (Claude)
// Everything the nitrox calculator screen does, minus the rendering. Both
// variants (index.ios.tsx's native Form and the portable fallback) share it.
//
// The plan is recomputed synchronously on every input change: it is a few
// hundred Buehlmann steps in C++, well under a frame, so there is nothing to
// cache or debounce.

import { useMemo, useState } from 'react';

import type { NitroxPlan, Units } from '@/models';
import { describeError } from '@/models/errors';
import {
  depthFromValue,
  depthRange,
  depthValue,
  NITROX_DEFAULTS,
  planInput,
  type NitroxInput,
  type Water,
} from '@/models/nitrox';
import { useGradientFactors, useUnits } from '@/queries/settings';

import { nitroxPlan } from '../../../modules/ssrf-core/src';

export type NitroxScreen = {
  input: NitroxInput;
  units: Units;
  gfLow: number;
  gfHigh: number;
  /** The depth in the unit the stepper shows, and the stepper's bounds. */
  depth: number;
  depthUnit: string;
  depthRange: { min: number; max: number; step: number };
  plan: NitroxPlan | null;
  error: string | null;
  setO2Percent: (percent: number) => void;
  setDepth: (value: number) => void;
  setMaxPo2Mbar: (mbar: number) => void;
  setWater: (water: Water) => void;
};

export function useNitroxScreen(): NitroxScreen {
  const [input, setInput] = useState<NitroxInput>(NITROX_DEFAULTS);
  const units = useUnits();
  const gf = useGradientFactors();

  const result = useMemo(() => {
    try {
      return { plan: nitroxPlan(planInput(input, gf)), error: null };
    } catch (error) {
      return { plan: null, error: describeError(error).message };
    }
  }, [input, gf]);

  return {
    input,
    units,
    gfLow: gf.gfLow,
    gfHigh: gf.gfHigh,
    depth: depthValue(input.depthMm, units),
    depthUnit: units.depth === 'ft' ? 'ft' : 'm',
    depthRange: depthRange(units),
    plan: result.plan,
    error: result.error,
    setO2Percent: (o2Percent) => setInput((prev) => ({ ...prev, o2Percent })),
    setDepth: (value) =>
      setInput((prev) => ({ ...prev, depthMm: depthFromValue(value, units) })),
    setMaxPo2Mbar: (maxPo2Mbar) => setInput((prev) => ({ ...prev, maxPo2Mbar })),
    setWater: (water) => setInput((prev) => ({ ...prev, water })),
  };
}
