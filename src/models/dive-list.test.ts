// AI-generated (Claude)
// Tests for the dive-list presentation model.
//
// The pure cases below use hand-built summaries; the last block drives the real
// bindings over the host harness against the logbook the app bundles as its
// sample, so the grouping is checked against data a user actually sees.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import type { DiveSummary } from './index';
import { DiveMode } from './index';
import {
  groupDivesByTrip,
  NO_TRIP_LABEL,
  ratingStars,
  sectionSubtitle,
  sortDivesNewestFirst,
  toDiveRow,
} from './dive-list';
import { SsrfHost } from '../../tests/harness/ssrf-host';
import { REPO_ROOT } from '../../tests/harness/fixtures';

const LOCALE = 'en-GB';

function summary(overrides: Partial<DiveSummary> & { id: number }): DiveSummary {
  return {
    number: 0,
    when: 0,
    durationSec: 0,
    maxDepthMm: 0,
    meanDepthMm: 0,
    waterTempMkelvin: 0,
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
    divemode: DiveMode.OC,
    dcModel: '',
    invalid: false,
    ...overrides,
  };
}

const DAY = 86400;

describe('sortDivesNewestFirst', () => {
  it('orders by timestamp, newest first', () => {
    const dives = [
      summary({ id: 1, when: 100 }),
      summary({ id: 2, when: 300 }),
      summary({ id: 3, when: 200 }),
    ];
    expect(sortDivesNewestFirst(dives).map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it('breaks ties by dive number so the order is stable', () => {
    const dives = [
      summary({ id: 1, when: 100, number: 7 }),
      summary({ id: 2, when: 100, number: 9 }),
    ];
    expect(sortDivesNewestFirst(dives).map((d) => d.id)).toEqual([2, 1]);
  });

  it('does not mutate its input', () => {
    const dives = [summary({ id: 1, when: 100 }), summary({ id: 2, when: 300 })];
    sortDivesNewestFirst(dives);
    expect(dives.map((d) => d.id)).toEqual([1, 2]);
  });
});

describe('groupDivesByTrip', () => {
  it('groups a run of dives sharing a trip location', () => {
    const sections = groupDivesByTrip([
      summary({ id: 1, when: 1 * DAY, tripLocation: 'Red Sea' }),
      summary({ id: 2, when: 2 * DAY, tripLocation: 'Red Sea' }),
      summary({ id: 3, when: 3 * DAY, tripLocation: 'Red Sea' }),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Red Sea');
    expect(sections[0].dives.map((d) => d.id)).toEqual([3, 2, 1]);
    expect(sections[0].newestWhen).toBe(3 * DAY);
    expect(sections[0].oldestWhen).toBe(1 * DAY);
  });

  it('keeps two visits to the same place apart', () => {
    const sections = groupDivesByTrip([
      summary({ id: 1, when: 1 * DAY, tripLocation: 'Elba' }),
      summary({ id: 2, when: 50 * DAY, tripLocation: 'Bonaire' }),
      summary({ id: 3, when: 100 * DAY, tripLocation: 'Elba' }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['Elba', 'Bonaire', 'Elba']);
    expect(sections.map((s) => s.dives.length)).toEqual([1, 1, 1]);
  });

  it('collects trip-less dives under one label and merges adjacent ones', () => {
    const sections = groupDivesByTrip([
      summary({ id: 1, when: 1 * DAY }),
      summary({ id: 2, when: 2 * DAY }),
      summary({ id: 3, when: 3 * DAY, tripLocation: 'Elba' }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['Elba', NO_TRIP_LABEL]);
    expect(sections[1].dives.map((d) => d.id)).toEqual([2, 1]);
  });

  it('treats a whitespace-only trip location as no trip', () => {
    const sections = groupDivesByTrip([summary({ id: 1, tripLocation: '   ' })]);
    expect(sections[0].title).toBe(NO_TRIP_LABEL);
  });

  it('returns nothing for an empty log', () => {
    expect(groupDivesByTrip([])).toEqual([]);
  });
});

describe('toDiveRow', () => {
  // 2011-12-13T06:35:00Z, the first dive of subsurface/dives/test29.xml.
  const dive = summary({
    id: 4,
    number: 12,
    when: 1323758100,
    durationSec: 2535,
    maxDepthMm: 20100,
    rating: 4,
    siteName: 'Tauchsee',
    tripLocation: 'Austria',
  });

  it('renders depth and duration in metric', () => {
    expect(toDiveRow(dive, 'metric', LOCALE).detailText).toBe('20.1 m - 42:15');
  });

  it('renders depth in feet when the setting is imperial', () => {
    expect(toDiveRow(dive, 'imperial', LOCALE).detailText).toBe('66 ft - 42:15');
  });

  it('renders date, time and dive number', () => {
    const row = toDiveRow(dive, 'metric', LOCALE);
    // TZ is pinned to UTC for the test run (see vitest.config.ts).
    expect(row.dateText).toBe('13 Dec 2011');
    expect(row.timeText).toBe('06:35');
    expect(row.numberText).toBe('#12');
    expect(row.title).toBe('Tauchsee');
  });

  it('falls back from site name to trip location to a placeholder', () => {
    expect(toDiveRow(summary({ id: 1, tripLocation: 'Austria' })).title).toBe('Austria');
    expect(toDiveRow(summary({ id: 1 })).title).toBe('Unnamed dive');
  });

  it('omits missing depth and duration instead of printing zeroes', () => {
    expect(toDiveRow(summary({ id: 1, maxDepthMm: 0, durationSec: 0 })).detailText).toBe('');
    expect(toDiveRow(summary({ id: 1, maxDepthMm: 12000, durationSec: 0 })).detailText).toBe(
      '12 m'
    );
  });

  it('leaves the dive number blank when there is none', () => {
    expect(toDiveRow(summary({ id: 1, number: 0 })).numberText).toBe('');
  });

  it('spells the row out for VoiceOver instead of leaving it shorthand', () => {
    expect(toDiveRow(dive, 'metric', LOCALE).accessibilityLabel).toBe(
      'Tauchsee, 13 Dec 2011 at 06:35, dive number 12, maximum depth 20.1 m, ' +
        'duration 42 minutes, rated 4 of 5'
    );
  });

  it('speaks a long dive in hours and minutes, not as a clock time', () => {
    const long = summary({ id: 1, when: 1323758100, durationSec: 3600 + 5 * 60 });
    expect(toDiveRow(long, 'metric', LOCALE).accessibilityLabel).toContain(
      'duration 1 hour 5 minutes'
    );
  });

  it('says a dive is invalid, which the row only marks with a word in the corner', () => {
    const label = toDiveRow(summary({ id: 1, invalid: true }), 'metric', LOCALE).accessibilityLabel;
    expect(label).toContain('marked invalid');
  });

  it('leaves out what the dive does not have', () => {
    const label = toDiveRow(summary({ id: 1, when: 1323758100 }), 'metric', LOCALE)
      .accessibilityLabel;
    expect(label).toBe('Unnamed dive, 13 Dec 2011 at 06:35');
  });
});

describe('sectionSubtitle', () => {
  it('shows a single date for a one-day section', () => {
    const [section] = groupDivesByTrip([
      summary({ id: 1, when: 1323758100, tripLocation: 'Austria' }),
    ]);
    expect(sectionSubtitle(section, LOCALE)).toBe('1 dive - 13 Dec 2011');
  });

  it('shows a range for a multi-day section', () => {
    const sections = groupDivesByTrip([
      summary({ id: 1, when: 1323758100, tripLocation: 'Austria' }),
      summary({ id: 2, when: 1323758100 + 2 * DAY, tripLocation: 'Austria' }),
    ]);
    expect(sectionSubtitle(sections[0], LOCALE)).toBe('2 dives - 13 Dec 2011 to 15 Dec 2011');
  });
});

describe('ratingStars', () => {
  it('clamps to 0..5', () => {
    expect(ratingStars(0)).toBe('');
    expect(ratingStars(3)).toBe('***');
    expect(ratingStars(9)).toBe('*****');
    expect(ratingStars(-1)).toBe('');
  });
});

describe('the bundled sample logbook', () => {
  // The app copies this file into its documents directory on first run, so what
  // the list shows on a fresh install is exactly what this block checks.
  const SAMPLE = join(REPO_ROOT, 'assets/sample/sample-log.ssrf');
  let host: SsrfHost;
  let dives: DiveSummary[];

  beforeAll(async () => {
    host = new SsrfHost();
    await host.loadFromXML(SAMPLE);
    dives = await host.listDives();
  });

  afterAll(async () => {
    await host?.close();
  });

  it('loads the 18 dives the sample contains', () => {
    expect(dives).toHaveLength(18);
  });

  it('groups them into trip sections, newest first', () => {
    const sections = groupDivesByTrip(dives);
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.reduce((n, s) => n + s.dives.length, 0)).toBe(dives.length);

    // Sections and the dives inside them are ordered newest-first, and the
    // sections do not overlap in time.
    for (const section of sections) {
      expect(section.newestWhen).toBeGreaterThanOrEqual(section.oldestWhen);
      const whens = section.dives.map((d) => d.when);
      expect(whens).toEqual([...whens].sort((a, b) => b - a));
    }
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i - 1].oldestWhen).toBeGreaterThanOrEqual(sections[i].newestWhen);
    }
  });

  it('renders every dive as a row with a title and a date', () => {
    for (const dive of dives) {
      const row = toDiveRow(dive, 'metric', LOCALE);
      expect(row.title).not.toBe('');
      expect(row.dateText).toMatch(/\d{4}$/);
      expect(row.timeText).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});
