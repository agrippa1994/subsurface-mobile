// AI-generated (Claude)
// A dive recorded by several computers, through the bindings: what the detail
// screen relies on when it switches between them. Dive 224 of abitofeverything
// has three, whose figures all differ.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Dive } from '../src/models';
import { computerLabels, plotForComputer } from '../src/models/dive-computers';
import { buildProfilePlot, profileSummary } from '../src/models/profile-plot';
import { fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';
import { METRIC_UNITS } from '../src/models/units';

let host: SsrfHost;
let dive: Dive;

beforeAll(async () => {
  host = new SsrfHost();
  await host.loadFromXML(fixture('abitofeverything.ssrf'));
  const summary = (await host.listDives()).find((candidate) => candidate.number === 224);
  dive = await host.getDive(summary!.id);
});

afterAll(async () => {
  await host.close();
});

describe('a dive with three computers', () => {
  it('names each computer', () => {
    expect(computerLabels(dive.dcs)).toEqual([
      'Uemis Zurich',
      'Heinrichs Weikamp OSTC 2N',
      'Shearwater Petrel',
    ]);
  });

  it('plots each computer from its own samples', async () => {
    const entries = await Promise.all(
      dive.dcs.map(async (_, index) => (await host.getProfile(dive.id, index)).entry.length),
    );
    expect(new Set(entries).size).toBe(3);
    const deepest = async (index: number) =>
      (await host.getProfile(dive.id, index)).entry.reduce((m, e) => Math.max(m, e.depthMm), 0);
    for (const index of [0, 1, 2]) {
      expect(await deepest(index)).toBeLessThanOrEqual(dive.dcs[index].maxDepthMm);
    }
  });

  it('holds per-computer events apart', () => {
    expect(dive.dcs.map((dc) => dc.events.length)).toEqual([2, 1, 1]);
  });

  it('derives the dive figures from all the computers', () => {
    expect(dive.maxDepthMm).toBe(Math.max(...dive.dcs.map((dc) => dc.maxDepthMm)));
    expect(dive.durationSec).toBe(Math.max(...dive.dcs.map((dc) => dc.durationSec)));
    // So the second computer's own figures differ from the dive's.
    expect(dive.dcs[1].maxDepthMm).toBeLessThan(dive.maxDepthMm);
  });

  it('reports the plotted dive maximum, which plotForComputer replaces', async () => {
    const profile = await host.getProfile(dive.id, 1);
    expect(profile.maxDepthMm).toBe(dive.maxDepthMm);
    const plot = plotForComputer(buildProfilePlot(profile, dive.dcs[1].events), dive.dcs, 1);
    expect(plot.maxDepthMm).toBe(dive.dcs[1].maxDepthMm);
    expect(profileSummary(plot, METRIC_UNITS)).toContain('maximum depth 24.1');
  });

  it('rejects a computer out of range rather than wrapping', async () => {
    await expect(host.getProfile(dive.id, 3)).rejects.toThrow();
  });
});

describe('a dive with one computer', () => {
  it('leaves the plot alone', async () => {
    await host.loadFromXML(fixture('ostc.xml'));
    const [summary] = await host.listDives();
    const single = await host.getDive(summary.id);
    expect(single.dcs).toHaveLength(1);
    const plot = buildProfilePlot(await host.getProfile(single.id), single.dcs[0].events);
    expect(plotForComputer(plot, single.dcs, 0)).toBe(plot);
  });
});
