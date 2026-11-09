// AI-generated (Claude)
// The gas calculator on the Tools tab, minus the rendering. Every depth comes from
// the core through `gasInfo` (cpp/bindings/planner.cpp).

import type { GasInfoInput, GasInfoRow } from './index';
import { WATER_SALINITY, type Water } from './planner';
import { formatMod } from './nitrox';
import { mmToFeet, type Units } from './units';

export type GasCalculatorInput = {
  o2Percent: number;
  hePercent: number;
  water: Water;
  /** The depth the best mix is for. */
  bestMixDepthMm: number;
};

export const GAS_CALCULATOR_DEFAULTS: GasCalculatorInput = {
  o2Percent: 21,
  hePercent: 0,
  water: 'salt',
  bestMixDepthMm: 40000,
};

export const O2_RANGE = { min: 5, max: 100, step: 1 } as const;
export const HE_RANGE = { min: 0, max: 95, step: 1 } as const;

/** The legacy calculator clamps helium to what the oxygen leaves; so do these. */
export function withO2(input: GasCalculatorInput, o2Percent: number): GasCalculatorInput {
  return { ...input, o2Percent, hePercent: Math.min(input.hePercent, 100 - o2Percent) };
}

export function withHe(input: GasCalculatorInput, hePercent: number): GasCalculatorInput {
  return { ...input, hePercent, o2Percent: Math.min(input.o2Percent, 100 - hePercent) };
}

export function gasInfoInput(
  input: GasCalculatorInput,
  options: { o2Narcotic: boolean; surfacePressureMbar: number; bottomPo2Mbar: number; bestMixEndMm: number },
): GasInfoInput {
  return {
    o2Permille: input.o2Percent * 10,
    hePermille: input.hePercent * 10,
    o2Narcotic: options.o2Narcotic,
    salinity: WATER_SALINITY[input.water],
    surfacePressureMbar: options.surfacePressureMbar,
    bestMix: {
      depthMm: input.bestMixDepthMm,
      bottomPo2Mbar: options.bottomPo2Mbar,
      bestMixEndMm: options.bestMixEndMm,
    },
  };
}

export type GasRowLevel = 'working' | 'contingency' | 'beyond';

/** Up to 1.4 bar is a working limit, up to 1.6 a contingency one; past that it is a warning. */
export function gasRowLevel(row: GasInfoRow): GasRowLevel {
  if (row.po2Mbar <= 1400) {
    return 'working';
  }
  return row.po2Mbar <= 1600 ? 'contingency' : 'beyond';
}

/**
 * The MOD rounded down, like every MOD in this app: a limit must not be shown past
 * itself. The END or EAD rounded up, for the same reason: it must not read better than it is.
 */
export function rowTexts(
  row: GasInfoRow,
  units: Units,
): { po2: string; mod: string; narcotic: string } {
  return {
    po2: `${(row.po2Mbar / 1000).toFixed(1)} bar`,
    mod: formatMod(row.modMm, units),
    narcotic:
      units.depth === 'ft'
        ? `${Math.ceil(mmToFeet(row.narcoticDepthMm))} ft`
        : `${Math.ceil(row.narcoticDepthMm / 1000)} m`,
  };
}

export function narcoticLabel(o2Narcotic: boolean): string {
  return o2Narcotic ? 'END at MOD' : 'EAD at MOD';
}

/** Only for a mix that is hypoxic at the surface. */
export function hypoxicLine(minDepthMm: number, units: Units): string | null {
  if (minDepthMm <= 0) {
    return null;
  }
  const rounded =
    units.depth === 'ft' ? `${Math.ceil(mmToFeet(minDepthMm))} ft` : `${Math.ceil(minDepthMm / 1000)} m`;
  return `Hypoxic: below 0.16 bar of oxygen above ${rounded}. Not breathable at the surface.`;
}
