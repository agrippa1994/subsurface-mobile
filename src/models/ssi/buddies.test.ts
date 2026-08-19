// AI-generated (Claude)
// Unit tests for the SSI buddy list model. Pure TypeScript: no network - the
// `logbook_buddies` array is passed in directly.
import { describe, expect, it } from 'vitest';

import {
  buddyDiveHistory,
  describeSsiBuddy,
  reduceSsiBuddies,
  searchSsiBuddies,
  suggestedSsiBuddies,
  type RawSsiBuddy,
  type RawSsiLogbookDetail,
  type SsiBuddy,
} from './buddies';
import { MAX_RESULTS } from './sites';

function ssiBuddy(overrides: Partial<SsiBuddy> = {}): SsiBuddy {
  return {
    id: 1,
    name: 'Anna Berger',
    nickname: '',
    city: '',
    country: '',
    favorite: false,
    pro: false,
    avatarUrl: '',
    lastDive: '',
    dives: 0,
    ...overrides,
  };
}

describe('buddyDiveHistory', () => {
  it('counts the dives each buddy was on and dates the most recent', () => {
    const details: RawSsiLogbookDetail[] = [
      { odin_user_log_buddy_ids: [1, 2], odin_user_log_date: '2026-03-14' },
      { odin_user_log_buddy_ids: [1], odin_user_log_date: '2026-07-02' },
      { odin_user_log_buddy_ids: [1], odin_user_log_date: '2026-05-01' },
    ];

    const history = buddyDiveHistory(details);
    expect(history.get(1)).toEqual({ lastDive: '2026-07-02', dives: 3 });
    expect(history.get(2)).toEqual({ lastDive: '2026-03-14', dives: 1 });
  });

  it('skips deleted dives and entries with no buddy array', () => {
    const details: RawSsiLogbookDetail[] = [
      { odin_user_log_buddy_ids: [1], odin_user_log_date: '2026-07-02', odin_user_log_deleted: 1 },
      { odin_user_log_date: '2026-07-03' },
      { odin_user_log_buddy_ids: [1], odin_user_log_date: '2026-01-01' },
    ];

    expect(buddyDiveHistory(details).get(1)).toEqual({ lastDive: '2026-01-01', dives: 1 });
  });
});

describe('reduceSsiBuddies', () => {
  it('keeps only the fields the picker needs', () => {
    const raw: RawSsiBuddy[] = [
      {
        id: 2550906,
        firstname: 'Anna',
        lastname: 'Berger',
        nickname: 'Ani',
        city: 'Graz',
        country: 'AUT',
        favorite: 1,
        deleted: 0,
        leader_nr: '123456',
        leader_active: 1,
        image: 'https://example.com/anna.jpg',
        email: 'ignored@example.com',
      } as RawSsiBuddy,
    ];

    const history = buddyDiveHistory([
      { odin_user_log_buddy_ids: [2550906], odin_user_log_date: '2026-07-02' },
    ]);

    expect(reduceSsiBuddies(raw, history)).toEqual([
      {
        id: 2550906,
        name: 'Anna Berger',
        nickname: 'Ani',
        city: 'Graz',
        country: 'AUT',
        favorite: true,
        pro: true,
        avatarUrl: 'https://example.com/anna.jpg',
        lastDive: '2026-07-02',
        dives: 1,
      },
    ]);
  });

  it('is a pro only with an active leader number', () => {
    const raw: RawSsiBuddy[] = [
      { id: 1, firstname: 'Lapsed', leader_nr: '123456', leader_active: 0 },
      { id: 2, firstname: 'Nonpro', leader_nr: 0, leader_active: 1 },
      { id: 3, firstname: 'Instructor', leader_nr: 123456, leader_active: 1 },
    ];

    const pros = reduceSsiBuddies(raw).filter((buddy) => buddy.pro);
    expect(pros.map((buddy) => buddy.id)).toEqual([3]);
  });

  it('takes the avatar only when SSI sent a usable URL', () => {
    const raw: RawSsiBuddy[] = [
      { id: 1, firstname: 'Absolute', image: 'https://example.com/a.jpg' },
      { id: 2, firstname: 'Relative', image: '/uploads/b.jpg' },
      { id: 3, firstname: 'Empty', image: '' },
    ];

    const byId = new Map(reduceSsiBuddies(raw).map((buddy) => [buddy.id, buddy.avatarUrl]));
    expect(byId.get(1)).toBe('https://example.com/a.jpg');
    // Relative to a base this app does not know, so not shown at all.
    expect(byId.get(2)).toBe('');
    expect(byId.get(3)).toBe('');
  });

  it('drops entries with no numeric id', () => {
    const raw: RawSsiBuddy[] = [
      { firstname: 'No', lastname: 'Id' },
      { id: '7', firstname: 'String', lastname: 'Id' },
      { id: 7, firstname: 'Real', lastname: 'Id' },
    ];

    expect(reduceSsiBuddies(raw).map((buddy) => buddy.id)).toEqual([7]);
  });

  it('drops the buddies SSI has marked deleted, whose rows it keeps anyway', () => {
    const raw: RawSsiBuddy[] = [
      { id: 1, firstname: 'Gone', deleted: 1 },
      { id: 2, firstname: 'Here', deleted: 0 },
    ];

    expect(reduceSsiBuddies(raw).map((buddy) => buddy.name)).toEqual(['Here']);
  });

  it('falls back from firstname to forename, and then to the nickname alone', () => {
    const raw: RawSsiBuddy[] = [
      { id: 1, forename: 'Tom', lastname: 'Kaiser' },
      { id: 2, nickname: 'Doc' },
      { id: 3, firstname: '   ', lastname: '  ' },
    ];

    // The third has nothing to show, so it cannot be searched for or offered.
    expect(reduceSsiBuddies(raw).map((buddy) => buddy.name)).toEqual(['Doc', 'Tom Kaiser']);
  });

  it('leads with the most recent dive buddy, ahead of a favourite', () => {
    const raw: RawSsiBuddy[] = [
      { id: 1, firstname: 'Zoe' },
      { id: 2, firstname: 'Alex', favorite: 1 },
      { id: 3, firstname: 'Tom' },
    ];
    const history = buddyDiveHistory([
      { odin_user_log_buddy_ids: [3], odin_user_log_date: '2026-07-02' },
      { odin_user_log_buddy_ids: [1], odin_user_log_date: '2026-01-09' },
    ]);

    // Tom dived yesterday, Zoe in January, Alex is merely starred.
    expect(reduceSsiBuddies(raw, history).map((buddy) => buddy.name)).toEqual([
      'Tom',
      'Zoe',
      'Alex',
    ]);
  });

  it('falls back to favourites then names among buddies with no shared dive', () => {
    const raw: RawSsiBuddy[] = [
      { id: 1, firstname: 'Zoe' },
      { id: 2, firstname: 'Alex' },
      { id: 3, firstname: 'Tom', favorite: 1 },
    ];

    expect(reduceSsiBuddies(raw).map((buddy) => buddy.name)).toEqual(['Tom', 'Alex', 'Zoe']);
  });
});

