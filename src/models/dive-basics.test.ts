// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { Dive, DiveSummary, Trip } from './index';
import {
  buildDiveBasicsPatch,
  buildNewDiveBasics,
  dateNotes,
  diveBasicsDraftFrom,
  formatDurationInput,
  formatDepthInput,
  formatTemperatureInput,
  isManualDive,
  localNowWhen,
  MANUAL_DC_MODEL,
  MAX_WHEN,
  newDiveBasicsDraft,
  overlappingDives,
  parseDepthInput,
  parseDurationInput,
  parseTemperatureInput,
  validateDiveBasics,
  type DiveBasicsDraft,
} from './dive-basics';
import { celsiusToMkelvin , IMPERIAL_UNITS, METRIC_UNITS } from './units';

const NOW = 1772359200;

function dive(overrides: Partial<Dive> = {}): Dive {
  return {
    id: 1,
    number: 7,
    when: NOW - 86400,
    durationSec: 2730,
    maxDepthMm: 24380,
    meanDepthMm: 14120,
    airTempMkelvin: 295150,
    waterTempMkelvin: 288650,
    dcModel: 'Suunto D5',
    tripId: 0,
    tripLocation: '',
    siteName: '',
    ...overrides,
  } as Dive;
}

function draft(overrides: Partial<DiveBasicsDraft> = {}): DiveBasicsDraft {
  return { ...newDiveBasicsDraft(NOW), durationText: '45', maxDepthText: '24', ...overrides };
}

const NEW = { profileEditable: true, allowFuture: false, now: NOW };

describe('isManualDive', () => {
  it('goes by the model the core gives such a dive', () => {
    expect(isManualDive({ dcModel: MANUAL_DC_MODEL })).toBe(true);
    expect(isManualDive({ dcModel: 'Suunto D5' })).toBe(false);
    expect(isManualDive({ dcModel: '' })).toBe(false);
  });
});

describe('localNowWhen', () => {
  it('writes wall-clock time as if it were UTC, to the minute', () => {
    // 10:00:30 UTC, in UTC+2: getTimezoneOffset() says -120.
    expect(localNowWhen((NOW + 30) * 1000, -120)).toBe(NOW + 7200);
    expect(localNowWhen((NOW + 30) * 1000, 300)).toBe(NOW - 18000);
  });
});

describe('parseDurationInput', () => {
  it.each([
    ['45', 2700],
    [' 45 ', 2700],
    ['45 min', 2700],
    ['45min', 2700],
    ['90', 5400],
    ['1:05', 3900],
    ['0:45', 2700],
    ['1:05:30', 3930],
    ['1h', 3600],
    ['1 h 5 min', 3900],
    ['1h5min', 3900],
  ])('reads %s', (text, seconds) => {
    expect(parseDurationInput(text)).toBe(seconds);
  });

  it('tells empty from wrong', () => {
    expect(parseDurationInput('  ')).toBeUndefined();
    for (const text of ['abc', '1:5', '1:75', '1:05:75', '-5', '4.5', '1:2:3:4']) {
      expect(parseDurationInput(text)).toBeNull();
    }
  });

  it('reads back what it shows', () => {
    for (const seconds of [60, 2700, 3900, 2730, 3930, 86400]) {
      expect(parseDurationInput(formatDurationInput(seconds))).toBe(seconds);
    }
    expect(formatDurationInput(0)).toBe('');
    expect(formatDurationInput(2730)).toBe('0:45:30');
  });
});

describe('depth and temperature text', () => {
  it('is in the diver\'s units', () => {
    expect(formatDepthInput(24380, METRIC_UNITS)).toBe('24.4');
    expect(formatDepthInput(24380, IMPERIAL_UNITS)).toBe('80');
    expect(parseDepthInput('24,5', METRIC_UNITS)).toBe(24500);
    expect(parseDepthInput('80', IMPERIAL_UNITS)).toBeCloseTo(24384, -1);
    expect(parseDepthInput('', METRIC_UNITS)).toBeUndefined();
    expect(parseDepthInput('deep', METRIC_UNITS)).toBeNull();

    expect(formatTemperatureInput(celsiusToMkelvin(18), METRIC_UNITS)).toBe('18');
    expect(formatTemperatureInput(celsiusToMkelvin(18), IMPERIAL_UNITS)).toBe('64.4');
    expect(parseTemperatureInput('18', METRIC_UNITS)).toBe(291150);
    expect(parseTemperatureInput('64.4', IMPERIAL_UNITS)).toBe(291150);
    expect(parseTemperatureInput('', METRIC_UNITS)).toBeUndefined();
    expect(parseTemperatureInput('warm', METRIC_UNITS)).toBeNull();
  });

  it('takes a temperature below zero', () => {
    expect(parseTemperatureInput('-2', METRIC_UNITS)).toBe(271150);
    expect(parseTemperatureInput('−2', METRIC_UNITS)).toBe(271150);
    expect(parseTemperatureInput('0', METRIC_UNITS)).toBe(273150);
    expect(formatTemperatureInput(273150, METRIC_UNITS)).toBe('0');
  });

  it('keeps 0 C apart from no temperature', () => {
    expect(formatTemperatureInput(0, METRIC_UNITS)).toBe('');
  });
});

