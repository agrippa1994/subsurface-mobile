// AI-generated (Claude)
// Unit tests for the weights editor's presentation model.

import { describe, expect, it } from 'vitest';

import { DiveMode } from './index';
import type { Dive, WeightSystem } from './index';
import {
  buildWeightPatches,
  formatWeightInput,
  newWeightDraft,
  parseWeightInput,
  totalWeightGrams,
  validateWeightDrafts,
  weightDraftsFrom,
  type WeightDraft,
} from './weight-edit';
import { IMPERIAL_UNITS, METRIC_UNITS } from './units';

function weight(overrides: Partial<WeightSystem> = {}): WeightSystem {
  return {
    description: 'belt',
    weightGrams: 6000,
    autoFilled: false,
    ...overrides,
  };
}

function dive(weightsystems: WeightSystem[]): Dive {
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
    cylinderDescriptions: [],
    weightDescriptions: weightsystems.map((w) => w.description).filter((d) => d !== ''),
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
    totalWeightGrams: weightsystems.reduce((sum, w) => sum + w.weightGrams, 0),
    notrip: false,
    cylinders: [],
    weightsystems,
    dcs: [],
  };
}

describe('unit-aware parsing', () => {
  it('reads weights as kilograms or pounds', () => {
    expect(parseWeightInput('6', METRIC_UNITS)).toBe(6000);
    expect(parseWeightInput('12', IMPERIAL_UNITS)).toBe(5443);
    expect(parseWeightInput('', METRIC_UNITS)).toBeUndefined();
    expect(parseWeightInput('heavy', METRIC_UNITS)).toBeNull();
    expect(parseWeightInput('-2', METRIC_UNITS)).toBeNull();
  });

  it('accepts the comma decimal separator', () => {
    expect(parseWeightInput('6,5', METRIC_UNITS)).toBe(6500);
  });

  it('renders 0 grams as an empty field rather than "0"', () => {
    expect(formatWeightInput(0, METRIC_UNITS)).toBe('');
    expect(formatWeightInput(6000, METRIC_UNITS)).toBe('6');
    expect(formatWeightInput(6500, METRIC_UNITS)).toBe('6.5');
  });
});

describe('weightDraftsFrom', () => {
  it('seeds the fields in the display unit', () => {
    const [metric] = weightDraftsFrom(dive([weight()]), METRIC_UNITS);
    expect(metric.sourceIndex).toBe(0);
    expect(metric.description).toBe('belt');
    expect(metric.weightText).toBe('6');

    const [imperial] = weightDraftsFrom(dive([weight()]), IMPERIAL_UNITS);
    expect(imperial.weightText).toBe('13.2');
  });
});

describe('totalWeightGrams', () => {
  it('sums what the rows currently say, ignoring the blank ones', () => {
    const drafts: WeightDraft[] = [
      { ...newWeightDraft(), weightText: '6' },
      { ...newWeightDraft(), weightText: '2,5' },
      newWeightDraft(),
    ];
    expect(totalWeightGrams(drafts, METRIC_UNITS)).toBe(8500);
  });
});

describe('validateWeightDrafts', () => {
  it('accepts a blank row - a weight with no type or no amount is legitimate', () => {
    expect(validateWeightDrafts([newWeightDraft()], METRIC_UNITS)).toEqual({});
    const named: WeightDraft = { ...newWeightDraft(), description: 'ankle' };
    expect(validateWeightDrafts([named], METRIC_UNITS)).toEqual({});
  });

  it('refuses text where a number belongs', () => {
    const draft: WeightDraft = { ...newWeightDraft(), weightText: 'six' };
    expect(validateWeightDrafts([draft], METRIC_UNITS)[draft.key]).toMatch(/not a number/);
  });
});

describe('buildWeightPatches', () => {
  it('returns null when nothing about the weights changed', () => {
    const d = dive([weight(), weight({ description: 'integrated', weightGrams: 2000 })]);
    expect(buildWeightPatches(d, weightDraftsFrom(d, METRIC_UNITS), METRIC_UNITS)).toBeNull();
  });

  it('names only the fields that differ, and keeps the rest as sourceIndex', () => {
    const d = dive([weight(), weight({ description: 'integrated', weightGrams: 2000 })]);
    const drafts = weightDraftsFrom(d, METRIC_UNITS);
    drafts[0] = { ...drafts[0], weightText: '4' };

    expect(buildWeightPatches(d, drafts, METRIC_UNITS)).toEqual([
      { sourceIndex: 0, weightGrams: 4000 },
      { sourceIndex: 1 },
    ]);
  });

  it('sends the whole list, so a removed weight is one that is simply absent', () => {
    const d = dive([weight(), weight({ description: 'integrated' })]);
    const drafts = weightDraftsFrom(d, METRIC_UNITS).slice(0, 1);

    expect(buildWeightPatches(d, drafts, METRIC_UNITS)).toEqual([{ sourceIndex: 0 }]);
  });

  it('sends a new weight in full, with no sourceIndex', () => {
    const d = dive([weight()]);
    const drafts = [
      ...weightDraftsFrom(d, METRIC_UNITS),
      { ...newWeightDraft(), description: 'ankle', weightText: '1' },
    ];

    expect(buildWeightPatches(d, drafts, METRIC_UNITS)).toEqual([
      { sourceIndex: 0 },
      { description: 'ankle', weightGrams: 1000 },
    ]);
  });

  it('refuses to build a patch that reorders weights', () => {
    const d = dive([weight(), weight({ description: 'integrated' })]);
    const drafts = weightDraftsFrom(d, METRIC_UNITS).reverse();
    expect(() => buildWeightPatches(d, drafts, METRIC_UNITS)).toThrow(/reorder/i);
  });

  it('leaves an untouched imperial draft alone despite the rounding', () => {
    // 5987 g renders as "13.2" lbs; re-parsing that gives 5988 g. Comparing the
    // text rather than the number is what keeps this a no-op.
    const d = dive([weight({ weightGrams: 5987 })]);
    expect(buildWeightPatches(d, weightDraftsFrom(d, IMPERIAL_UNITS), IMPERIAL_UNITS)).toBeNull();
  });
});