describe('searchSsiBuddies', () => {
  const buddies = [
    ssiBuddy({ id: 1, name: 'Anna Berger' }),
    ssiBuddy({ id: 2, name: 'Tom Kaiser', nickname: 'Anchor' }),
    ssiBuddy({ id: 3, name: 'Marianna Roth' }),
  ];

  it('needs more than one letter, like the site search', () => {
    expect(searchSsiBuddies(buddies, 'a')).toEqual([]);
    expect(searchSsiBuddies(buddies, '  ')).toEqual([]);
  });

  it('puts prefix matches before substring matches', () => {
    // "Marianna" contains "ann" but does not start with it.
    expect(searchSsiBuddies(buddies, 'ann').map((buddy) => buddy.id)).toEqual([1, 3]);
  });

  it('matches the nickname as well as the name', () => {
    expect(searchSsiBuddies(buddies, 'anch').map((buddy) => buddy.id)).toEqual([2]);
  });

  it('is case-insensitive', () => {
    expect(searchSsiBuddies(buddies, 'KAISER').map((buddy) => buddy.id)).toEqual([2]);
  });

  it('caps the result at MAX_RESULTS', () => {
    const many = Array.from({ length: MAX_RESULTS + 5 }, (_, index) =>
      ssiBuddy({ id: index + 1, name: `Diver ${index}` })
    );
    expect(searchSsiBuddies(many, 'diver')).toHaveLength(MAX_RESULTS);
  });
});

describe('suggestedSsiBuddies', () => {
  it('offers the head of the list, which reduce has put the favourites at', () => {
    const many = Array.from({ length: MAX_RESULTS + 5 }, (_, index) =>
      ssiBuddy({ id: index + 1, name: `Diver ${index}` })
    );
    const suggested = suggestedSsiBuddies(many);
    expect(suggested).toHaveLength(MAX_RESULTS);
    expect(suggested[0].id).toBe(1);
  });
});

describe('describeSsiBuddy', () => {
  it('leads with the dives together when there are any', () => {
    expect(describeSsiBuddy(ssiBuddy({ dives: 12, lastDive: '2026-07-02', city: 'Graz' }))).toBe(
      '12 dives, last 2026-07-02'
    );
    expect(describeSsiBuddy(ssiBuddy({ dives: 1, lastDive: '2026-07-02' }))).toBe(
      '1 dive, last 2026-07-02'
    );
  });

  it('shows the nickname and the place for a buddy never dived with', () => {
    expect(describeSsiBuddy(ssiBuddy({ nickname: 'Ani', city: 'Graz', country: 'AUT' }))).toBe(
      '"Ani" - Graz, AUT'
    );
  });

  it('drops the halves it does not have', () => {
    expect(describeSsiBuddy(ssiBuddy({ country: 'AUT' }))).toBe('AUT');
    expect(describeSsiBuddy(ssiBuddy({ nickname: 'Doc' }))).toBe('"Doc"');
  });

  it('never comes back empty, since it is the line under the name', () => {
    expect(describeSsiBuddy(ssiBuddy())).toBe('No dives together');
  });
});
