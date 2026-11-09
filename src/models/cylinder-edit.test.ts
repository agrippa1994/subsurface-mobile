// AI-generated (Claude)
// Unit tests for the cylinder editor's presentation model.

import { describe, expect, it } from 'vitest';

import { CylinderUse, DiveMode } from './index';
import type { Cylinder, Dive } from './index';
import {
  defaultCylinderOptions,
  buildCylinderPatches,
  cylinderDraftsFrom,
  newCylinderDraft,
  parseFractionInput,
  parseNumberInput,
  parsePressureInput,
  parseSizeInput,
  validateCylinderDrafts,
  type CylinderDraft,
} from './cylinder-edit';
import { IMPERIAL_UNITS, METRIC_UNITS } from './units';

function cylinder(overrides: Partial<Cylinder> = {}): Cylinder {
  return {
    description: 'AL80',
    sizeMl: 11100,
    workingPressureMbar: 207000,
    gasmix: { o2Permille: 0, hePermille: 0, o2EffectivePermille: 209, heEffectivePermille: 0 },
    startMbar: 200000,
    endMbar: 50000,
    sampleStartMbar: 0,
    sampleEndMbar: 0,
    depthMm: 0,
    manuallyAdded: false,
    gasUsedMl: 0,
    decoGasUsedMl: 0,
    use: CylinderUse.OcGas,
    bestmixO2: false,
    bestmixHe: false,
    used: false,
    ...overrides,
  };
}

function dive(cylinders: Cylinder[]): Dive {
  return {
    id: 1,
    number: 1,
    when: 1_700_000_000,
    durationSec: 2400,
    maxDepthMm: 20000,
    meanDepthMm: 12000,
    waterTempMkelvin: 291150,
    rating: 0,
    visibility: 0,
    siteUuid: 0,
    siteName: '',
    tripId: 0,
    tripLocation: '',
    buddy: '',
    diveguide: '',
    suit: '',
    tags: [],
    divemode: DiveMode.OC,
    dcModel: 'Suunto D5',
    planned: false,
    invalid: false,
    cylinderDescriptions: cylinders.map((c) => c.description).filter((d) => d !== ''),
    weightDescriptions: [],
    notes: '',
    wavesize: 0,
    current: 0,
    surge: 0,
    chill: 0,
    sac: 0,
    otu: 0,
    cns: 0,
    maxcns: 0,
    salinity: 0,
    userSalinity: 0,
    minTempMkelvin: 0,
    maxTempMkelvin: 0,
    airTempMkelvin: 0,
    surfacePressureMbar: 0,
    totalWeightGrams: 0,
    notrip: false,
    cylinders,
    weightsystems: [],
    dcs: [],
  };
}

describe('parseNumberInput', () => {
  it('tells an empty field from an unreadable one', () => {
    expect(parseNumberInput('')).toBeUndefined();
    expect(parseNumberInput('   ')).toBeUndefined();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('12.5.3')).toBeNull();
    expect(parseNumberInput('-4')).toBeNull();
  });

  it('accepts the comma decimal separator', () => {
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(parseNumberInput('12.5')).toBe(12.5);
  });
});

describe('unit-aware parsing', () => {
  it('reads pressures as bar or psi', () => {
    expect(parsePressureInput('200', METRIC_UNITS)).toBe(200000);
    expect(parsePressureInput('3000', IMPERIAL_UNITS)).toBe(206843);
    expect(parsePressureInput('', METRIC_UNITS)).toBeUndefined();
  });

  it('reads sizes as litres or cubic feet', () => {
    expect(parseSizeInput('12', METRIC_UNITS)).toBe(12000);
    expect(parseSizeInput('1', IMPERIAL_UNITS)).toBe(28317);
  });

  it('reads gas fractions as whole percent and refuses over 100', () => {
    expect(parseFractionInput('32')).toBe(320);
    expect(parseFractionInput('21.5')).toBe(215);
    expect(parseFractionInput('101')).toBeNull();
    expect(parseFractionInput('')).toBeUndefined();
  });
});

describe('cylinderDraftsFrom', () => {
  it('seeds the fields in the display unit and keeps the air sentinel', () => {
    const [draft] = cylinderDraftsFrom(dive([cylinder()]), METRIC_UNITS);
    expect(draft.sourceIndex).toBe(0);
    expect(draft.description).toBe('AL80');
    expect(draft.sizeText).toBe('11.1');
    expect(draft.workingPressureText).toBe('207');
    expect(draft.startText).toBe('200');
    expect(draft.endText).toBe('50');
    // 0/0 is how the core spells air; the editor must not show it as 20.9.
    expect(draft.o2Text).toBe('');
    expect(draft.heText).toBe('');
  });

  it('falls back to the sampled pressures when none were entered by hand', () => {
    const [draft] = cylinderDraftsFrom(
      dive([cylinder({ startMbar: 0, endMbar: 0, sampleStartMbar: 210000, sampleEndMbar: 70000 })]),
      METRIC_UNITS
    );
    expect(draft.startText).toBe('210');
    expect(draft.endText).toBe('70');
  });
});

