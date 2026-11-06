// AI-generated (Claude)
// Tests for the several-computers presentation model.

import { describe, expect, it } from 'vitest';

import {
  computerFigures,
  computerLabels,
  computerPositionText,
  plotForComputer,
  selectedComputerIndex,
} from './dive-computers';
import { DiveMode, type DiveComputer } from './index';

function computer(fields: Partial<DiveComputer> = {}): DiveComputer {
  return {
    model: 'Suunto Vyper',
    serial: '',
    fwVersion: '',
    deviceId: 0,
    diveId: 0,
    when: 0,
    durationSec: 0,
    surfaceTimeSec: 0,
    maxDepthMm: 0,
    meanDepthMm: 0,
    airTempMkelvin: 0,
    waterTempMkelvin: 0,
    surfacePressureMbar: 0,
    divemode: DiveMode.OC,
    noO2sensors: 0,
    salinity: 0,
    timezoneOffset: 0,
    sampleCount: 0,
    events: [],
    extraData: [],
    ...fields,
  };
}

describe('selectedComputerIndex', () => {
  it('keeps a selection on the dive it was made on', () => {
    expect(selectedComputerIndex({ diveId: 7, index: 2 }, 7, 3)).toBe(2);
  });

  it('starts at the first computer on another dive', () => {
    expect(selectedComputerIndex({ diveId: 7, index: 2 }, 8, 3)).toBe(0);
  });

  it('falls back to the first computer when the selected one is gone', () => {
    expect(selectedComputerIndex({ diveId: 7, index: 2 }, 7, 2)).toBe(0);
  });

  it('answers 0 before the dive has loaded', () => {
    expect(selectedComputerIndex({ diveId: 7, index: 0 }, 7, 0)).toBe(0);
  });
});

describe('computerLabels', () => {
  it('uses the model of computers that differ', () => {
    expect(
      computerLabels([computer({ model: 'Uemis Zurich' }), computer({ model: 'Shearwater Petrel' })]),
    ).toEqual(['Uemis Zurich', 'Shearwater Petrel']);
  });

  it('tells the same model apart by serial', () => {
    expect(
      computerLabels([computer({ serial: '111' }), computer({ serial: '222' })]),
    ).toEqual(['Suunto Vyper (111)', 'Suunto Vyper (222)']);
  });

  it('falls back to position when the serial does not help', () => {
    expect(computerLabels([computer(), computer(), computer({ model: 'Other' })])).toEqual([
      'Suunto Vyper (1)',
      'Suunto Vyper (2)',
      'Other',
    ]);
    expect(
      computerLabels([computer({ serial: '111' }), computer({ serial: '111' })]),
    ).toEqual(['Suunto Vyper (111) (1)', 'Suunto Vyper (111) (2)']);
  });

  it('names a computer without a model, and capitalises the core strings', () => {
    expect(computerLabels([computer({ model: ' ' }), computer({ model: 'manually added dive' })])).toEqual([
      'Unknown computer',
      'Manually added dive',
    ]);
  });
});

describe('computerPositionText', () => {
  it('reads the name and the position', () => {
    expect(computerPositionText('Uemis Zurich', 1, 3)).toBe('Uemis Zurich, 2 of 3');
  });
});

describe('computerFigures', () => {
  it('leaves out what the computer did not record, but always states the mode', () => {
    expect(computerFigures(computer({ divemode: DiveMode.CCR }), 'metric')).toEqual([
      { label: 'Mode', value: 'CCR' },
    ]);
  });

  it('formats what it recorded in the chosen units', () => {
    const figures = computerFigures(
      computer({
        maxDepthMm: 24080,
        meanDepthMm: 12118,
        durationSec: 3790,
        waterTempMkelvin: 303050,
        airTempMkelvin: 293150,
      }),
      'metric',
    );
    expect(figures.map((figure) => figure.label)).toEqual([
      'Mode',
      'Max depth',
      'Average depth',
      'Duration',
      'Water',
      'Air',
    ]);
    expect(figures[1].value).toContain('24');
  });
});

describe('plotForComputer', () => {
  const plot = { maxDepthMm: 24430, maxSec: 3800, depth: [{ sec: 0 }, { sec: 3600 }] };

  it("takes the selected computer's depth and time on a dive with several", () => {
    const computers = [computer({ maxDepthMm: 24430 }), computer({ maxDepthMm: 24080 })];
    expect(plotForComputer(plot, computers, 1)).toMatchObject({ maxDepthMm: 24080, maxSec: 3600 });
  });

  it("keeps the dive's figures for what the computer did not record", () => {
    const computers = [computer({ maxDepthMm: 24430 }), computer()];
    const empty = { ...plot, depth: [] };
    expect(plotForComputer(empty, computers, 1)).toMatchObject({ maxDepthMm: 24430, maxSec: 3800 });
  });

  it('leaves a dive with one computer untouched', () => {
    expect(plotForComputer(plot, [computer({ maxDepthMm: 20000 })], 0)).toBe(plot);
  });
});
