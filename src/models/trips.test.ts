// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { DiveSummary, StatsSummary, Trip } from './index';
import { DiveMode } from './index';
import {
  adjacentTripsByDive,
  buildTripPatch,
  emptyPickerText,
  formatDiveIds,
  nearestTrips,
  parseDiveIds,
  searchTrips,
  tripActionsFor,
  tripDateText,
  tripLossWarning,
  tripPickerTitle,
  tripsEmptiedBy,
  tripSubtitle,
  tripSummaryFooter,
  tripSummaryRows,
  tripTitle,
} from './trips';

const DAY = 86400;
const LOCALE = 'en-GB';

function dive(overrides: Partial<DiveSummary> & { id: number }): DiveSummary {
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
    tripId: 0,
    tripLocation: '',
    buddy: '',
    diveguide: '',
    suit: '',
    tags: [],
    cylinderDescriptions: [],
    weightDescriptions: [],
    divemode: DiveMode.OC,
    dcModel: '',
    planned: false,
    invalid: false,
    ...overrides,
  };
}

function trip(overrides: Partial<Trip> & { id: number }): Trip {
  return { location: 'Elba', notes: '', diveCount: 1, when: 0, lastDiveWhen: 0, ...overrides };
}

describe('tripTitle', () => {
  it('names a trip without a location', () => {
    expect(tripTitle('  ')).toBe('Untitled trip');
    expect(tripTitle(' Elba ')).toBe('Elba');
  });
});

describe('tripDateText and tripSubtitle', () => {
  const start = Date.UTC(2024, 2, 12, 9) / 1000;

  it('shows one date for a single day', () => {
    expect(tripDateText(trip({ id: 1, when: start, lastDiveWhen: start + 3600 }), LOCALE)).toBe(
      '12 Mar 2024',
    );
  });

  it('shows a range across days', () => {
    expect(tripDateText(trip({ id: 1, when: start, lastDiveWhen: start + 3 * DAY }), LOCALE)).toBe(
      '12 Mar 2024 to 15 Mar 2024',
    );
  });

  it('counts the dives', () => {
    expect(tripSubtitle(trip({ id: 1, when: start, lastDiveWhen: start, diveCount: 1 }), LOCALE)).toBe(
      '1 dive - 12 Mar 2024',
    );
  });
});

describe('nearestTrips', () => {
  const near = trip({ id: 1, when: 10 * DAY, lastDiveWhen: 12 * DAY });
  const far = trip({ id: 2, when: 100 * DAY, lastDiveWhen: 101 * DAY });
  const before = trip({ id: 3, when: 2 * DAY, lastDiveWhen: 3 * DAY });

  it('orders by the gap to the dive, on either side', () => {
    const order = nearestTrips([far, before, near], [dive({ id: 9, when: 14 * DAY })]);
    expect(order.map((t) => t.id)).toEqual([1, 3, 2]);
  });

  it('counts a dive inside the trip\'s span as no gap at all', () => {
    const order = nearestTrips([before, near], [dive({ id: 9, when: 11 * DAY })]);
    expect(order[0].id).toBe(1);
  });

  it('measures from the span of several dives', () => {
    const dives = [dive({ id: 8, when: 5 * DAY }), dive({ id: 9, when: 90 * DAY })];
    expect(nearestTrips([far, near, before], dives).map((t) => t.id)).toEqual([1, 3, 2]);
  });

  it('leaves out the trip that holds all the dives, and only that', () => {
    const inNear = [dive({ id: 8, tripId: 1 }), dive({ id: 9, tripId: 1 })];
    expect(nearestTrips([near, far], inNear).map((t) => t.id)).toEqual([2]);
    const mixed = [dive({ id: 8, tripId: 1 }), dive({ id: 9, tripId: 2 })];
    expect(nearestTrips([near, far], mixed)).toHaveLength(2);
  });

  it('does not reorder its input', () => {
    const input = [far, near];
    nearestTrips(input, [dive({ id: 9, when: 11 * DAY })]);
    expect(input[0]).toBe(far);
  });
});