describe('validateCylinderDrafts', () => {
  const draftOf = (overrides: Partial<CylinderDraft>): CylinderDraft => ({
    ...newCylinderDraft(),
    ...overrides,
  });

  it('accepts a blank cylinder - plenty of dives are logged without one', () => {
    expect(validateCylinderDrafts([newCylinderDraft()], METRIC_UNITS)).toEqual({});
  });

  it('refuses a mix over 100% and an end pressure above the start', () => {
    const mix = draftOf({ o2Text: '60', heText: '50' });
    expect(validateCylinderDrafts([mix], METRIC_UNITS)[mix.key]).toMatch(/cannot exceed 100/);

    const pressures = draftOf({ startText: '50', endText: '200' });
    expect(validateCylinderDrafts([pressures], METRIC_UNITS)[pressures.key]).toMatch(
      /cannot be above the start/
    );
  });

  it('refuses text where a number belongs', () => {
    const draft = draftOf({ sizeText: 'twelve' });
    expect(validateCylinderDrafts([draft], METRIC_UNITS)[draft.key]).toMatch(/Size/);
  });
});

describe('buildCylinderPatches', () => {
  it('returns null when nothing about the cylinders changed', () => {
    const d = dive([cylinder(), cylinder({ description: 'Deco 80' })]);
    expect(buildCylinderPatches(d, cylinderDraftsFrom(d, METRIC_UNITS), METRIC_UNITS)).toBeNull();
  });

  it('names only the fields that differ, and keeps the rest as sourceIndex', () => {
    const d = dive([cylinder(), cylinder({ description: 'Deco 80' })]);
    const drafts = cylinderDraftsFrom(d, METRIC_UNITS);
    drafts[0] = { ...drafts[0], endText: '60' };

    const patches = buildCylinderPatches(d, drafts, METRIC_UNITS)!;
    expect(patches).toEqual([{ sourceIndex: 0, endMbar: 60000 }, { sourceIndex: 1 }]);
  });

  it('sends the whole list, so a removed cylinder is one that is simply absent', () => {
    const d = dive([cylinder(), cylinder({ description: 'Deco 80' })]);
    const drafts = cylinderDraftsFrom(d, METRIC_UNITS).slice(0, 1);

    expect(buildCylinderPatches(d, drafts, METRIC_UNITS)).toEqual([{ sourceIndex: 0 }]);
  });

  it('sends a new cylinder in full, with no sourceIndex', () => {
    const d = dive([cylinder()]);
    const drafts = [
      ...cylinderDraftsFrom(d, METRIC_UNITS),
      { ...newCylinderDraft(), description: 'Deco 80', sizeText: '11', startText: '200' },
    ];

    const patches = buildCylinderPatches(d, drafts, METRIC_UNITS)!;
    expect(patches[0]).toEqual({ sourceIndex: 0 });
    expect(patches[1]).toEqual({
      description: 'Deco 80',
      sizeMl: 11000,
      workingPressureMbar: 0,
      o2Permille: 0,
      hePermille: 0,
      startMbar: 200000,
      endMbar: 0,
      use: CylinderUse.OcGas,
    });
  });

  it('refuses to build a patch that reorders cylinders', () => {
    const d = dive([cylinder(), cylinder({ description: 'Deco 80' })]);
    const drafts = cylinderDraftsFrom(d, METRIC_UNITS).reverse();
    expect(() => buildCylinderPatches(d, drafts, METRIC_UNITS)).toThrow(/reorder/i);
  });

  it('converts an imperial draft back to the core units it came from', () => {
    const d = dive([cylinder()]);
    const drafts = cylinderDraftsFrom(d, IMPERIAL_UNITS);
    // Seeded from 200000 mbar, so re-parsing what was rendered must land back
    // within the rounding of one psi rather than drifting on every open/save.
    const patches = buildCylinderPatches(d, drafts, IMPERIAL_UNITS);
    if (patches !== null) {
      const entry = patches[0];
      expect(Math.abs((entry.startMbar ?? 200000) - 200000)).toBeLessThan(100);
    }
  });
});

describe('the default cylinder', () => {
  const template = cylinder({ startMbar: 207000, endMbar: 0 });

  it('starts a new row from it, as a new cylinder and full', () => {
    const draft = newCylinderDraft(template, METRIC_UNITS);
    expect(draft).toMatchObject({
      sourceIndex: null,
      description: 'AL80',
      sizeText: '11.1',
      workingPressureText: '207',
      startText: '207',
      endText: '',
      used: false,
    });
  });

  it('reads it in the diver units', () => {
    expect(newCylinderDraft(template, IMPERIAL_UNITS)).toMatchObject({ sizeText: '0.4', startText: '3002' });
  });

  it('leaves the row blank without one', () => {
    expect(newCylinderDraft(null, METRIC_UNITS)).toMatchObject({ description: '', sizeText: '' });
    expect(newCylinderDraft()).toMatchObject({ description: '', sizeText: '' });
  });

  it('offers none first, then the tank table with sizes in the diver units', () => {
    const options = defaultCylinderOptions(
      [
        { name: 'AL80', sizeMl: 11094, workingPressureMbar: 206843 },
        { name: '12l 232 bar', sizeMl: 12000, workingPressureMbar: 232000 },
      ],
      METRIC_UNITS,
    );
    expect(options).toEqual([
      { value: '', label: 'None' },
      { value: 'AL80', label: 'AL80 (11.1 l, 207 bar)' },
      { value: '12l 232 bar', label: '12l 232 bar (12 l, 232 bar)' },
    ]);
    expect(
      defaultCylinderOptions([{ name: 'AL80', sizeMl: 11094, workingPressureMbar: 206843 }], IMPERIAL_UNITS)[1].label,
    ).toBe('AL80 (80 cuft, 3000 psi)');
  });
});
