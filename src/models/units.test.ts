// AI-generated (Claude)
// Unit conversion tests. Expected values come from the constants in
// subsurface/core/units.h, so a drift here means the app would display
// something the desktop app does not.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  IMPERIAL_UNITS,
  METRIC_UNITS,
  coreUnits,
  depthFromUnit,
  depthInUnit,
  formatSac,
  parseUnits,
  pressureFromUnit,
  pressureInUnit,
  temperatureInUnit,
  unitPreset,
  unitsForSystem,
  unitsSummary,
  volumeFromUnit,
  volumeInUnit,
  celsiusToMkelvin,
  degreesToUdeg,
  feetToMm,
  formatDepth,
  formatDuration,
  formatGasMix,
  formatPressure,
  formatTemperature,
  formatVolume,
  formatWeight,
  gramsToKg,
  gramsToLbs,
  kgToGrams,
  lbsToGrams,
  metersToMm,
  mbarToBar,
  mbarToPsi,
  mkelvinToCelsius,
  mkelvinToFahrenheit,
  mlToCuft,
  mlToLiters,
  mmToFeet,
  mmToMeters,
  psiToMbar,
  udegToDegrees,
  ZERO_C_IN_MKELVIN,
} from './units';

describe('depth', () => {
  it('converts mm to metres and feet', () => {
    expect(mmToMeters(20100)).toBe(20.1);
    expect(mmToFeet(304800)).toBeCloseTo(1000, 1);
    expect(mmToFeet(0)).toBe(0);
  });

  it('round-trips through feet within a millimetre', () => {
    expect(feetToMm(mmToFeet(20100))).toBeCloseTo(20100, -1);
    expect(metersToMm(20.1)).toBe(20100);
  });
});

describe('pressure', () => {
  it('converts mbar to bar and psi', () => {
    expect(mbarToBar(227527)).toBe(227.527);
    // 1 bar is 14.5037738 psi.
    expect(mbarToPsi(1000)).toBeCloseTo(14.5037738, 6);
  });

  it('round-trips through psi', () => {
    expect(psiToMbar(mbarToPsi(206843))).toBeCloseTo(206843, -1);
  });
});

describe('temperature', () => {
  it('uses the core zero point', () => {
    expect(ZERO_C_IN_MKELVIN).toBe(273150);
    expect(mkelvinToCelsius(293150)).toBe(20);
    expect(mkelvinToCelsius(ZERO_C_IN_MKELVIN)).toBe(0);
  });

  it('converts to Fahrenheit', () => {
    expect(mkelvinToFahrenheit(ZERO_C_IN_MKELVIN)).toBeCloseTo(32, 2);
    expect(mkelvinToFahrenheit(293150)).toBeCloseTo(68, 2);
  });

  it('round-trips Celsius', () => {
    expect(celsiusToMkelvin(20)).toBe(293150);
    expect(mkelvinToCelsius(celsiusToMkelvin(6))).toBe(6);
  });
});

describe('volume and weight', () => {
  it('converts millilitres', () => {
    expect(mlToLiters(15000)).toBe(15);
    // An AL80 is 11.1 l, i.e. about 80 cuft - hence the name.
    expect(mlToCuft(11100)).toBeCloseTo(0.392, 3);
    expect(mlToCuft(2265348)).toBeCloseTo(80, 1);
  });

  it('converts grams', () => {
    expect(gramsToKg(4500)).toBe(4.5);
    expect(gramsToLbs(453.6 * 10)).toBeCloseTo(10, 6);
  });

  it('converts back to grams, landing on the gram it came from', () => {
    expect(kgToGrams(4.5)).toBe(4500);
    expect(lbsToGrams(10)).toBe(4536);
    expect(kgToGrams(gramsToKg(6000))).toBe(6000);
    expect(lbsToGrams(gramsToLbs(6000))).toBe(6000);
  });
});

describe('coordinates', () => {
  it('converts microdegrees', () => {
    expect(udegToDegrees(12488540)).toBe(12.48854);
    expect(degreesToUdeg(-61.49134)).toBe(-61491340);
  });
});

