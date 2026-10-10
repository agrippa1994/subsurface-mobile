// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { NitroxPlan } from './index';
import {
  depthFromValue,
  depthValue,
  formatMod,
  formatNdl,
  mixName,
  NITROX_DEFAULTS,
  ndlComparison,
  nitroxWarning,
  planInput,
} from './nitrox';

const PLAN: NitroxPlan = {
  modMm: 33273,
  contingencyModMm: 39458,
  airModMm: 56263,
  bestMixPermille: 490,
  ambientMbar: 2832,
  po2Mbar: 906,
  ndlMin: 102,
  airNdlMin: 58,
};

describe('nitrox inputs', () => {
  it('builds the binding arguments in core units', () => {
    expect(planInput(NITROX_DEFAULTS, { gfLow: 30, gfHigh: 75 })).toEqual({
      depthMm: 18000,
      o2Permille: 320,
      maxPo2Mbar: 1400,
      salinity: 10300,
      gfLow: 30,
      gfHigh: 75,
    });
    expect(
      planInput({ ...NITROX_DEFAULTS, water: 'fresh' }, { gfLow: 30, gfHigh: 75 }).salinity,
    ).toBe(10000);
  });

  it('round-trips the depth through the displayed unit and clamps it', () => {
    expect(depthValue(depthFromValue(18, 'metric'), 'metric')).toBe(18);
    expect(depthValue(depthFromValue(60, 'imperial'), 'imperial')).toBe(60);
    expect(depthValue(18000, 'imperial')).toBe(60);
    expect(depthFromValue(1, 'metric')).toBe(3000);
    expect(depthFromValue(500, 'imperial')).toBe(depthFromValue(320, 'imperial'));
  });
});

describe('nitrox presentation', () => {
  it('rounds the MOD down, never up', () => {
    expect(formatMod(33999, 'metric')).toBe('33 m');
    expect(formatMod(33273, 'imperial')).toBe('109 ft');
  });

  it('names the mix and the open-ended NDL', () => {
    expect(mixName(21)).toBe('Air');
    expect(mixName(32)).toBe('EAN32');
    expect(mixName(100)).toBe('Oxygen');
    expect(formatNdl(null)).toBe('Over 300 min');
    expect(formatNdl(14)).toBe('14 min');
  });

  it('compares the NDL with air', () => {
    expect(ndlComparison(PLAN)).toBe('44 min longer than on air (+76%)');
    expect(ndlComparison({ ...PLAN, ndlMin: 58 })).toBe('Same as on air');
    expect(ndlComparison({ ...PLAN, ndlMin: null })).toBe('More than 242 min longer than on air');
    expect(ndlComparison({ ...PLAN, ndlMin: null, airNdlMin: null })).toBe(
      'Neither gas reaches a limit within 300 min',
    );
  });

  it('warns past the working and the contingency MOD', () => {
    expect(nitroxWarning(NITROX_DEFAULTS, PLAN)).toBeNull();
    expect(nitroxWarning({ ...NITROX_DEFAULTS, depthMm: 35000 }, PLAN)?.level).toBe('caution');
    expect(nitroxWarning({ ...NITROX_DEFAULTS, depthMm: 40000 }, PLAN)?.level).toBe('danger');
  });
});
