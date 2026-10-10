// AI-generated (Claude)
// The nitrox calculator on the Tools tab, minus the rendering.
//
// Every number comes from the core through `nitroxPlan` (cpp/bindings/api.cpp):
// the MOD from dive::gas_mod(), the best mix from dive::best_o2(), the
// no-decompression limits from the Buehlmann model in deco.cpp. This file only
// holds the inputs, turns them into the call's arguments, and labels the reply.

import type { GradientFactors, NitroxPlan, NitroxPlanInput } from './index';
import { feetToMm, mmToFeet, type UnitSystem } from './units';

export type Water = 'salt' | 'fresh';

/** What the screen lets the diver set. Depth is kept in mm so a unit switch loses nothing. */
export type NitroxInput = {
  o2Percent: number;
  depthMm: number;
  maxPo2Mbar: number;
  water: Water;
};

export const NITROX_DEFAULTS: NitroxInput = {
  o2Percent: 32,
  depthMm: 18000,
  maxPo2Mbar: 1400,
  water: 'salt',
};

/** Up to pure oxygen: the MOD of a deco gas is the same question as a bottom gas's. */
export const O2_RANGE = { min: 21, max: 100, step: 1 } as const;

/** The working pO2 limits training agencies use, 1.2 to the 1.6 contingency. */
export const PO2_RANGE = { min: 1200, max: 1600, step: 100 } as const;

/** The bindings refuse anything shallower than 3 m (the core computes no NDL there) or deeper than 100 m. */
export function depthRange(system: UnitSystem): { min: number; max: number; step: number } {
  return system === 'imperial' ? { min: 10, max: 320, step: 5 } : { min: 3, max: 100, step: 1 };
}

/**
 * The depth as the stepper shows it, snapped to the stepper's step - so after a
 * unit switch 18 m reads 60 ft rather than 59, and stepping stays on round values.
 */
export function depthValue(depthMm: number, system: UnitSystem): number {
  const { step } = depthRange(system);
  const value = system === 'imperial' ? mmToFeet(depthMm) : depthMm / 1000;
  return Math.round(value / step) * step;
}

/** The inverse of `depthValue`, clamped to the range the bindings accept. */
export function depthFromValue(value: number, system: UnitSystem): number {
  const range = depthRange(system);
  const clamped = Math.min(range.max, Math.max(range.min, value));
  return system === 'imperial' ? feetToMm(clamped) : clamped * 1000;
}

/** Salinity in the core's unit, g/10l (SEAWATER_SALINITY / FRESHWATER_SALINITY in core/units.h). */
const SALINITY: Record<Water, number> = { salt: 10300, fresh: 10000 };

export function planInput(input: NitroxInput, gf: GradientFactors): NitroxPlanInput {
  return {
    depthMm: input.depthMm,
    o2Permille: input.o2Percent * 10,
    maxPo2Mbar: input.maxPo2Mbar,
    salinity: SALINITY[input.water],
    gfLow: gf.gfLow,
    gfHigh: gf.gfHigh,
  };
}

/**
 * A MOD rounded down to the whole metre or foot: a limit shown rounded up would
 * be a depth the gas is not good for.
 */
export function formatMod(mm: number, system: UnitSystem): string {
  return system === 'imperial' ? `${Math.floor(mmToFeet(mm))} ft` : `${Math.floor(mm / 1000)} m`;
}

export function formatPo2(mbar: number): string {
  return `${(mbar / 1000).toFixed(2)} bar`;
}

export function formatNdl(minutes: number | null): string {
  return minutes === null ? 'Over 300 min' : `${minutes} min`;
}

export function mixName(o2Percent: number): string {
  if (o2Percent === 21) {
    return 'Air';
  }
  return o2Percent === 100 ? 'Oxygen' : `EAN${o2Percent}`;
}

/** How the mix's NDL compares with air's, as one line. */
export function ndlComparison(plan: NitroxPlan): string {
  const { ndlMin, airNdlMin } = plan;
  if (ndlMin === null && airNdlMin === null) {
    return 'Neither gas reaches a limit within 300 min';
  }
  if (ndlMin === null) {
    return `More than ${300 - (airNdlMin ?? 0)} min longer than on air`;
  }
  if (airNdlMin === null) {
    return 'Shorter than on air';
  }
  const delta = ndlMin - airNdlMin;
  if (delta === 0) {
    return 'Same as on air';
  }
  const percent =
    airNdlMin > 0 ? ` (${delta > 0 ? '+' : ''}${Math.round((delta / airNdlMin) * 100)}%)` : '';
  return delta > 0
    ? `${delta} min longer than on air${percent}`
    : `${-delta} min shorter than on air${percent}`;
}

export type NitroxWarning = { level: 'danger' | 'caution'; text: string };

/** What is wrong with diving this mix at this depth, worst first; null when nothing is. */
export function nitroxWarning(input: NitroxInput, plan: NitroxPlan): NitroxWarning | null {
  if (input.depthMm > plan.contingencyModMm) {
    return {
      level: 'danger',
      text: `The pO2 at this depth is ${formatPo2(plan.po2Mbar)}, past the 1.60 bar contingency limit.`,
    };
  }
  if (input.depthMm > plan.modMm) {
    return {
      level: 'caution',
      text: `The pO2 at this depth is ${formatPo2(plan.po2Mbar)}, past the working limit of ${formatPo2(input.maxPo2Mbar)}.`,
    };
  }
  return null;
}
