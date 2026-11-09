// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import type { BleDevice, DownloadStatus } from '../../modules/ssrf-core/src/SsrfCore.types';
import {
  acceptSummary,
  autoSelection,
  connectionChoices,
  connectionLabel,
  describeOutcome,
  downloadedDiveRows,
  matchingDevice,
  MAX_REMEMBERED_COMPUTERS,
  parseRememberedComputers,
  rememberComputer,
  type RememberedComputer,
} from './dive-computer';
import { IMPERIAL_UNITS, METRIC_UNITS } from './units';

function computer(address: string, product = 'Perdix'): RememberedComputer {
  return { vendor: 'Shearwater', product, address, name: `${product} ${address}` };
}

function device(address: string, identity: string | null, rssi = -50): BleDevice {
  return {
    address,
    name: identity ?? 'Headphones',
    rssi,
    vendor: identity === null ? null : 'Shearwater',
    product: identity,
  };
}

function status(partial: Partial<DownloadStatus>): DownloadStatus {
  return {
    state: 'finished',
    text: '',
    fraction: 0,
    error: '',
    errors: [],
    vendor: 'Shearwater',
    product: 'Perdix',
    address: 'a',
    serial: 0,
    firmware: 0,
    diveCount: 0,
    dives: [],
    logPath: '',
    ...partial,
  };
}

const DIVE = { index: 0, when: 1767348000, durationSec: 1800, maxDepthMm: 25000 };

describe('remembered computers', () => {
  it('puts the latest first', () => {
    const list = rememberComputer([computer('a')], computer('b'));
    expect(list.map((c) => c.address)).toEqual(['b', 'a']);
  });

  it('moves one that is already known instead of listing it twice', () => {
    const list = rememberComputer([computer('a'), computer('b')], computer('b'));
    expect(list.map((c) => c.address)).toEqual(['b', 'a']);
  });

  it('forgets the oldest past the limit', () => {
    let list: RememberedComputer[] = [];
    for (const address of ['a', 'b', 'c', 'd', 'e']) {
      list = rememberComputer(list, computer(address));
    }
    expect(list).toHaveLength(MAX_REMEMBERED_COMPUTERS);
    expect(list.map((c) => c.address)).not.toContain('a');
  });

  it('treats another product at one address as another computer', () => {
    const list = rememberComputer([computer('a', 'Perdix')], computer('a', 'Teric'));
    expect(list).toHaveLength(2);
  });

  it('reads what it can out of a hand-edited file', () => {
    expect(parseRememberedComputers('nonsense')).toEqual([]);
    expect(parseRememberedComputers(null)).toEqual([]);
    expect(
      parseRememberedComputers([
        computer('a'),
        { vendor: 'Shearwater' },
        null,
        { vendor: 'S', product: 'P', address: 'b' },
      ]),
    ).toEqual([computer('a'), { vendor: 'S', product: 'P', address: 'b', name: '' }]);
  });
});

describe('connections', () => {
  it('hides what is not a dive computer unless asked', () => {
    const devices = [device('h', null), device('d', 'Perdix')];
    expect(connectionChoices(devices, false).map((d) => d.address)).toEqual(['d']);
    expect(connectionChoices(devices, true).map((d) => d.address)).toEqual(['d', 'h']);
  });

  it('puts the closest first, and known ones without a signal last', () => {
    const devices = [
      device('far', 'Perdix', -90),
      device('bonded', 'Perdix', 0),
      device('near', 'Perdix', -40),
    ];
    expect(connectionChoices(devices, false).map((d) => d.address)).toEqual([
      'near',
      'far',
      'bonded',
    ]);
  });

  it('labels a device without a name by its address', () => {
    expect(connectionLabel({ name: '', address: 'AA:BB' })).toBe('AA:BB');
    expect(connectionLabel({ name: 'Perdix', address: 'AA:BB' })).toBe('Perdix');
  });

  it('finds the device for a picked product', () => {
    const devices = [device('t', 'Teric'), device('p', 'Perdix')];
    expect(matchingDevice(devices, { vendor: 'Shearwater', product: 'Perdix' })?.address).toBe('p');
    expect(matchingDevice(devices, { vendor: 'Shearwater', product: 'Tern' })).toBeUndefined();
  });
});

describe('filling in the form from a scan', () => {
  it('takes the one dive computer around, ignoring everything else', () => {
    const found = autoSelection([device('h', null), device('p', 'Perdix')], true);
    expect(found).toMatchObject({ vendor: 'Shearwater', product: 'Perdix' });
    expect(found?.device.address).toBe('p');
  });

  it('does not guess between two', () => {
    expect(autoSelection([device('a', 'Perdix'), device('b', 'Teric')], true)).toBeNull();
  });

  it('never overrides what the user picked', () => {
    expect(autoSelection([device('p', 'Perdix')], false)).toBeNull();
  });
});

describe('the review list', () => {
  it('sorts newest first and keeps the index it selects by', () => {
    const rows = downloadedDiveRows([
      { ...DIVE, index: 0, when: DIVE.when - 86400 },
      { ...DIVE, index: 1 },
    ], METRIC_UNITS);
    expect(rows.map((r) => r.index)).toEqual([1, 0]);
  });

  it('reads in the unit system, and in the time the dive computer showed', () => {
    const [metric] = downloadedDiveRows([DIVE], METRIC_UNITS, 'en-GB');
    expect(metric.dateText).toContain('2 Jan 2026');
    expect(metric.dateText).toContain('10:00');
    expect(metric.detailText).toBe('25 m / 30:00');
    const [imperial] = downloadedDiveRows([DIVE], IMPERIAL_UNITS);
    expect(imperial.detailText).toContain('ft');
  });

  it('leaves out what is missing', () => {
    const [row] = downloadedDiveRows([{ ...DIVE, maxDepthMm: 0 }], METRIC_UNITS);
    expect(row.detailText).toBe('30:00');
  });
});

describe('the outcome of a download', () => {
  it('nothing new is not a failure', () => {
    expect(describeOutcome(status({})).kind).toBe('nothing-new');
  });

  it('dives go to review', () => {
    const outcome = describeOutcome(status({ dives: [DIVE] }));
    expect(outcome).toMatchObject({ kind: 'review', title: '1 dive downloaded', detail: '' });
  });

  it('says why it failed, with the details', () => {
    const outcome = describeOutcome(
      status({ state: 'failed', error: 'Unable to open', errors: ['no route'] }),
    );
    expect(outcome.kind).toBe('failed');
    expect(outcome.detail).toBe('Unable to open\nno route');
  });

  it('warns what keeping part of an interrupted download means', () => {
    for (const state of ['failed', 'cancelled'] as const) {
      const outcome = describeOutcome(status({ state, dives: [DIVE] }));
      expect(outcome.kind).toBe('review');
      expect(outcome.detail).toMatch(/Force downloading all dives/);
    }
  });

  it('a cancel without dives is simply cancelled', () => {
    expect(describeOutcome(status({ state: 'cancelled' })).kind).toBe('cancelled');
  });
});

describe('the summary after accepting', () => {
  const result = { added: 0, merged: 0, failed: 0, dives: 0, sites: 0 };

  it('says what happened', () => {
    expect(acceptSummary({ ...result, added: 2 })).toBe('2 dives added.');
    expect(acceptSummary({ ...result, added: 1, merged: 1 })).toBe(
      '1 dive added, 1 dive merged into dives already in the logbook.',
    );
    expect(acceptSummary(result)).toBe('Nothing changed.');
  });
});
