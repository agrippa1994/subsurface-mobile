// AI-generated (Claude)
// Downloading dives, through everything but the radio.
//
// The host binary is linked with a simulated Deep Six Excursion behind the GATT
// driver seam (modules/ssrf-core/tests/fake-dive-computer.cpp). It speaks the
// real protocol, so these downloads run ble-stream.cpp, libdivecomputer's device
// and parser backends and upstream's dive_cb and fingerprint logic for real. What
// this cannot cover is the platform driver and any real dive computer.
//
// Build with build-host.sh --tsan and set SSRF_HOST_BINARY to race-check the lot:
// this is the only multi-threaded code in the module.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  BleScanStatus,
  DiveComputerVendor,
  DownloadOptions,
  DownloadStatus,
  ImportResult,
} from '../src/models';
import { fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const EXCURSION: DownloadOptions = {
  vendor: 'Deep Six',
  product: 'Excursion',
  address: 'sim-excursion',
  btName: 'EXCURSION',
};

const THREE_DIVES = [
  { day: 1, depthM: 18, minutes: 40 },
  { day: 2, depthM: 25, minutes: 30 },
  { day: 3, depthM: 12, minutes: 50 },
];

const hosts: SsrfHost[] = [];

async function open(dives: unknown[] = THREE_DIVES): Promise<SsrfHost> {
  const host = new SsrfHost();
  hosts.push(host);
  await host.call('configure', { dataDir: tempDir('ssrf-dc-') });
  await host.call('sim.configure', { dives });
  return host;
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
});

