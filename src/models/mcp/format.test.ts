// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { gasName, statsOut, wallClock } from './format';
import type { Stats } from '../index';

const mix = (o2: number, he = 0) => ({
  o2Permille: o2,
  hePermille: he,
  o2EffectivePermille: o2,
  heEffectivePermille: he,
});

describe('gasName', () => {
  it('names air, nitrox, oxygen and trimix', () => {
    expect(gasName(mix(209))).toBe('air');
    expect(gasName(mix(320))).toBe('EAN32');
    expect(gasName(mix(1000))).toBe('oxygen');
    expect(gasName(mix(180, 450))).toBe('Tx18/45');
  });
});

describe('wallClock', () => {
  it('reads the stored time as the local time of the dive, without a zone', () => {
    expect(wallClock(Date.UTC(2026, 7, 14, 9, 30) / 1000)).toBe('2026-08-14T09:30:00');
  });
});

describe('statsOut', () => {
  it('reports unrecorded values as null, not as zero', () => {
    const empty = {
      selectionSize: 0,
      totalTimeSec: 0,
      shortestTimeSec: 0,
      longestTimeSec: 0,
      maxDepthMm: 0,
      minDepthMm: 0,
      avgDepthMm: 0,
      combinedMaxDepthMm: 0,
      avgSacMlPerMin: 0,
      minSacMlPerMin: 0,
      maxSacMlPerMin: 0,
      minTempMkelvin: 0,
      maxTempMkelvin: 0,
      combinedTempMkelvin: 0,
      combinedCount: 0,
    } as Stats;
    expect(statsOut(empty)).toMatchObject({
      dives: 0,
      totalTimeMin: 0,
      avgTimeMin: null,
      maxDepthM: null,
      avgSacLPerMin: null,
      minWaterTempC: null,
      avgWaterTempC: null,
    });
  });

  it('converts with the core constants', () => {
    const stats = {
      selectionSize: 2,
      totalTimeSec: 6000,
      maxDepthMm: 30500,
      combinedMaxDepthMm: 50000,
      avgSacMlPerMin: 15250,
      minTempMkelvin: 290150,
      combinedTempMkelvin: 2 * 293150,
      combinedCount: 2,
    } as Stats;
    expect(statsOut(stats)).toMatchObject({
      avgTimeMin: 50,
      maxDepthM: 30.5,
      avgMaxDepthM: 25,
      avgSacLPerMin: 15.3,
      minWaterTempC: 17,
      avgWaterTempC: 20,
    });
  });
});