describe('validateDiveBasics', () => {
  it('passes a plain dive', () => {
    expect(validateDiveBasics(draft(), METRIC_UNITS, NEW)).toEqual({});
  });

  it('wants a duration and a depth, and says which', () => {
    const errors = validateDiveBasics(newDiveBasicsDraft(NOW), METRIC_UNITS, NEW);
    expect(errors.durationText).toMatch(/how long/);
    expect(errors.maxDepthText).toMatch(/how deep/);
  });

  it('refuses what the bindings would', () => {
    const check = (over: Partial<DiveBasicsDraft>) =>
      validateDiveBasics(draft(over), METRIC_UNITS, NEW);
    expect(check({ durationText: 'long' }).durationText).toBeDefined();
    expect(check({ durationText: '0' }).durationText).toBeDefined();
    expect(check({ durationText: '1441' }).durationText).toMatch(/24 hours/);
    expect(check({ maxDepthText: '0.5' }).maxDepthText).toBeDefined();
    expect(check({ maxDepthText: '501' }).maxDepthText).toMatch(/1 to 500 m/);
    expect(check({ meanDepthText: '24' }).meanDepthText).toMatch(/less than/);
    expect(check({ meanDepthText: 'x' }).meanDepthText).toBeDefined();
    expect(check({ meanDepthText: '2' }).meanDepthText).toMatch(/tenth/);
    expect(check({ meanDepthText: '12' }).meanDepthText).toBeUndefined();
    expect(check({ when: MAX_WHEN }).when).toMatch(/2029/);
    expect(check({ when: 0 }).when).toMatch(/1970/);
  });

  it('gives its limits in the diver\'s units', () => {
    const errors = validateDiveBasics(draft({ maxDepthText: '2000' }), IMPERIAL_UNITS, NEW);
    expect(errors.maxDepthText).toMatch(/3 to 1640 ft/);
  });

  it('refuses the future, with a day of slack, except on a plan', () => {
    expect(validateDiveBasics(draft({ when: NOW + 3600 }), METRIC_UNITS, NEW).when).toBeUndefined();
    expect(validateDiveBasics(draft({ when: NOW + 90000 }), METRIC_UNITS, NEW).when).toMatch(/future/);
    expect(
      validateDiveBasics(draft({ when: NOW + 90000 }), METRIC_UNITS, { ...NEW, allowFuture: true }).when,
    ).toBeUndefined();
  });

  it('refuses temperatures nobody dives in', () => {
    const errors = validateDiveBasics(
      draft({ airTempText: '90', waterTempText: 'cold' }),
      METRIC_UNITS,
      NEW,
    );
    expect(errors.airTempText).toMatch(/-70 to 70 C/);
    expect(errors.waterTempText).toBeDefined();
    expect(validateDiveBasics(draft({ waterTempText: '-2' }), METRIC_UNITS, NEW)).toEqual({});
  });

  it('refuses a number that is not one', () => {
    expect(validateDiveBasics(draft({ numberText: '4.5' }), METRIC_UNITS, NEW).numberText).toBeDefined();
    expect(validateDiveBasics(draft({ numberText: '' }), METRIC_UNITS, NEW)).toEqual({});
  });

  it('asks nothing of a downloaded dive\'s depth and duration', () => {
    const errors = validateDiveBasics(newDiveBasicsDraft(NOW), METRIC_UNITS, {
      ...NEW,
      profileEditable: false,
    });
    expect(errors).toEqual({});
  });

  it('holds nothing against a dive for what it already had', () => {
    const old = dive({ when: NOW + 90000, airTempMkelvin: celsiusToMkelvin(95) });
    const seed = diveBasicsDraftFrom(old, METRIC_UNITS);
    expect(
      validateDiveBasics(seed, METRIC_UNITS, { ...NEW, profileEditable: false, seed }),
    ).toEqual({});
  });
});