async function waitForEnd(host: SsrfHost): Promise<DownloadStatus> {
  for (let i = 0; i < 2000; i++) {
    const status = await host.call<DownloadStatus>('dcDownloadStatus');
    if (status.state !== 'running') {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('the download never ended');
}

async function download(
  host: SsrfHost,
  options: Partial<DownloadOptions> = {},
): Promise<DownloadStatus> {
  await host.call('dcDownloadStart', { ...EXCURSION, ...options });
  return waitForEnd(host);
}

type SimStatus = {
  connected: boolean;
  connections: number;
  subscribed: boolean;
  writes: number;
  headersServed: number;
  timeSets: number;
  protocolErrors: string[];
};

describe('the dive computer list', () => {
  it('offers what has BLE, and not the FIT pseudo-device', async () => {
    const host = await open();
    const vendors = await host.call<DiveComputerVendor[]>('dcListComputers');
    const names = vendors.map((v) => v.vendor);
    expect(names).toEqual([...names].sort());
    expect(names).toContain('Shearwater');
    expect(names).not.toContain('FIT');
    const shearwater = vendors.find((v) => v.vendor === 'Shearwater');
    expect(shearwater?.products).toContain('Perdix 2');
    // Serial only.
    expect(shearwater?.products).not.toContain('Predator');
  });
});

describe('telling a dive computer by its Bluetooth name', () => {
  it.each([
    ['Perdix 2 1234', 'Shearwater', 'Perdix 2'],
    ['Petrel', 'Shearwater', 'Petrel 2'],
    ['EON Steel', 'Suunto', 'EON Steel'],
    ['OSTC4-12345', 'Heinrichs Weikamp', 'OSTC 4'],
    ['FQ123456', 'Aqualung', 'i770R'],
    ['2_abcd', 'Cressi', 'Goa'],
    // Not in upstream's table, found through libdivecomputer's own filters.
    ['EXCURSION', 'Deep Six', 'Excursion'],
  ])('%s is a %s %s', async (name, vendor, product) => {
    const host = await open();
    expect(await host.call('dcDetect', { name })).toEqual({ vendor, product });
  });

  it.each(['Headphones', 'ZZ123456', '77_abcd'])('%s is not a dive computer', async (name) => {
    const host = await open();
    expect(await host.call('dcDetect', { name })).toBeNull();
  });
});

describe('choosing the serial service', () => {
  const WRITE = 2;
  const NOTIFY = 8;
  const serial = [
    { uuid: 'aa', props: WRITE },
    { uuid: 'ab', props: NOTIFY },
  ];

  async function pick(uuids: string[]): Promise<string | null> {
    const host = await open();
    return host.call('sim.selectService', {
      services: uuids.map((uuid) => ({ uuid, characteristics: serial })),
    });
  }

  it('prefers a known service by the order of the table', async () => {
    // A Cressi also exposes a Nordic UART, and only the first one is right.
    const nordic = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    const cressi = '6e400001-b5a3-f393-e0a9-e50e24dc10b8';
    expect(await pick([nordic, cressi])).toBe(cressi);
  });

  it('matches a short uuid and ignores case', async () => {
    expect(await pick(['aaaaaaaa-0000-4000-8000-000000000000', 'FEFB'])).toBe(
      '0000fefb-0000-1000-8000-00805f9b34fb',
    );
  });

  it('skips standard services and firmware update services', async () => {
    const vendor = 'aaaaaaaa-0000-4000-8000-000000000000';
    expect(await pick(['180A', '00001530-1212-EFDE-1523-785FEABCD123', vendor])).toBe(vendor);
  });

  it('finds nothing where there is no serial port', async () => {
    expect(await pick(['180A', '180F'])).toBeNull();
  });
});

describe('scanning', () => {
  it('reports the devices with what they turned out to be', async () => {
    const host = await open();
    await host.call('bleScanStart', { knownAddresses: ['sim-bonded'] });
    let scan = await host.call<BleScanStatus>('bleScanStatus');
    for (let i = 0; i < 100 && scan.devices.length < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      scan = await host.call<BleScanStatus>('bleScanStatus');
    }
    await host.call('bleScanStop');
    expect(scan.adapter).toBe('on');
    expect(scan.devices.find((d) => d.address === 'sim-excursion')).toMatchObject({
      name: 'EXCURSION',
      vendor: 'Deep Six',
      product: 'Excursion',
    });
    expect(scan.devices.find((d) => d.address === 'sim-headphones')?.vendor).toBeNull();
    // Stopped advertising once bonded, and still on offer.
    expect(scan.devices.find((d) => d.address === 'sim-bonded')).toBeDefined();
  });
});

describe('a download', () => {
  it('produces reviewable dives and leaves the logbook alone', async () => {
    const host = await open();
    const status = await download(host);
    expect(status.state).toBe('finished');
    expect(status.error).toBe('');
    expect(status.diveCount).toBe(3);
    expect(status.serial).toBe(12345);
    expect(status.fraction).toBe(1);
    expect(status.dives.map((d) => Math.round(d.maxDepthMm / 1000)).sort()).toEqual([12, 18, 25]);
    expect(await host.listDives()).toEqual([]);

    const sim = await host.call<SimStatus>('sim.status');
    expect(sim.protocolErrors).toEqual([]);
    expect(sim.subscribed).toBe(true);
    expect(sim.connected).toBe(false);
  });

  it('merges only the selected dives', async () => {
    const host = await open();
    const status = await download(host);
    const deepest = status.dives.reduce((a, b) => (a.maxDepthMm > b.maxDepthMm ? a : b));
    const merged = await host.call<ImportResult>('dcDownloadAccept', { indices: [deepest.index] });
    expect(merged).toMatchObject({ added: 1, dives: 1 });

    const [dive] = await host.listDives();
    expect(Math.round(dive.maxDepthMm / 1000)).toBe(25);
    const full = await host.getDive(dive.id);
    expect(full.dcs[0].model).toBe('Deep Six Excursion');
    expect(full.dcs[0].sampleCount).toBeGreaterThan(100);

    expect((await host.call<DownloadStatus>('dcDownloadStatus')).state).toBe('idle');
  });

  it('refuses a selection that is not in the session', async () => {
    const host = await open();
    await download(host);
    await expect(host.call('dcDownloadAccept', { indices: [99] })).rejects.toThrow(/index 99/);
    // Nothing was lost by asking.
    await expect(host.call('dcDownloadAccept', { indices: [0, 1, 2] })).resolves.toMatchObject({
      added: 3,
    });
  });

  it('discarding leaves nothing behind', async () => {
    const host = await open();
    await download(host);
    await host.call('dcDownloadDiscard');
    expect(await host.listDives()).toEqual([]);
    expect((await host.call<DownloadStatus>('dcDownloadStatus')).diveCount).toBe(0);
  });

  it('refuses to start a second one', async () => {
    const host = await open();
    await host.call('sim.configure', { responseDelayMs: 20 });
    await host.call('dcDownloadStart', EXCURSION);
    await expect(host.call('dcDownloadStart', EXCURSION)).rejects.toThrow(/already running/);
    await host.call('dcDownloadCancel');
    await waitForEnd(host);
  });

  it('refuses a product it cannot reach', async () => {
    const host = await open();
    await expect(
      host.call('dcDownloadStart', { ...EXCURSION, vendor: 'Shearwater', product: 'Predator' }),
    ).rejects.toThrow(/Bluetooth LE/);
    await expect(
      host.call('dcDownloadStart', { ...EXCURSION, product: 'No Such Thing' }),
    ).rejects.toThrow(/unknown dive computer/);
  });

  it('sets the clock only when asked', async () => {
    const host = await open();
    await download(host);
    expect((await host.call<SimStatus>('sim.status')).timeSets).toBe(0);
    await host.call('dcDownloadDiscard');
    await download(host, { syncTime: true });
    // The date and the time.
    expect((await host.call<SimStatus>('sim.status')).timeSets).toBe(2);
  });

  it('writes a log to send along with a bug report', async () => {
    const host = await open();
    const status = await download(host);
    const log = readFileSync(status.logPath, 'utf8');
    expect(log).toContain('built with libdivecomputer');
    expect(log).toContain('using service aaaaaaaa-bbbb-4ccc-8ddd-000000000001');
  });
});

describe('undoing a download', () => {
  it('takes the dives out again, and the next download brings them back', async () => {
    const host = await open();
    const first = await download(host);
    await host.call('dcDownloadAccept', { indices: first.dives.map((d) => d.index) });
    const state = await host.historyState();
    expect(state.undo).toMatchObject({ kind: 'dcDownloadAccept', divesBefore: 0, divesAfter: 3 });

    await host.undo();
    expect(await host.listDives()).toEqual([]);
    await host.redo();
    expect(await host.listDives()).toHaveLength(3);
    await host.undo();

    // The stored fingerprint names a dive the log no longer has, so the download
    // must not stop at it as it would at a dive already in the log.
    const second = await download(host);
    expect(second.state).toBe('finished');
    expect(second.dives).toHaveLength(3);
  });
});

describe('incremental downloads', () => {
  it('only fetches what is new, in the same session', async () => {
    const host = await open();
    const first = await download(host);
    await host.call('dcDownloadAccept', { indices: first.dives.map((d) => d.index) });

    await host.call('sim.configure', {
      dives: [...THREE_DIVES, { day: 4, depthM: 30, minutes: 25 }],
    });
    const before = (await host.call<SimStatus>('sim.status')).headersServed;
    const second = await download(host);
    expect(second.state).toBe('finished');
    expect(second.dives.map((d) => Math.round(d.maxDepthMm / 1000))).toEqual([30]);
    // The new dive and the one that matched the fingerprint, and no further.
    expect((await host.call<SimStatus>('sim.status')).headersServed - before).toBe(2);

    await host.call('dcDownloadAccept', { indices: [0] });
    expect(await host.listDives()).toHaveLength(4);
  });

  it('finds nothing when nothing is new', async () => {
    const host = await open();
    const first = await download(host);
    await host.call('dcDownloadAccept', { indices: first.dives.map((d) => d.index) });
    const second = await download(host);
    expect(second.state).toBe('finished');
    expect(second.dives).toEqual([]);
  });

  it('gets everything when forced, and merges rather than duplicates', async () => {
    const host = await open();
    const first = await download(host);
    await host.call('dcDownloadAccept', { indices: first.dives.map((d) => d.index) });
    const forced = await download(host, { force: true });
    expect(forced.diveCount).toBe(3);
    const merged = await host.call<ImportResult>('dcDownloadAccept', { indices: [0, 1, 2] });
    expect(merged).toMatchObject({ added: 0, dives: 3 });
  });

  it('offers declined dives again', async () => {
    const host = await open();
    await download(host);
    await host.call('dcDownloadDiscard');
    const again = await download(host);
    expect(again.diveCount).toBe(3);
  });

  it('survives the logbook being saved and reopened', async () => {
    const dir = tempDir('ssrf-dc-');
    const path = join(dir, 'logbook.ssrf');
    const host = await open();
    const first = await download(host);
    await host.call('dcDownloadAccept', { indices: first.dives.map((d) => d.index) });
    await host.saveToXML(path);
    expect(readFileSync(path, 'utf8')).toContain('<fingerprint');
    // The dive computer and the fingerprint are in the logbook file.
    expect(readFileSync(path, 'utf8')).toContain("model='Deep Six Excursion'");
    await host.close();

    const reopened = await open();
    await reopened.loadFromXML(path);
    const second = await download(reopened);
    expect(second.diveCount).toBe(0);
    expect(await reopened.listDives()).toHaveLength(3);
  });

  it('merges into an existing logbook', async () => {
    const host = await open();
    const log = await host.loadFromXML(fixture('abitofeverything.ssrf'));
    const status = await download(host);
    const merged = await host.call<ImportResult>('dcDownloadAccept', {
      indices: status.dives.map((d) => d.index),
    });
    expect(merged.dives).toBe(log.dives + 3);
  });
});

describe('when it goes wrong', () => {
  it('reports a failed connection, and a retry works', async () => {
    const host = await open();
    await host.call('sim.configure', { failConnect: true });
    const failed = await download(host);
    expect(failed.state).toBe('failed');
    expect(failed.error).toMatch(/Unable to open Deep Six Excursion/);
    expect(failed.errors.join()).toMatch(/simulated connection failure/);

    await host.call('sim.configure', {});
    const retried = await download(host);
    expect(retried.state).toBe('finished');
    expect(retried.diveCount).toBe(3);
  });

  it('keeps what came through before the link dropped', async () => {
    const host = await open();
    // Past the five info commands and the 1 + 8 packets of the newest dive.
    await host.call('sim.configure', { dropAfterWrites: 16 });
    const status = await download(host);
    expect(status.state).toBe('failed');
    expect(status.error).toBe('Dive data import error');
    expect(status.diveCount).toBeGreaterThan(0);
    expect(status.diveCount).toBeLessThan(3);
    expect(status.dives).toHaveLength(status.diveCount);
    expect((await host.call<SimStatus>('sim.status')).connected).toBe(false);
  });

  it('gives up on a device that stops answering', async () => {
    const host = await open();
    await host.call('sim.configure', { silentAfterWrites: 3 });
    const status = await download(host);
    expect(status.state).toBe('failed');
    expect((await host.call<SimStatus>('sim.status')).connected).toBe(false);
  });

  it('cancels promptly', async () => {
    const host = await open();
    await host.call('sim.configure', { silentAfterWrites: 3 });
    await host.call('dcDownloadStart', EXCURSION);
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.call('dcDownloadCancel');
    const status = await waitForEnd(host);
    expect(status.state).toBe('cancelled');
    // Far under the device's 3 second timeout: Cancel does not wait for it.
    expect(Date.now() - start).toBeLessThan(1500);
    expect((await host.call<SimStatus>('sim.status')).connected).toBe(false);
  });

  it('can start over after a cancel', async () => {
    const host = await open();
    await host.call('sim.configure', { responseDelayMs: 5 });
    await host.call('dcDownloadStart', EXCURSION);
    await host.call('dcDownloadCancel');
    await waitForEnd(host);
    await host.call('sim.configure', {});
    expect((await download(host)).state).toBe('finished');
  });

  it('keeps the logbook usable while a download runs', async () => {
    const host = await open();
    await host.loadFromXML(fixture('abitofeverything.ssrf'));
    await host.call('sim.configure', { responseDelayMs: 2 });
    await host.call('dcDownloadStart', EXCURSION);
    for (let i = 0; i < 20; i++) {
      const dives = await host.listDives();
      await host.getDive(dives[0].id);
    }
    const status = await waitForEnd(host);
    expect(status.state).toBe('finished');
  });
});

// The same dive recorded by a second dive computer is one dive with two computers.
describe('a logbook that already has the dive', () => {
  it('merges the download into it', async () => {
    const dir = tempDir('ssrf-dc-');
    const path = join(dir, 'other.ssrf');
    writeFileSync(
      path,
      `<divelog program='subsurface' version='3'><dives>
<dive number='7' date='2026-01-02' time='10:00:00' duration='30:00 min'>
  <notes>from the other computer</notes>
  <divecomputer model='Other Computer'><depth max='25.0 m' /></divecomputer>
</dive></dives></divelog>`,
    );
    const host = await open();
    await host.loadFromXML(path);
    const status = await download(host);
    const merged = await host.call<ImportResult>('dcDownloadAccept', {
      indices: status.dives.map((d) => d.index),
    });
    expect(merged.dives).toBe(3);
    const dives = await host.listDives();
    const full = await host.getDive(dives.find((d) => d.number === 7)!.id);
    expect(full.notes).toBe('from the other computer');
    expect(full.dcs.some((dc) => dc.model === 'Deep Six Excursion')).toBe(true);
  });
});
