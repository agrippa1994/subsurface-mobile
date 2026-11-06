// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import {
  GAS_CALCULATOR_DEFAULTS,
  gasInfoInput,
  gasRowLevel,
  hypoxicLine,
  narcoticLabel,
  rowTexts,
  withHe,
  withO2,
} from './gas-calculator';

const options = { o2Narcotic: true, surfacePressureMbar: 1013, bottomPo2Mbar: 1400, bestMixEndMm: 30000 };

describe('the mix', () => {
  it('stays a mix, with the other gas giving way', () => {
    expect(withO2({ ...GAS_CALCULATOR_DEFAULTS, hePercent: 60 }, 50)).toMatchObject({ o2Percent: 50, hePercent: 50 });
    expect(withHe({ ...GAS_CALCULATOR_DEFAULTS, o2Percent: 50 }, 80)).toMatchObject({ o2Percent: 20, hePercent: 80 });
  });

  it('becomes the arguments of gasInfo', () => {
    const input = gasInfoInput({ o2Percent: 18, hePercent: 45, water: 'fresh', bestMixDepthMm: 60000 }, options);
    expect(input).toMatchObject({ o2Permille: 180, hePermille: 450, salinity: 10000, o2Narcotic: true });
    expect(input.bestMix).toEqual({ depthMm: 60000, bottomPo2Mbar: 1400, bestMixEndMm: 30000 });
  });
});

describe('the table', () => {
  it('rounds the MOD down and the END up, in the unit asked for', () => {
    const row = { po2Mbar: 1400, modMm: 56900, narcoticDepthMm: 30400 };
    expect(rowTexts(row, 'metric')).toEqual({ po2: '1.4 bar', mod: '56 m', narcotic: '31 m' });
    expect(rowTexts(row, 'imperial').mod).toBe('186 ft');
  });

  it('tells the working limits from the rest', () => {
    const level = (po2Mbar: number) => gasRowLevel({ po2Mbar, modMm: 0, narcoticDepthMm: 0 });
    expect(level(1400)).toBe('working');
    expect(level(1600)).toBe('contingency');
    expect(level(1700)).toBe('beyond');
  });

  it('names the narcotic depth by whether oxygen counts', () => {
    expect(narcoticLabel(true)).toBe('END at MOD');
    expect(narcoticLabel(false)).toBe('EAD at MOD');
  });
});

describe('hypoxicLine', () => {
  it('says nothing for a gas that is breathable at the surface', () => {
    expect(hypoxicLine(0, 'metric')).toBeNull();
  });

  it('rounds up, the safe way for a minimum depth', () => {
    expect(hypoxicLine(5900, 'metric')).toContain('6 m');
    expect(hypoxicLine(5900, 'imperial')).toContain('ft');
  });
});
