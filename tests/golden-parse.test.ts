// AI-generated (Claude)
// Golden parse assertions: fixed logbooks out of subsurface/dives/, with the
// expected values read off the XML source itself (and cross-checked against the
// upstream test suite in subsurface/tests/testparse.cpp).
//
// These pin the *whole* path the app uses - core parser, bindings, JSON
// marshalling - to the numbers as written in the file, in raw core units.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatWhenIso, mkelvinToCelsius, mmToMeters, udegToDegrees } from '../src/models';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;

beforeAll(() => {
  host = new SsrfHost();
});

afterAll(async () => {
  await host.close();
});

describe('test29.xml - tags, dates, depths', () => {
  beforeAll(async () => {
    await host.loadFromXML(fixture('test29.xml'));
  });

  it('parses all four dives', async () => {
    const loaded = await host.loadFromXML(fixture('test29.xml'));
    expect(loaded.dives).toBe(4);
    expect(await host.listDives()).toHaveLength(4);
  });

  it('reads the first dive exactly as written', async () => {
    const [first] = await host.listDives();
    // <dive number='29' date='2011-12-13' time='06:35:00' duration='30:00 min'>
    expect(first.number).toBe(29);
    expect(formatWhenIso(first.when)).toBe('2011-12-13T06:35:00Z');
    expect(first.durationSec).toBe(30 * 60);
    // <depth max='20.1 m' mean='18.293 m' /> <temperature water='20.0 C' />
    expect(first.maxDepthMm).toBe(20100);
    expect(first.meanDepthMm).toBe(18293);
    expect(mkelvinToCelsius(first.waterTempMkelvin)).toBe(20);
    expect(first.dcModel).toBe('Model Product');
    expect(first.siteName).toBe('irrelevant dive location');
  });

  it('reads the tag lists', async () => {
    const dives = await host.listDives();
    // tags='boat, wreck', tags='', tags=',' (both entries empty), tags='a, boat'
    expect(dives.map((d) => d.tags)).toEqual([['boat', 'wreck'], [], [], ['a', 'boat']]);
  });

  it('collapses the four dives onto one shared dive site', async () => {
    const sites = await host.listDiveSites();
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('irrelevant dive location');
    expect(sites[0].diveCount).toBe(4);
  });

  it('reads the six samples of the first dive', async () => {
    const [first] = await host.listDives();
    const dive = await host.getDive(first.id);
    // Six <sample> elements, the deepest at 20.1 m.
    expect(dive.dcs[0].sampleCount).toBe(6);
    const profile = await host.getProfile(first.id);
    expect(Math.max(...profile.entry.map((e) => e.depthMm))).toBe(20100);
  });
});

describe('test15.xml - trimix, cylinders, GPS', () => {
  beforeAll(async () => {
    await host.loadFromXML(fixture('test15.xml'));
  });

  it('reads the single dive', async () => {
    const dives = await host.listDives();
    expect(dives).toHaveLength(1);
    const [dive] = dives;
    expect(dive.number).toBe(15);
    expect(formatWhenIso(dive.when)).toBe('2011-12-01T10:00:00Z');
    expect(mmToMeters(dive.maxDepthMm)).toBe(70);
    expect(mmToMeters(dive.meanDepthMm)).toBe(25);
    expect(mkelvinToCelsius(dive.waterTempMkelvin)).toBe(6);
  });

  it('reads the three cylinders with their gas mixes', async () => {
    const [summary] = await host.listDives();
    const dive = await host.getDive(summary.id);
    expect(mkelvinToCelsius(dive.airTempMkelvin)).toBe(2);
    expect(dive.notes).toBe('Nothing of value, just getting something for the divelist');

    expect(dive.cylinders.map((c) => c.description)).toEqual([
      '15L 232 bar',
      '15L 232 bar',
      'AL50',
    ]);
    expect(dive.cylinders.map((c) => c.sizeMl)).toEqual([15000, 15000, 6900]);
    expect(dive.cylinders.map((c) => c.workingPressureMbar)).toEqual([232009, 232009, 206843]);
    expect(dive.cylinders.map((c) => c.startMbar)).toEqual([227527, 227527, 206843]);
    expect(dive.cylinders.map((c) => c.endMbar)).toEqual([96527, 75842, 68948]);

    // The first cylinder has no o2 attribute: the core's "0 means air"
    // sentinel, resolved to 20.9% in the effective fields.
    expect(dive.cylinders[0].gasmix).toMatchObject({
      o2Permille: 0,
      hePermille: 0,
      o2EffectivePermille: 209,
    });
    expect(dive.cylinders[1].gasmix).toMatchObject({ o2Permille: 150, hePermille: 500 });
    expect(dive.cylinders[2].gasmix).toMatchObject({ o2Permille: 700, hePermille: 0 });
  });

  it('reads the gas switch events at their written times', async () => {
    const [summary] = await host.listDives();
    const dive = await host.getDive(summary.id);
    // <event time='10:00 min'/>, '20:30 min', '25:59 min'
    expect(dive.dcs[0].events.map((e) => e.timeSec)).toEqual([600, 1230, 1559]);
    expect(dive.dcs[0].events.every((e) => e.name === 'gaschange')).toBe(true);
  });

  it('reads the GPS position into a dive site', async () => {
    const sites = await host.listDiveSites();
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('15th test dive - trimix');
    expect(sites[0].hasGps).toBe(true);
    // <gps>12.48854 -61.49134</gps>
    expect(udegToDegrees(sites[0].latUdeg)).toBeCloseTo(12.48854, 5);
    expect(udegToDegrees(sites[0].lonUdeg)).toBeCloseTo(-61.49134, 5);
  });
});

