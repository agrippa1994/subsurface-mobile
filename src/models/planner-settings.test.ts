// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { PlanDecoMode } from './index';
import {
  DEFAULT_PLANNER_SETTINGS,
  parsePlannerSettings,
  plannerSettingsInput,
  PLANNER_SETTING_SECTIONS,
  rateFromValue,
  rateValue,
  snapToStep,
  type StepperSetting,
} from './planner-settings';
import { IMPERIAL_UNITS, METRIC_UNITS } from './units';

const gf = { gfLow: 35, gfHigh: 80 };
const steppers = PLANNER_SETTING_SECTIONS.flatMap((section) => section.settings).filter(
  (setting): setting is StepperSetting => setting.kind === 'stepper',
);
const stepper = (key: string) => {
  const found = steppers.find((setting) => setting.key === key);
  if (!found) {
    throw new Error(`no stepper ${key}`);
  }
  return found;
};

describe('plannerSettingsInput', () => {
  it('follows the gradient factors of Settings until the planner has its own', () => {
    expect(plannerSettingsInput(DEFAULT_PLANNER_SETTINGS, METRIC_UNITS, gf)).toMatchObject({
      gfLow: 35,
      gfHigh: 80,
    });
    const own = { ...DEFAULT_PLANNER_SETTINGS, gfLow: 50, gfHigh: 70 };
    expect(plannerSettingsInput(own, METRIC_UNITS, gf)).toMatchObject({ gfLow: 50, gfHigh: 70 });
  });

  it('never sends a low above a high, which the bindings refuse', () => {
    const own = { ...DEFAULT_PLANNER_SETTINGS, gfLow: 90 };
    expect(plannerSettingsInput(own, METRIC_UNITS, gf)).toMatchObject({ gfLow: 90, gfHigh: 90 });
  });

  it('leaves the surface pressure out and says which units the notes are in', () => {
    const input = plannerSettingsInput(DEFAULT_PLANNER_SETTINGS, IMPERIAL_UNITS, gf);
    expect(input.units).toEqual(IMPERIAL_UNITS);
    expect(input).not.toHaveProperty('surfacePressureMbar');
  });
});

describe('rates', () => {
  it('shows the core default of 150 mm/s as 9 m/min and about 30 ft/min', () => {
    expect(rateValue(150, METRIC_UNITS)).toBe(9);
    expect(rateValue(150, IMPERIAL_UNITS)).toBe(30);
  });

  it('survives the round trip through the unit shown', () => {
    expect(rateValue(rateFromValue(18, METRIC_UNITS), METRIC_UNITS)).toBe(18);
    expect(rateValue(rateFromValue(60, IMPERIAL_UNITS), IMPERIAL_UNITS)).toBe(60);
  });
});

describe('the settings table', () => {
  it('holds every setting of the legacy setup page', () => {
    const keys = PLANNER_SETTING_SECTIONS.flatMap((section) => section.settings).map((s) => s.key);
    for (const key of [
      'ascrate75', 'ascrate50', 'ascratestops', 'ascratelast6m', 'descrate', 'dropStone',
      'gfLow', 'gfHigh', 'vpmbConservatism', 'reserveGasMbar', 'safetyStop', 'lastStop6m',
      'o2Breaks', 'switchAtRequiredStop', 'minSwitchSec', 'surfaceSegmentSec', 'bottomSacMl',
      'decoSacMl', 'sacFactor', 'problemSolvingMin', 'bottomPo2Mbar', 'decoPo2Mbar',
      'defaultSetpointMbar', 'bestMixEndMm', 'o2Narcotic', 'displayRuntime', 'displayDuration',
      'displayTransitions', 'verbatim', 'displayVariations',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('only shows what applies to the deco mode', () => {
    const visible = (decoMode: PlanDecoMode) =>
      steppers
        .filter((s) => s.visible?.({ ...DEFAULT_PLANNER_SETTINGS, decoMode }) ?? true)
        .map((s) => s.key);
    expect(visible(PlanDecoMode.Buehlmann)).toContain('gfLow');
    expect(visible(PlanDecoMode.Buehlmann)).not.toContain('vpmbConservatism');
    expect(visible(PlanDecoMode.VpmB)).toContain('vpmbConservatism');
    expect(visible(PlanDecoMode.Recreational)).toContain('reserveGasMbar');
    expect(visible(PlanDecoMode.Recreational)).not.toContain('minSwitchSec');
  });

  it('reads and writes the core units through the unit shown', () => {
    const s = DEFAULT_PLANNER_SETTINGS;
    const sac = stepper('bottomSacMl');
    expect(sac.value(s, METRIC_UNITS, gf)).toBe(20);
    expect(sac.patch(15, METRIC_UNITS)).toEqual({ bottomSacMl: 15000 });
    expect(sac.value(s, IMPERIAL_UNITS, gf)).toBe(0.7);
    expect(sac.format(0.7, IMPERIAL_UNITS)).toBe('0.70 cuft/min');

    const factor = stepper('sacFactor');
    expect(factor.value(s, METRIC_UNITS, gf)).toBe(4);
    expect(factor.patch(3.5, METRIC_UNITS)).toEqual({ sacFactor: 350 });

    const minSwitch = stepper('minSwitchSec');
    expect(minSwitch.value(s, METRIC_UNITS, gf)).toBe(1);
    expect(minSwitch.patch(2, METRIC_UNITS)).toEqual({ minSwitchSec: 120 });

    const po2 = stepper('decoPo2Mbar');
    expect(po2.format(po2.value(s, METRIC_UNITS, gf), METRIC_UNITS)).toBe('1.60 bar');
    expect(po2.patch(1.45, METRIC_UNITS)).toEqual({ decoPo2Mbar: 1450 });
  });
});

describe('snapToStep', () => {
  it('collects no float dust and stays in range', () => {
    expect(snapToStep(0.1 + 0.2, { min: 0, max: 1, step: 0.05 })).toBe(0.3);
    expect(snapToStep(5, { min: 0, max: 1, step: 0.05 })).toBe(1);
  });
});

describe('parsePlannerSettings', () => {
  it('fills in what a file written before the planner does not have', () => {
    expect(parsePlannerSettings(undefined)).toEqual(DEFAULT_PLANNER_SETTINGS);
  });

  it('keeps what is valid and refuses what the bindings would', () => {
    const parsed = parsePlannerSettings({
      ascrate75: 0,
      descrate: 200,
      verbatim: 'yes',
      safetyStop: false,
      gfLow: 500,
      gfHigh: 90,
      decoMode: 9,
    });
    expect(parsed.ascrate75).toBe(DEFAULT_PLANNER_SETTINGS.ascrate75);
    expect(parsed.descrate).toBe(200);
    expect(parsed.verbatim).toBe(false);
    expect(parsed.safetyStop).toBe(false);
    expect(parsed.gfHigh).toBe(90);
    expect(parsed.gfLow).toBeNull();
    expect(parsed.decoMode).toBe(PlanDecoMode.Buehlmann);
  });
});
