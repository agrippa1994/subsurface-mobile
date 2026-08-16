// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import {
  clampGradientFactors,
  DEFAULT_SETTINGS,
  GF_RANGE,
  parseSettings,
  serializeSettings,
} from './settings';

describe('parseSettings', () => {
  it('reads a stored unit system', () => {
    expect(parseSettings('{"unitSystem":"imperial"}').unitSystem).toBe('imperial');
  });

  it('falls back to the default for junk, nulls and unknown values', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"unitSystem":"furlongs"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{}')).toEqual(DEFAULT_SETTINGS);
  });

  it('reads stored gradient factors', () => {
    expect(parseSettings('{"gfLow":20,"gfHigh":85}')).toMatchObject({ gfLow: 20, gfHigh: 85 });
  });

  it('keeps the defaults for a file written before gradient factors existed', () => {
    expect(parseSettings('{"unitSystem":"imperial"}')).toEqual({
      unitSystem: 'imperial',
      gfLow: DEFAULT_SETTINGS.gfLow,
      gfHigh: DEFAULT_SETTINGS.gfHigh,
    });
  });

  it('ignores non-numeric gradient factors', () => {
    expect(parseSettings('{"gfLow":"low","gfHigh":null}')).toMatchObject({
      gfLow: DEFAULT_SETTINGS.gfLow,
      gfHigh: DEFAULT_SETTINGS.gfHigh,
    });
  });

  it('clamps out-of-range gradient factors', () => {
    expect(parseSettings('{"gfLow":-5,"gfHigh":900}')).toMatchObject({
      gfLow: GF_RANGE.min,
      gfHigh: GF_RANGE.max,
    });
  });

  it('raises gf high when the stored pair is inverted', () => {
    expect(parseSettings('{"gfLow":90,"gfHigh":40}')).toMatchObject({ gfLow: 90, gfHigh: 90 });
  });

  it('round-trips', () => {
    const settings = { unitSystem: 'imperial' as const, gfLow: 35, gfHigh: 80 };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });
});

describe('clampGradientFactors', () => {
  it('leaves a valid pair alone', () => {
    expect(clampGradientFactors(30, 75)).toEqual({ gfLow: 30, gfHigh: 75 });
  });

  it('rounds fractions', () => {
    expect(clampGradientFactors(30.4, 74.6)).toEqual({ gfLow: 30, gfHigh: 75 });
  });

  it('clamps to the range and orders the pair', () => {
    expect(clampGradientFactors(0, 1000)).toEqual({ gfLow: GF_RANGE.min, gfHigh: GF_RANGE.max });
    expect(clampGradientFactors(80, 60)).toEqual({ gfLow: 80, gfHigh: 80 });
  });

  it('falls back per value for NaN', () => {
    expect(clampGradientFactors(Number.NaN, Number.NaN)).toEqual({
      gfLow: DEFAULT_SETTINGS.gfLow,
      gfHigh: DEFAULT_SETTINGS.gfHigh,
    });
  });
});