describe('abitofeverything.ssrf - the full-feature logbook', () => {
  beforeAll(async () => {
    await host.loadFromXML(fixture('abitofeverything.ssrf'));
  });

  it('loads 18 dives and 26 dive sites', async () => {
    const loaded = await host.loadFromXML(fixture('abitofeverything.ssrf'));
    expect(loaded.dives).toBe(18);
    expect(loaded.sites).toBe(26);
    const sites = await host.listDiveSites();
    expect(sites).toHaveLength(26);
    expect(sites.filter((s) => s.hasGps)).toHaveLength(17);
  });

  it('keeps the dives sorted by date, oldest first', async () => {
    const dives = await host.listDives();
    const when = dives.map((d) => d.when);
    expect(when).toEqual([...when].sort((a, b) => a - b));
    expect(formatWhenIso(when[0])).toBe('2010-12-05T11:26:00Z');
    expect(dives[0].number).toBe(5);
    expect(dives[0].siteName).toBe('Sund Rock, Hoodsport, WA, USA');
  });

  it('reads a dive computer dive with a profile', async () => {
    const dives = await host.listDives();
    // <dive number='94' ... > on the Uemis Zurich, 1:05:36 long, 36.01 m deep.
    const zenobia = dives.find((d) => d.number === 94);
    expect(zenobia).toBeDefined();
    expect(zenobia!.dcModel).toBe('Uemis Zurich');
    expect(zenobia!.maxDepthMm).toBe(36010);
    expect(zenobia!.durationSec).toBe(3936);
    expect(zenobia!.siteName).toBe('Zenobia, Larnaca, Cyprus');
  });

  it('exposes trips through the dive summaries', async () => {
    const dives = await host.listDives();
    // <trip date='2011-01-01' ... location='9Ath test dive, ...'>
    const trip = dives.find((d) => d.number === 9);
    expect(trip?.tripLocation).toBe('9Ath test dive, with temperature in single sample');
  });
});

describe('statistics', () => {
  it('cover every loaded dive', async () => {
    await host.loadFromXML(fixture('test29.xml'));
    const stats = await host.getStatistics();
    expect(stats.matched).toBe(4);
    expect(stats.total.selectionSize).toBe(4);
    // Four 30-minute dives, all 20.1 m deep.
    expect(stats.total.totalTimeSec).toBe(4 * 30 * 60);
    expect(stats.total.maxDepthMm).toBe(20100);
    expect(stats.total.minDepthMm).toBe(20100);
  });

  it('honour a depth filter', async () => {
    await host.loadFromXML(fixture('abitofeverything.ssrf'));
    const all = await host.getStatistics();
    const deep = await host.getStatistics({ minDepthMm: 30000 });
    expect(deep.matched).toBeGreaterThan(0);
    expect(deep.matched).toBeLessThan(all.matched);
    expect(deep.total.minDepthMm).toBeGreaterThanOrEqual(30000);
  });
});

describe('error handling', () => {
  it('rejects a file that is not a logbook', async () => {
    await expect(host.loadFromXML(fixture('TestDiveDM4.db'))).rejects.toThrow();
  });

  it('rejects an unknown dive id', async () => {
    await host.loadFromXML(fixture('test15.xml'));
    await expect(host.getDive(-1)).rejects.toThrow();
  });
});