describe('formatting', () => {
  it('formats depth in both systems', () => {
    expect(formatDepth(20100, METRIC_UNITS)).toBe('20.1 m');
    expect(formatDepth(20100, IMPERIAL_UNITS)).toBe('66 ft');
  });

  it('formats pressure in both systems', () => {
    expect(formatPressure(227527, METRIC_UNITS)).toBe('228 bar');
    expect(formatPressure(227527, IMPERIAL_UNITS)).toBe('3300 psi');
  });

  it('formats temperature in both systems', () => {
    expect(formatTemperature(293150, METRIC_UNITS)).toBe('20 C');
    expect(formatTemperature(293150, IMPERIAL_UNITS)).toBe('68 F');
  });

  it('formats volume and weight', () => {
    expect(formatVolume(15000, METRIC_UNITS)).toBe('15 l');
    expect(formatWeight(4500, METRIC_UNITS)).toBe('4.5 kg');
    expect(formatWeight(4536, IMPERIAL_UNITS)).toBe('10 lbs');
  });

  it('formats durations', () => {
    expect(formatDuration(1800)).toBe('30:00');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('names gas mixes the way the core does', () => {
    // An o2 fraction of 0 is the core's "air" sentinel.
    expect(formatGasMix(0, 0)).toBe('Air');
    expect(formatGasMix(209, 0)).toBe('Air');
    expect(formatGasMix(320, 0)).toBe('EAN32');
    expect(formatGasMix(1000, 0)).toBe('Oxygen');
    expect(formatGasMix(150, 500)).toBe('Trimix 15/50');
  });
});

describe('units chosen one by one', () => {
  const FEET_AND_BAR = { ...METRIC_UNITS, depth: 'ft' } as const;

  it('formats each quantity in its own unit', () => {
    expect(formatDepth(20100, FEET_AND_BAR)).toBe('66 ft');
    expect(formatPressure(227527, FEET_AND_BAR)).toBe('228 bar');
    expect(formatVolume(15000, FEET_AND_BAR)).toBe('15 l');
    expect(formatTemperature(293150, { ...METRIC_UNITS, temperature: 'F' })).toBe('68 F');
    expect(formatWeight(4536, { ...METRIC_UNITS, weight: 'lbs' })).toBe('10 lbs');
    expect(formatPressure(227527, { ...METRIC_UNITS, pressure: 'psi' })).toBe('3300 psi');
    expect(formatDepth(20100, { ...IMPERIAL_UNITS, depth: 'm' })).toBe('20.1 m');
  });

  it('follows the volume unit for a SAC', () => {
    expect(formatSac(15000, { ...METRIC_UNITS, volume: 'cuft' })).toBe('0.53 cuft/min');
    expect(formatSac(15000, { ...IMPERIAL_UNITS, volume: 'l' })).toBe('15 l/min');
  });

  it('names a preset, or neither', () => {
    expect(unitPreset(METRIC_UNITS)).toBe('metric');
    expect(unitPreset(IMPERIAL_UNITS)).toBe('imperial');
    expect(unitPreset(FEET_AND_BAR)).toBe('personalized');
    expect(unitsForSystem('imperial')).toEqual(IMPERIAL_UNITS);
  });

  it('reads units leniently, a quantity at a time', () => {
    expect(parseUnits(null)).toEqual(METRIC_UNITS);
    expect(parseUnits({ depth: 'ft', weight: 'stone' })).toEqual({ ...METRIC_UNITS, depth: 'ft' });
    expect(parseUnits({ pressure: 'bar' }, IMPERIAL_UNITS)).toEqual({ ...IMPERIAL_UNITS, pressure: 'bar' });
  });

  it('summarises the units for a footer', () => {
    expect(unitsSummary(METRIC_UNITS)).toBe('Meters, bar, liters, Celsius, kilograms.');
    expect(unitsSummary(FEET_AND_BAR)).toBe('Feet, bar, liters, Celsius, kilograms.');
  });
});

describe('a unit system alone is refused', () => {
  // The old call shape: formatDepth(mm, 'imperial'). It type-checks no longer,
  // but a cast or an untyped caller would otherwise render metric in silence.
  const formatters: [string, (units: never) => unknown][] = [
    ['formatDepth', (u) => formatDepth(1000, u)],
    ['formatPressure', (u) => formatPressure(1000, u)],
    ['formatTemperature', (u) => formatTemperature(293150, u)],
    ['formatVolume', (u) => formatVolume(1000, u)],
    ['formatWeight', (u) => formatWeight(1000, u)],
    ['formatSac', (u) => formatSac(1000, u)],
    ['depthInUnit', (u) => depthInUnit(1000, u)],
    ['depthFromUnit', (u) => depthFromUnit(10, u)],
    ['pressureInUnit', (u) => pressureInUnit(1000, u)],
    ['pressureFromUnit', (u) => pressureFromUnit(10, u)],
    ['temperatureInUnit', (u) => temperatureInUnit(293150, u)],
    ['volumeInUnit', (u) => volumeInUnit(1000, u)],
    ['volumeFromUnit', (u) => volumeFromUnit(1, u)],
    ['coreUnits', (u) => coreUnits(u)],
    ['unitsSummary', (u) => unitsSummary(u)],
  ];

  for (const [name, call] of formatters) {
    it(`${name} throws for 'metric' and 'imperial'`, () => {
      expect(() => call('imperial' as never)).toThrow(/unit system alone/);
      expect(() => call('metric' as never)).toThrow(/unit system alone/);
      expect(() => call(undefined as never)).toThrow(TypeError);
    });
  }
});

describe('no screen reads a bare unit system', () => {
  // Every formatter takes Units. A component that went back to the unit system
  // - `settings.unitSystem`, `useUnitSystem()`, `=== 'imperial'` - would show
  // feet where the diver chose feet only for depth. The two files allowed to
  // name the presets are the units model and the settings file format.
  const root = join(__dirname, '..');
  const allowed = new Set([join(root, 'models/units.ts'), join(root, 'models/settings.ts')]);

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        return sources(path);
      }
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !allowed.has(path) ? [path] : [];
    });
  }

  it('finds no unitSystem read outside the units model and the settings file', () => {
    const offenders = sources(root).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /\bunitSystem\b|useUnitSystem|===\s*'imperial'|===\s*'metric'/.test(line))
        .map(({ index }) => `${path.slice(root.length + 1)}:${index + 1}`),
    );
    expect(offenders).toEqual([]);
  });
});
