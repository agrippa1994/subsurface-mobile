// AI-generated (Claude)
// The nitrox calculator on the Tools tab, minus the rendering.
//
// Every number comes from the core through `nitroxPlan` (cpp/bindings/api.cpp):
// the MOD from dive::gas_mod(), the best mix from dive::best_o2(), the
// no-decompression limits from the Buehlmann model in deco.cpp. This file only
// holds the inputs, turns them into the call's arguments, and labels the reply.

import type { GradientFactors, NitroxPlan, NitroxPlanInput } from './index';
import { feetToMm, mmToFeet, type Units } from './units';
import { t } from '@/i18n';

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
export function depthRange(units: Units): { min: number; max: number; step: number } {
  return units.depth === 'ft' ? { min: 10, max: 320, step: 5 } : { min: 3, max: 100, step: 1 };
}

/**
 * The depth as the stepper shows it, snapped to the stepper's step - so after a
 * unit switch 18 m reads 60 ft rather than 59, and stepping stays on round values.
 */
export function depthValue(depthMm: number, units: Units): number {
  const { step } = depthRange(units);
  const value = units.depth === 'ft' ? mmToFeet(depthMm) : depthMm / 1000;
  return Math.round(value / step) * step;
}

/** The inverse of `depthValue`, clamped to the range the bindings accept. */
export function depthFromValue(value: number, units: Units): number {
  const range = depthRange(units);
  const clamped = Math.min(range.max, Math.max(range.min, value));
  return units.depth === 'ft' ? feetToMm(clamped) : clamped * 1000;
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
export function formatMod(mm: number, units: Units): string {
  return units.depth === 'ft' ? `${Math.floor(mmToFeet(mm))} ft` : `${Math.floor(mm / 1000)} m`;
}

export function formatPo2(mbar: number): string {
  return `${(mbar / 1000).toFixed(2)} bar`;
}

export function formatNdl(minutes: number | null): string {
  return minutes === null ? t('nitrox.ndlOver') : t('common.minutesShort', { minutes });
}

export function mixName(o2Percent: number): string {
  if (o2Percent === 21) {
    return t('units.gas.air');
  }
  return o2Percent === 100 ? t('units.gas.oxygen') : `EAN${o2Percent}`;
}

/** How the mix's NDL compares with air's, as one line. */
export function ndlComparison(plan: NitroxPlan): string {
  const { ndlMin, airNdlMin } = plan;
  if (ndlMin === null && airNdlMin === null) {
    return t('nitrox.compare.neither');
  }
  if (ndlMin === null) {
    return t('nitrox.compare.moreThan', { minutes: 300 - (airNdlMin ?? 0) });
  }
  if (airNdlMin === null) {
    return t('nitrox.compare.shorter');
  }
  const delta = ndlMin - airNdlMin;
  if (delta === 0) {
    return t('nitrox.compare.same');
  }
  const percent =
    airNdlMin > 0 ? ` (${delta > 0 ? '+' : ''}${Math.round((delta / airNdlMin) * 100)}%)` : '';
  return delta > 0
    ? t('nitrox.compare.longerBy', { minutes: delta, percent })
    : t('nitrox.compare.shorterBy', { minutes: -delta, percent });
}

export type NitroxWarning = { level: 'danger' | 'caution'; text: string };

/** What is wrong with diving this mix at this depth, worst first; null when nothing is. */
export function nitroxWarning(input: NitroxInput, plan: NitroxPlan): NitroxWarning | null {
  if (input.depthMm > plan.contingencyModMm) {
    return {
      level: 'danger',
      text: t('nitrox.warning.contingency', { po2: formatPo2(plan.po2Mbar) }),
    };
  }
  if (input.depthMm > plan.modMm) {
    return {
      level: 'caution',
      text: t('nitrox.warning.working', { po2: formatPo2(plan.po2Mbar), limit: formatPo2(input.maxPo2Mbar) }),
    };
  }
  return null;
}
