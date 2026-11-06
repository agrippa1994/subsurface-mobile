// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { mergeActionsFor, mergeConfirmation, mergeNeighbours } from './dive-merge';
import type { Dive, DiveSummary, MergePreview, Trip } from './index';

function summary(id: number, overrides: Partial<DiveSummary> = {}): DiveSummary {
  return {
    id,
    number: id,
    when: Date.UTC(2024, 2, 12, 9, 14) / 1000 + id * 3600,
    durationSec: 1800,
    maxDepthMm: 20000,
    meanDepthMm: 12000,
    waterTempMkelvin: 0,
    rating: 0,
    visibility: 0,
    siteUuid: 1,
    siteName: 'Shark Reef',
    tripId: 0,
    tripLocation: '',
    buddy: '',
    diveguide: '',
    suit: '',
    tags: [],
    divemode: 0,
    dcModel: '',
    invalid: false,
    ...overrides,
  } as DiveSummary;
}

function preview(dive: Partial<Dive>, rest: Partial<MergePreview> = {}): MergePreview {
  return {
    dive: {
      maxDepthMm: 30000,
      durationSec: 3900,
      dcs: [{}],
      siteUuid: 1,
      siteName: 'Shark Reef',
      tripId: 0,
      tripLocation: '',
      ...dive,
    } as Dive,
    surfaceIntervalSec: 0,
    renumberedDives: 0,
    ...rest,
  };
}

function trip(id: number, location: string, diveCount: number): Trip {
  return { id, location, diveCount, notes: '' } as Trip;
}

describe('mergeActionsFor', () => {
  const dives = new Map([
    [1, summary(1, { siteName: 'North Wall' })],
    [2, summary(2)],
    [3, summary(3, { siteName: '' })],
  ]);
  const neighbours = mergeNeighbours([
    { earlierId: 1, laterId: 2, surfaceIntervalSec: 300 },
    { earlierId: 2, laterId: 3, surfaceIntervalSec: 0 },
  ]);

  it('offers nothing for a dive in no pair', () => {
    expect(mergeActionsFor(9, neighbours, dives)).toEqual([]);
  });

  it('offers the later dive first, the row above in a newest-first list', () => {
    const actions = mergeActionsFor(2, neighbours, dives);
    expect(actions.map((action) => [action.kind, action.otherId])).toEqual([
      ['next', 3],
      ['previous', 1],
    ]);
  });

  it('says how the other dive relates to this one', () => {
    const [previous] = mergeActionsFor(3, neighbours, dives);
    expect(previous.detail).toBe('Shark Reef. Overlaps this dive');
    expect(mergeActionsFor(1, neighbours, dives)[0].detail).toBe(
      'Shark Reef. Starts 5 min after this dive ends',
    );
    expect(mergeActionsFor(2, neighbours, dives)[1].detail).toBe(
      'North Wall. Ended 5 min before this dive',
    );
  });
});

describe('mergeConfirmation', () => {
  it('names both dives, oldest first, and says what they become', () => {
    const { title, message, confirmLabel } = mergeConfirmation(
      [summary(13), summary(12)],
      preview({}),
      [],
      'metric',
      'en-GB',
    );
    expect(title).toBe('Merge these dives?');
    expect(confirmLabel).toBe('Merge');
    const lines = message.split('\n');
    expect(lines[0]).toBe('Dive 12: Shark Reef, 12 Mar 2024, 21:14');
    expect(lines[1]).toBe('Dive 13: Shark Reef, 12 Mar 2024, 22:14');
    expect(message).toContain('They become one dive, 30 m deep, 1:05:00 long.');
    expect(message).not.toContain('cannot be undone');
  });

  it('leaves the number out for an unnumbered dive', () => {
    const { message } = mergeConfirmation(
      [summary(1, { number: 0 }), summary(2, { number: 0 })],
      preview({}),
      [],
      'metric',
      'en-GB',
    );
    expect(message.startsWith('Shark Reef, ')).toBe(true);
  });

  it('mentions the surface interval only when one profile holds it', () => {
    const dives = [summary(1), summary(2)];
    expect(
      mergeConfirmation(dives, preview({}, { surfaceIntervalSec: 280 }), []).message,
    ).toContain('Its profile keeps the 5 min on the surface between them.');
    const two = mergeConfirmation(
      dives,
      preview({ dcs: [{}, {}] } as Partial<Dive>, { surfaceIntervalSec: 280 }),
      [],
    ).message;
    expect(two).toContain('keeping the recordings of 2 dive computers');
    expect(two).not.toContain('on the surface');
  });

  it('says which site is kept when the dives have two', () => {
    const dives = [summary(1), summary(2, { siteUuid: 2, siteName: 'South Wall' })];
    const { message } = mergeConfirmation(dives, preview({}), []);
    expect(message).toContain('It stays at Shark Reef. South Wall stays in your sites without it.');
    expect(mergeConfirmation([summary(1), summary(2)], preview({}), []).message).not.toContain(
      'stays in your sites',
    );
  });

  it('says where the dive goes and which trip ends', () => {
    const dives = [
      summary(1, { tripId: 7, tripLocation: 'Red Sea' }),
      summary(2, { tripId: 8, tripLocation: 'Dahab' }),
    ];
    const { message } = mergeConfirmation(
      dives,
      preview({ tripId: 7, tripLocation: 'Red Sea' }),
      [trip(7, 'Red Sea', 4), trip(8, 'Dahab', 1)],
    );
    expect(message).toContain('It goes in the trip Red Sea.');
    expect(message).toContain('The trip Dahab ends, with its location and notes.');
  });

  it('says nothing about trips when both dives stay in the one they are in', () => {
    const dives = [
      summary(1, { tripId: 7, tripLocation: 'Red Sea' }),
      summary(2, { tripId: 7, tripLocation: 'Red Sea' }),
    ];
    const { message } = mergeConfirmation(
      dives,
      preview({ tripId: 7, tripLocation: 'Red Sea' }),
      [trip(7, 'Red Sea', 2)],
    );
    expect(message).not.toContain('trip');
  });

  it('counts the dives that get a new number', () => {
    const dives = [summary(1), summary(2)];
    expect(
      mergeConfirmation(dives, preview({}, { renumberedDives: 1 }), []).message,
    ).toContain('1 later dive gets a new number.');
    expect(
      mergeConfirmation(dives, preview({}, { renumberedDives: 3 }), []).message,
    ).toContain('3 later dives get a new number.');
    expect(mergeConfirmation(dives, preview({}), []).message).not.toContain('new number');
  });
});
