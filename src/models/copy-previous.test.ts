// AI-generated (Claude)
// Unit tests for copying gear and buddies from the previous dive.

import { describe, expect, it } from 'vitest';

import { CylinderUse, DiveMode } from './index';
import type { Cylinder, Dive, DiveSummary, WeightSystem } from './index';
import {
  copyCylinderSetup,
  copyWeights,
  findPreviousDive,
  mergeNames,
} from './copy-previous';
import { buildCylinderPatches, cylinderDraftsFrom } from './cylinder-edit';
import { buildWeightPatches, weightDraftsFrom } from './weight-edit';

function summary(overrides: Partial<DiveSummary> = {}): DiveSummary {
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
    tripLocation: '',
    buddy: '',
    diveguide: '',
    suit: '',
    tags: [],
    cylinderDescriptions: [],
    weightDescriptions: [],
    divemode: DiveMode.OC,
    dcModel: '',
    invalid: false,
    ...overrides,
  };
}

function dive(overrides: Partial<Dive> = {}): Dive {
  return {
    ...summary(),
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
    cylinders: [],
    weightsystems: [],
    dcs: [],
    ...overrides,
  };
}

function cylinder(overrides: Partial<Cylinder> = {}): Cylinder {
  return {
    description: '',
    sizeMl: 0,
    workingPressureMbar: 0,
    gasmix: { o2Permille: 0, hePermille: 0, o2EffectivePermille: 209, heEffectivePermille: 0 },
    startMbar: 0,
    endMbar: 0,
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

function weight(overrides: Partial<WeightSystem> = {}): WeightSystem {
  return { description: 'belt', weightGrams: 6000, autoFilled: false, ...overrides };
}

const ean32 = cylinder({
  description: 'D12 232 bar',
  sizeMl: 12000,
  workingPressureMbar: 232000,
  gasmix: { o2Permille: 320, hePermille: 0, o2EffectivePermille: 320, heEffectivePermille: 0 },
  startMbar: 210000,
  endMbar: 60000,
});

describe('findPreviousDive', () => {
  it('picks the latest dive that started before this one', () => {
    const dives = [
      summary({ id: 1, when: 100 }),
      summary({ id: 2, when: 300 }),
      summary({ id: 3, when: 200 }),
      summary({ id: 4, when: 400 }),
    ];
    expect(findPreviousDive(dives, { id: 4, when: 400 })?.id).toBe(2);
    expect(findPreviousDive(dives, { id: 2, when: 300 })?.id).toBe(3);
  });

  it('has nothing before the first dive', () => {
    const dives = [summary({ id: 1, when: 100 }), summary({ id: 2, when: 200 })];
    expect(findPreviousDive(dives, { id: 1, when: 100 })).toBeUndefined();
  });
});

describe('copyCylinderSetup', () => {
  it('takes the setup but keeps this dive pressures', () => {
    const current = dive({
      cylinders: [cylinder({ sampleStartMbar: 200000, sampleEndMbar: 70000, used: true })],
    });
    const drafts = copyCylinderSetup(cylinderDraftsFrom(current, 'metric'), [ean32], 'metric');

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      sourceIndex: 0,
      description: 'D12 232 bar',
      sizeText: '12',
      workingPressureText: '232',
      o2Text: '32',
      startText: '200',
      endText: '70',
      used: true,
    });
  });

  it('adds missing cylinders without pressures', () => {
    const drafts = copyCylinderSetup([], [ean32, ean32], 'metric');
    expect(drafts).toHaveLength(2);
    expect(drafts.every((draft) => draft.sourceIndex === null)).toBe(true);
    expect(drafts[0].startText).toBe('');
    expect(drafts[0].endText).toBe('');
    expect(drafts[0].key).not.toBe(drafts[1].key);
  });

  it('drops surplus cylinders unless the computer recorded them', () => {
    const current = dive({
      cylinders: [cylinder(), cylinder({ description: 'spare' }), cylinder({ used: true })],
    });
    const drafts = copyCylinderSetup(cylinderDraftsFrom(current, 'metric'), [ean32], 'metric');
    expect(drafts.map((draft) => draft.sourceIndex)).toEqual([0, 2]);
  });

  it('produces a patch the bindings accept', () => {
    const current = dive({ cylinders: [cylinder(), cylinder()] });
    const drafts = copyCylinderSetup(cylinderDraftsFrom(current, 'metric'), [ean32], 'metric');
    expect(buildCylinderPatches(current, drafts, 'metric')).toEqual([
      {
        sourceIndex: 0,
        description: 'D12 232 bar',
        sizeMl: 12000,
        workingPressureMbar: 232000,
        o2Permille: 320,
      },
    ]);
  });
});

describe('copyWeights', () => {
  it('replaces the weights, reusing existing rows', () => {
    const current = dive({ weightsystems: [weight({ weightGrams: 4000 }), weight()] });
    const drafts = copyWeights(
      weightDraftsFrom(current, 'metric'),
      [weight({ description: 'integrated', weightGrams: 8000 })],
      'metric'
    );
    expect(buildWeightPatches(current, drafts, 'metric')).toEqual([
      { sourceIndex: 0, description: 'integrated', weightGrams: 8000 },
    ]);
  });

  it('adds weights to a dive that has none', () => {
    const drafts = copyWeights([], [weight()], 'metric');
    expect(drafts).toMatchObject([{ sourceIndex: null, description: 'belt', weightText: '6' }]);
  });
});

describe('mergeNames', () => {
  it('adds the previous names without duplicating', () => {
    expect(mergeNames('alice', 'Alice, Bob')).toBe('alice, Bob');
    expect(mergeNames('', 'Alice, Bob')).toBe('Alice, Bob');
    expect(mergeNames('Carol', '')).toBe('Carol');
  });
});