describe('buildDiveBasicsPatch', () => {
  it('is empty when nothing was touched, in either unit system', () => {
    for (const system of [METRIC_UNITS, IMPERIAL_UNITS]) {
      for (const dcModel of ['Suunto D5', MANUAL_DC_MODEL]) {
        const it = dive({ dcModel });
        expect(buildDiveBasicsPatch(it, diveBasicsDraftFrom(it, system), system)).toEqual({});
      }
    }
  });

  it('sends what any dive may change', () => {
    const it = dive();
    const patch = buildDiveBasicsPatch(
      it,
      {
        ...diveBasicsDraftFrom(it, METRIC_UNITS),
        when: NOW,
        airTempText: '30',
        waterTempText: '',
        numberText: '12',
      },
      METRIC_UNITS,
    );
    expect(patch).toEqual({
      when: NOW,
      airTempMkelvin: 303150,
      waterTempMkelvin: 0,
      number: 12,
    });
  });

  it('sends depth and duration only for a manual dive', () => {
    const changes = { durationText: '50', maxDepthText: '30', meanDepthText: '12' };
    const downloaded = dive();
    expect(
      buildDiveBasicsPatch(
        downloaded,
        { ...diveBasicsDraftFrom(downloaded, METRIC_UNITS), ...changes },
        METRIC_UNITS,
      ),
    ).toEqual({});
    const manual = dive({ dcModel: MANUAL_DC_MODEL });
    expect(
      buildDiveBasicsPatch(manual, { ...diveBasicsDraftFrom(manual, METRIC_UNITS), ...changes }, METRIC_UNITS),
    ).toEqual({ durationSec: 3000, maxDepthMm: 30000, meanDepthMm: 12000 });
  });

  it('leaves the average to the core when only the maximum changed', () => {
    const manual = dive({ dcModel: MANUAL_DC_MODEL });
    expect(
      buildDiveBasicsPatch(manual, { ...diveBasicsDraftFrom(manual, METRIC_UNITS), maxDepthText: '30' }, METRIC_UNITS),
    ).toEqual({ maxDepthMm: 30000 });
  });

  it('clears a number', () => {
    const it = dive();
    expect(
      buildDiveBasicsPatch(it, { ...diveBasicsDraftFrom(it, METRIC_UNITS), numberText: '' }, METRIC_UNITS),
    ).toEqual({ number: 0 });
  });
});

describe('buildNewDiveBasics', () => {
  it('sends only what was filled in', () => {
    expect(buildNewDiveBasics(draft(), METRIC_UNITS)).toEqual({
      when: NOW,
      durationSec: 2700,
      maxDepthMm: 24000,
    });
  });

  it('converts from the diver\'s units', () => {
    const input = buildNewDiveBasics(
      draft({ maxDepthText: '100', meanDepthText: '50', airTempText: '77', waterTempText: '59' }),
      IMPERIAL_UNITS,
    );
    expect(input.maxDepthMm).toBe(30480);
    expect(input.meanDepthMm).toBe(15240);
    expect(input.airTempMkelvin).toBe(298150);
    expect(input.waterTempMkelvin).toBe(288150);
  });

  it('takes a temperature of zero', () => {
    expect(buildNewDiveBasics(draft({ waterTempText: '0' }), METRIC_UNITS).waterTempMkelvin).toBe(273150);
  });
});

describe('what a date runs into', () => {
  const others = [
    { id: 2, number: 3, when: NOW, durationSec: 3000, siteName: 'Blue Hole' },
    { id: 3, number: 0, when: NOW + 2000, durationSec: 3000, siteName: 'Reef' },
    { id: 4, number: 5, when: NOW + 90000, durationSec: 3000, siteName: '' },
  ] as DiveSummary[];
  const trip = {
    id: 9,
    location: 'Red Sea',
    notes: '',
    diveCount: 2,
    when: NOW - 86400,
    lastDiveWhen: NOW + 86400,
  } as Trip;

  it('finds what overlaps, and not what merely touches', () => {
    expect(overlappingDives(others, NOW + 100, 60).map((d) => d.id)).toEqual([2]);
    expect(overlappingDives(others, NOW + 2500, 60).map((d) => d.id)).toEqual([2, 3]);
    expect(overlappingDives(others, NOW - 100, 100)).toEqual([]);
    expect(overlappingDives(others, NOW + 100, 60, 2)).toEqual([]);
  });

  it('warns of an overlap by name', () => {
    const notes = dateNotes({ dives: others, trips: [], when: NOW + 100, durationSec: 60 });
    expect(notes[0]).toBe('This overlaps dive 3.');
    expect(
      dateNotes({ dives: others, trips: [], when: NOW + 2500, durationSec: 60 })[0],
    ).toBe('This overlaps dive 3 and 1 more.');
    expect(
      dateNotes({ dives: [others[1]], trips: [], when: NOW + 2500, durationSec: 60 })[0],
    ).toBe('This overlaps Reef.');
  });

  it('says a new dive joins no trip and gets no number', () => {
    const notes = dateNotes({ dives: others, trips: [trip], when: NOW + 5400, durationSec: 60 });
    expect(notes.join(' ')).toMatch(/within Red Sea. The dive is not added/);
    expect(notes.join(' ')).toMatch(/no number/);
  });

  it('says nothing of a new dive at the end of the log', () => {
    expect(dateNotes({ dives: others, trips: [trip], when: NOW + 200000, durationSec: 60 })).toEqual([]);
  });

  it('says an edited dive keeps its trip, once its date moved', () => {
    const self = { id: 2, when: NOW, tripId: 9, tripLocation: 'Red Sea' };
    expect(dateNotes({ dives: others, trips: [trip], when: NOW, durationSec: 3000, dive: self })).toEqual([]);
    expect(
      dateNotes({ dives: others, trips: [trip], when: NOW - 500000, durationSec: 3000, dive: self }),
    ).toEqual(['The dive stays in Red Sea and keeps its number.']);
  });
});