describe('searchTrips', () => {
  const trips = [
    trip({ id: 1, location: 'Red Sea', when: Date.UTC(2024, 2, 12) / 1000 }),
    trip({ id: 2, location: 'Elba', when: Date.UTC(2023, 5, 1) / 1000 }),
  ];
  for (const t of trips) {
    t.lastDiveWhen = t.when;
  }

  it('finds by location and date, every word having to match', () => {
    expect(searchTrips(trips, 'red', LOCALE).map((t) => t.id)).toEqual([1]);
    expect(searchTrips(trips, '2023', LOCALE).map((t) => t.id)).toEqual([2]);
    expect(searchTrips(trips, 'red 2023', LOCALE)).toEqual([]);
  });

  it('keeps everything for a blank query', () => {
    expect(searchTrips(trips, '  ', LOCALE)).toHaveLength(2);
  });
});

describe('emptyPickerText', () => {
  it('tells a search that found nothing from a log without trips', () => {
    expect(emptyPickerText(true, true)).toBe('No trip matches.');
    expect(emptyPickerText(false, false)).toContain('No other trips');
    expect(emptyPickerText(false, true)).toContain('No other trips');
  });
});

describe('adjacentTripsByDive', () => {
  const newer = trip({ id: 1, location: 'Newer' });
  const older = trip({ id: 2, location: 'Older' });
  const dives = [
    dive({ id: 1, when: 1 * DAY, tripId: 2 }),
    dive({ id: 2, when: 2 * DAY }),
    dive({ id: 3, when: 3 * DAY }),
    dive({ id: 4, when: 4 * DAY, tripId: 1 }),
  ];

  it('offers the trip of each neighbour, above being newer', () => {
    const adjacent = adjacentTripsByDive(dives, [newer, older]);
    expect(adjacent.get(3)?.above?.id).toBe(1);
    expect(adjacent.get(3)?.below).toBeUndefined();
    expect(adjacent.get(2)?.below?.id).toBe(2);
    expect(adjacent.get(2)?.above).toBeUndefined();
  });

  it('says nothing for a dive in a trip or between loose dives', () => {
    const adjacent = adjacentTripsByDive(dives, [newer, older]);
    expect(adjacent.has(1)).toBe(false);
    expect(adjacent.has(4)).toBe(false);
  });

  it('makes one offer for a dive between two dives of one trip', () => {
    const between = [
      dive({ id: 1, when: 1 * DAY, tripId: 1 }),
      dive({ id: 2, when: 2 * DAY }),
      dive({ id: 3, when: 3 * DAY, tripId: 1 }),
    ];
    const entry = adjacentTripsByDive(between, [newer]).get(2);
    expect(entry?.above?.id).toBe(1);
    expect(entry?.below).toBeUndefined();
  });
});

describe('tripActionsFor', () => {
  it('offers view, move and remove for a dive in a trip', () => {
    const actions = tripActionsFor(dive({ id: 1, tripId: 5 }));
    expect(actions.map((a) => a.kind)).toEqual(['open', 'pick', 'remove']);
    expect(actions[1].label).toBe('Move to Trip');
  });

  it('offers the neighbours first for a dive outside one', () => {
    const actions = tripActionsFor(dive({ id: 1 }), {
      above: trip({ id: 1, location: 'Newer' }),
      below: trip({ id: 2, location: '' }),
    });
    expect(actions.map((a) => a.label)).toEqual([
      'Add to Newer',
      'Add to Untitled trip',
      'Add to Trip',
      'New Trip',
    ]);
  });

  it('offers the picker and a new trip when no neighbour is in a trip', () => {
    expect(tripActionsFor(dive({ id: 1 })).map((a) => a.kind)).toEqual(['pick', 'new']);
  });
});

describe('tripPickerTitle', () => {
  it('says move as soon as one of the dives is in a trip', () => {
    expect(tripPickerTitle([dive({ id: 1 })])).toBe('Add to Trip');
    expect(tripPickerTitle([dive({ id: 1 }), dive({ id: 2, tripId: 3 })])).toBe('Move to Trip');
  });
});

