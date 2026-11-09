// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import {
  clampGradientFactors,
  DEFAULT_SETTINGS,
  GF_RANGE,
  parseSettings,
  serializeSettings,
} from './settings';
import { DEFAULT_PLANNER_SETTINGS } from './planner-settings';
import { IMPERIAL_UNITS, METRIC_UNITS } from './units';

describe('parseSettings', () => {
  it('migrates a file that knew only the unit system to its preset', () => {
    expect(parseSettings('{"unitSystem":"imperial"}').units).toEqual(IMPERIAL_UNITS);
    expect(parseSettings('{"unitSystem":"metric"}').units).toEqual(METRIC_UNITS);
  });

  it('reads units chosen one by one', () => {
    expect(
      parseSettings('{"units":{"depth":"ft","pressure":"bar","volume":"l","temperature":"F","weight":"kg"}}').units
    ).toEqual({ depth: 'ft', pressure: 'bar', volume: 'l', temperature: 'F', weight: 'kg' });
  });

  it('lets per-unit entries win over the old unit system, quantity by quantity', () => {
    // An imperial file a later build added one metric choice to.
    expect(parseSettings('{"unitSystem":"imperial","units":{"pressure":"bar"}}').units).toEqual({
      ...IMPERIAL_UNITS,
      pressure: 'bar',
    });
  });

  it('drops an unknown unit to the preset rather than resetting the rest', () => {
    expect(parseSettings('{"units":{"depth":"furlongs","temperature":"F"}}').units).toEqual({
      ...METRIC_UNITS,
      temperature: 'F',
    });
  });

  it('still writes the unit system an older build reads', () => {
    const write = (units: typeof METRIC_UNITS) =>
      JSON.parse(serializeSettings({ ...DEFAULT_SETTINGS, units })).unitSystem;
    expect(write(IMPERIAL_UNITS)).toBe('imperial');
    expect(write(METRIC_UNITS)).toBe('metric');
    // Personalized reads as the system of its depth.
    expect(write({ ...METRIC_UNITS, depth: 'ft' })).toBe('imperial');
    expect(write({ ...IMPERIAL_UNITS, depth: 'm' })).toBe('metric');
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
      ...DEFAULT_SETTINGS,
      units: IMPERIAL_UNITS,
    });
  });

  it('reads the stored gradient factor curve toggles', () => {
    expect(parseSettings('{"showGfNow":true,"showGfSurface":true}')).toMatchObject({
      showGfNow: true,
      showGfSurface: true,
    });
  });

  it('keeps the curve toggles off for a file written before they existed', () => {
    expect(parseSettings('{"gfLow":20,"gfHigh":85}')).toMatchObject({
      showGfNow: false,
      showGfSurface: false,
    });
  });

  it('ignores non-boolean curve toggles rather than testing them for truthiness', () => {
    expect(parseSettings('{"showGfNow":"yes","showGfSurface":1}')).toMatchObject({
      showGfNow: DEFAULT_SETTINGS.showGfNow,
      showGfSurface: DEFAULT_SETTINGS.showGfSurface,
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
    const settings = {
      units: { ...IMPERIAL_UNITS, temperature: 'C' as const },
      gfLow: 35,
      gfHigh: 80,
      showGfNow: false,
      showGfSurface: true,
      diveComputers: [{ vendor: 'Shearwater', product: 'Perdix', address: 'a', name: 'Perdix 1' }],
      syncDiveComputerTime: true,
      planner: { ...DEFAULT_PLANNER_SETTINGS, gfLow: 40, verbatim: true },
      statsChart: null,
      defaultCylinder: 'AL80',
    };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });
});

describe('default cylinder', () => {
  it('is none, as in the core, for a file written before it existed', () => {
    expect(parseSettings('{"gfLow":30}').defaultCylinder).toBe('');
    expect(DEFAULT_SETTINGS.defaultCylinder).toBe('');
  });

  it('reads a name and ignores anything else', () => {
    expect(parseSettings('{"defaultCylinder":"AL80"}').defaultCylinder).toBe('AL80');
    expect(parseSettings('{"defaultCylinder":12}').defaultCylinder).toBe('');
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
