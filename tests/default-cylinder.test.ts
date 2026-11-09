// AI-generated (Claude)
// The default cylinder: the core's `default_cylinder` preference, set through
// `configure`, and what reads it - a new cylinder (create_new_cylinder), and a
// downloaded dive whose computer reports no tank size (fill_default_cylinder in
// core/libdivecomputer.cpp). The app adds nothing of its own: the size, the
// working pressure and an imperial type's conversion are the core's.

import { afterEach, describe, expect, it } from 'vitest';

import type { DownloadStatus, ImportResult, PlanTank } from '../src/models';
import { tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const hosts: SsrfHost[] = [];

function open(): SsrfHost {
  const host = new SsrfHost();
  hosts.push(host);
  return host;
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
});

async function tank(host: SsrfHost, match: (tank: PlanTank) => boolean): Promise<PlanTank> {
  const { tanks } = await host.plannerOptions();
  const found = tanks.find(match);
  if (!found) {
    throw new Error('no such tank in the core table');
  }
  return found;
}

describe('defaultCylinder', () => {
  it('is none until one is set, as in the core', async () => {
    const host = open();
    expect(await host.defaultCylinder()).toBeNull();
  });

  it('starts a new cylinder from the type, filled to its working pressure', async () => {
    const host = open();
    const al80 = await tank(host, (t) => t.name === 'AL80');
    await host.configurePreferences({ defaultCylinder: 'AL80' });
    const cylinder = await host.defaultCylinder();
    expect(cylinder).toMatchObject({
      description: 'AL80',
      sizeMl: al80.sizeMl,
      workingPressureMbar: al80.workingPressureMbar,
      startMbar: al80.workingPressureMbar,
      endMbar: 0,
    });
    // Air: the core's sentinel.
    expect(cylinder?.gasmix.o2Permille).toBe(0);
  });

  it('takes a metric type too', async () => {
    const host = open();
    const metric = await tank(host, (t) => /bar/.test(t.name));
    await host.configurePreferences({ defaultCylinder: metric.name });
    expect(await host.defaultCylinder()).toMatchObject({
      description: metric.name,
      sizeMl: metric.sizeMl,
      workingPressureMbar: metric.workingPressureMbar,
    });
  });

  it('goes back to none, and refuses a type the core does not know', async () => {
    const host = open();
    await host.configurePreferences({ defaultCylinder: 'AL80' });
    await expect(host.configurePreferences({ defaultCylinder: 'Bathtub' })).rejects.toThrow(/unknown cylinder type/);
    // A refused name leaves the one before in place.
    expect((await host.defaultCylinder())?.description).toBe('AL80');
    await host.configurePreferences({ defaultCylinder: '' });
    expect(await host.defaultCylinder()).toBeNull();
  });
});

describe('a downloaded dive', () => {
  async function downloadOne(host: SsrfHost) {
    await host.call('configure', { dataDir: tempDir('ssrf-dc-') });
    await host.call('sim.configure', { dives: [{ day: 1, depthM: 18, minutes: 40 }] });
    await host.call('dcDownloadStart', {
      vendor: 'Deep Six',
      product: 'Excursion',
      address: 'sim-excursion',
      btName: 'EXCURSION',
    });
    for (let i = 0; i < 2000; i++) {
      const status = await host.call<DownloadStatus>('dcDownloadStatus');
      if (status.state !== 'running') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await host.call<ImportResult>('dcDownloadAccept', { indices: [0] });
    const [summary] = await host.listDives();
    return host.getDive(summary.id);
  }

  // The simulated Excursion reports no gas mix at all, so libdivecomputer makes
  // no cylinder for fill_default_cylinder() to fill: the core only fills in a
  // cylinder the computer named but did not size. What this pins down is that a
  // default does not invent a cylinder the computer never mentioned - desktop
  // behaves the same. The filling itself is the core's and is not covered here.
  it('gets no invented cylinder when the computer reports none, default or not', async () => {
    const host = open();
    await host.configurePreferences({ defaultCylinder: 'AL80' });
    const dive = await downloadOne(host);
    expect(dive.cylinders).toEqual([]);
  });
});