describe('tripsEmptiedBy and tripLossWarning', () => {
  const t1 = trip({ id: 1, diveCount: 2 });
  const t2 = trip({ id: 2, diveCount: 1 });

  it('finds a trip only when all of its dives leave', () => {
    expect(tripsEmptiedBy([dive({ id: 1, tripId: 1 })], [t1, t2])).toEqual([]);
    expect(
      tripsEmptiedBy([dive({ id: 1, tripId: 1 }), dive({ id: 2, tripId: 1 })], [t1, t2]),
    ).toEqual([t1]);
  });

  it('does not count the trip the dives are moving to', () => {
    expect(tripsEmptiedBy([dive({ id: 1, tripId: 2 })], [t1, t2], 2)).toEqual([]);
  });

  it('warns only when a location or notes would be lost', () => {
    expect(tripLossWarning([])).toBeNull();
    expect(tripLossWarning([trip({ id: 1, location: ' ', notes: '' })])).toBeNull();
    expect(tripLossWarning([trip({ id: 1, location: '', notes: 'Nice' })])?.title).toBe(
      'Remove "Untitled trip"?',
    );
    expect(tripLossWarning([t1, t2])?.title).toBe('Remove 2 trips?');
  });
});

describe('tripSummaryRows and tripSummaryFooter', () => {
  const t = trip({
    id: 1,
    diveCount: 3,
    when: Date.UTC(2024, 2, 12) / 1000,
    lastDiveWhen: Date.UTC(2024, 2, 12) / 1000,
  });
  const stats = (total: Partial<StatsSummary['total']>, matched = 3) =>
    ({ matched, total }) as unknown as StatsSummary;

  it('shows dates and count before the statistics are in', () => {
    expect(tripSummaryRows(t, undefined, 'metric', LOCALE)).toEqual([
      { label: 'Dates', value: '12 Mar 2024' },
      { label: 'Dives', value: '3' },
    ]);
  });

  it('adds the core\'s totals, in the unit system', () => {
    const rows = tripSummaryRows(
      t,
      stats({ totalTimeSec: 7500, maxDepthMm: 30000, avgDepthMm: 15000, minTempMkelvin: 293150 }),
      'metric',
      LOCALE,
    );
    expect(rows.slice(2)).toEqual([
      { label: 'Total time', value: '2 h 5 min' },
      { label: 'Deepest', value: '30 m' },
      { label: 'Average depth', value: '15 m' },
      { label: 'Coldest water', value: '20 C' },
    ]);
  });

  it('leaves out what the dives do not carry', () => {
    const rows = tripSummaryRows(t, stats({ totalTimeSec: 0, maxDepthMm: 0, avgDepthMm: 0, minTempMkelvin: 0 }));
    expect(rows).toHaveLength(2);
  });

  it('says when the totals skip invalid dives', () => {
    expect(tripSummaryFooter(t, stats({}, 3))).toBeUndefined();
    expect(tripSummaryFooter(t, stats({}, 2))).toBe('Totals leave out 1 dive marked invalid.');
  });
});

describe('buildTripPatch', () => {
  const t = trip({ id: 1, location: 'Elba', notes: 'Windy' });

  it('holds only what changed, trimmed', () => {
    expect(buildTripPatch(t, { location: 'Elba', notes: 'Windy' })).toEqual({});
    expect(buildTripPatch(t, { location: ' Elba ', notes: 'Windy' })).toEqual({});
    expect(buildTripPatch(t, { location: ' Giglio ', notes: 'Windy' })).toEqual({ location: 'Giglio' });
    expect(buildTripPatch(t, { location: 'Elba', notes: '' })).toEqual({ notes: '' });
  });
});

describe('dive id parameter', () => {
  it('round-trips and drops anything that is not an id', () => {
    expect(parseDiveIds(formatDiveIds([3, 7]))).toEqual([3, 7]);
    expect(parseDiveIds('3,,x,-1,7')).toEqual([3, 7]);
    expect(parseDiveIds(undefined)).toEqual([]);
    expect(parseDiveIds(['3', '7'])).toEqual([3, 7]);
  });
});
