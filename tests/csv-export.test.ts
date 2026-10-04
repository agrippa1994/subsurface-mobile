// AI-generated (Claude)
// Per-dive CSV export, driven through the real C++ bindings.
//
// The three formats are written by the core's own code (two XSLT stylesheets
// and save-profiledata.cpp), so what is asserted here is the part the bindings
// add: that exactly the one dive asked for ends up in the file, that the unit
// switch reaches the stylesheets, and that bad arguments are refused rather
// than producing an empty file.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { DiveSummary } from '../src/models';
import { fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const SAMPLE = fixture('abitofeverything.ssrf');

const hosts: SsrfHost[] = [];

async function loadedHost(): Promise<SsrfHost> {
  const host = new SsrfHost();
  hosts.push(host);
  await host.configure();
  await host.loadFromXML(SAMPLE);
  return host;
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.close()));
});

/** The file's lines, without the trailing empty one(s). */
function lines(path: string): string[] {
  const all = readFileSync(path, 'utf8').split('\n');
  while (all.length > 0 && all[all.length - 1] === '') {
    all.pop();
  }
  return all;
}

/** Two distinct numbered dives that both carry samples. */
async function twoDivesWithSamples(host: SsrfHost): Promise<[DiveSummary, DiveSummary]> {
  const picked: DiveSummary[] = [];
  for (const summary of await host.listDives()) {
    const dive = await host.getDive(summary.id);
    if (summary.number > 0 && (dive.dcs[0]?.sampleCount ?? 0) > 0) {
      picked.push(summary);
    }
    if (picked.length === 2) {
      return [picked[0], picked[1]];
    }
  }
  throw new Error('fixture has fewer than two numbered dives with samples');
}

describe('exportDiveCSV', () => {
  it('writes the samples of exactly the one dive as "details"', async () => {
    const host = await loadedHost();
    const [first, second] = await twoDivesWithSamples(host);
    const dir = tempDir();

    for (const target of [first, second]) {
      const path = join(dir, `details-${target.id}.csv`);
      await expect(host.exportDiveCSV(target.id, path, { format: 'details' })).resolves.toEqual({
        path,
        format: 'details',
      });

      const [header, ...rows] = lines(path);
      expect(header).toContain('"sample depth (m)"');
      expect(rows).toHaveLength((await host.getDive(target.id)).dcs[0].sampleCount);
      // The first column is the dive number; any other dive leaking in through
      // a stale selection would show up here.
      expect(new Set(rows.map((row) => row.split(',')[0]))).toEqual(
        new Set([`"${target.number}"`]),
      );
    }
  });

  it('switches the stylesheets to imperial units', async () => {
    const host = await loadedHost();
    const [dive] = await twoDivesWithSamples(host);
    const dir = tempDir();

    const details = join(dir, 'details.csv');
    await host.exportDiveCSV(dive.id, details, { format: 'details', imperial: true });
    expect(lines(details)[0]).toContain('"sample depth (ft)"');

    const summary = join(dir, 'summary.csv');
    await host.exportDiveCSV(dive.id, summary, { format: 'summary', imperial: true });
    expect(lines(summary)[0]).toContain('maxdepth [ft]');
  });

  it('writes one row of dive information as "summary"', async () => {
    const host = await loadedHost();
    const [, dive] = await twoDivesWithSamples(host);
    const path = join(tempDir(), 'summary.csv');
    await host.exportDiveCSV(dive.id, path, { format: 'summary' });

    const [header, ...rows] = lines(path);
    expect(header.startsWith('dive number,date,time,duration [min]')).toBe(true);
    expect(header).toContain('maxdepth [m]');
    expect(rows).toHaveLength(1);
    expect(rows[0].split(',')[0]).toBe(String(dive.number));
  });

  it('writes the computed profile of the dive as "profile"', async () => {
    const host = await loadedHost();
    const [dive] = await twoDivesWithSamples(host);
    const gf = { gfLow: 40, gfHigh: 85 };
    const path = join(tempDir(), 'profile.csv');
    await host.exportDiveCSV(dive.id, path, { format: 'profile', gf });

    const [header, ...rows] = lines(path);
    expect(header.startsWith('"in_deco","sec",')).toBe(true);
    expect(header).toContain('"temperature","depth","ceiling"');
    // One row per plot entry - the same plot getProfile builds with these GFs.
    const plot = await host.getProfile(dive.id, 0, gf);
    expect(rows).toHaveLength(plot.nr);
    const seconds = rows.map((row) => Number(row.split(',')[1].replace(/"/g, '')));
    expect(seconds).toEqual(plot.entry.map((entry) => entry.sec));
  });

  it('refuses an unknown format, bad units and an unknown dive', async () => {
    const host = await loadedHost();
    const [dive] = await twoDivesWithSamples(host);
    const path = join(tempDir(), 'bad.csv');

    await expect(
      host.call('exportDiveCSV', { id: dive.id, path, format: 'xlsx' }),
    ).rejects.toThrow(/unknown CSV format/);
    await expect(
      host.call('exportDiveCSV', { id: dive.id, path, format: 'details', units: 2 }),
    ).rejects.toThrow(/units/);
    await expect(host.exportDiveCSV(-1, path, { format: 'details' })).rejects.toThrow();
    await expect(
      host.call('exportDiveCSV', { id: dive.id, format: 'details' }),
    ).rejects.toThrow(/path/);
  });

  it('leaves the statistics selection alone', async () => {
    const host = await loadedHost();
    const before = await host.getStatistics();
    const [dive] = await twoDivesWithSamples(host);
    await host.exportDiveCSV(dive.id, join(tempDir(), 'any.csv'), { format: 'summary' });
    expect(await host.getStatistics()).toEqual(before);
  });
});
