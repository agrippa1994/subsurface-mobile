// AI-generated (Claude)
// Unit conversion tests. Expected values come from the constants in
// subsurface/core/units.h, so a drift here means the app would display
// something the desktop app does not.

import { describe, expect, it } from 'vitest';

import {
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
});

describe('coordinates', () => {
  it('converts microdegrees', () => {
    expect(udegToDegrees(12488540)).toBe(12.48854);
    expect(degreesToUdeg(-61.49134)).toBe(-61491340);
  });
});

describe('formatting', () => {
  it('formats depth in both systems', () => {
    expect(formatDepth(20100)).toBe('20.1 m');
    expect(formatDepth(20100, 'imperial')).toBe('66 ft');
  });

  it('formats pressure in both systems', () => {
    expect(formatPressure(227527)).toBe('228 bar');
    expect(formatPressure(227527, 'imperial')).toBe('3300 psi');
  });

  it('formats temperature in both systems', () => {
    expect(formatTemperature(293150)).toBe('20 C');
    expect(formatTemperature(293150, 'imperial')).toBe('68 F');
  });

  it('formats volume and weight', () => {
    expect(formatVolume(15000)).toBe('15 l');
    expect(formatWeight(4500)).toBe('4.5 kg');
    expect(formatWeight(4536, 'imperial')).toBe('10 lbs');
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
