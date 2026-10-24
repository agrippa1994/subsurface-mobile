// AI-generated (Claude)
// The MCP server's tools, driven through the real C++ bindings: the same
// handler the app runs (src/models/mcp), with the host binary standing in for
// the native module. What is asserted is the part the tools add - filtering,
// paging, unit conversion and picking the dive - against what the core itself
// returns for the same logbook.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMcpHandler } from '../src/models/mcp/protocol';
import type { McpLogbook } from '../src/models/mcp/tools';
import { fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const SAMPLE = fixture('abitofeverything.ssrf');
const GF = { gfLow: 40, gfHigh: 85 };

let host: SsrfHost;
let handler: ReturnType<typeof createMcpHandler>;
let nextCsv = 0;

beforeAll(async () => {
  host = new SsrfHost();
  await host.configure();
  await host.loadFromXML(SAMPLE);
  const dir = tempDir('mcp-');
  const logbook: McpLogbook = {
    listDives: () => host.listDives(),
    getDive: (id) => host.getDive(id),
    listDiveSites: () => host.listDiveSites(),
    getStatistics: (filter) => host.getStatistics(filter),
    async exportDiveCsv(id, options) {
      const path = join(dir, `${nextCsv++}.csv`);
      await host.exportDiveCSV(id, path, options);
      return readFileSync(path, 'utf8');
    },
    gradientFactors: () => GF,
  };
  handler = createMcpHandler(logbook, { name: 'test', title: 'Test', version: '0' });
});

afterAll(async () => {
  await host.close();
});

let rpcId = 0;

/** Calls a tool and returns its result: parsed JSON, or the text as is. */
async function callTool(name: string, args: Record<string, unknown> = {}) {
  const response = await handler({
    id: 'x',
    method: 'POST',
    path: '/mcp',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const reply = JSON.parse(response.body ?? '');
  const result = reply.result as {
    content: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  return {
    isError: result.isError === true,
    text: result.content[0].text,
    data: result.structuredContent as any,
  };
}

describe('list_dives', () => {
  it('lists every dive, newest first, in readable units', async () => {
    const dives = await host.listDives();
    const { data } = await callTool('list_dives');
    expect(data.total).toBe(dives.length);
    expect(data.dives).toHaveLength(dives.length);

    const times = data.dives.map((dive: { dateTime: string }) => dive.dateTime);
    expect(times).toEqual([...times].sort().reverse());

    const deepest = dives.reduce((a, b) => (b.maxDepthMm > a.maxDepthMm ? b : a));
    const row = data.dives.find((dive: { id: number }) => dive.id === deepest.id);
    expect(row.maxDepthM).toBeCloseTo(deepest.maxDepthMm / 1000, 2);
    expect(row.durationMin).toBeCloseTo(deepest.durationSec / 60, 1);
    expect(row.number).toBe(deepest.number);
  });

  it('pages, and says where the next page starts', async () => {
    const all = (await callTool('list_dives', { order: 'oldest' })).data;
    const first = (await callTool('list_dives', { order: 'oldest', limit: 2 })).data;
    expect(first.returned).toBe(2);
    expect(first.nextOffset).toBe(2);
    const second = (await callTool('list_dives', { order: 'oldest', limit: 2, offset: 2 })).data;
    expect([...first.dives, ...second.dives]).toEqual(all.dives.slice(0, 4));
  });

  it('filters by date, depth and site', async () => {
    const dives = await host.listDives();
    const sorted = [...dives].sort((a, b) => a.when - b.when);
    const day = new Date(sorted[0].when * 1000).toISOString().slice(0, 10);
    const sameDay = dives.filter(
      (dive) => new Date(dive.when * 1000).toISOString().slice(0, 10) === day,
    );
    const onDay = (await callTool('list_dives', { from: day, to: day })).data;
    expect(onDay.total).toBe(sameDay.length);

    const deep = (await callTool('list_dives', { minDepthM: 20 })).data;
    expect(deep.total).toBe(dives.filter((dive) => dive.maxDepthMm >= 20000).length);

    const withSite = dives.find((dive) => dive.siteName !== '');
    expect(withSite).toBeDefined();
    const atSite = (await callTool('list_dives', { siteUuid: withSite!.siteUuid })).data;
    expect(atSite.total).toBe(dives.filter((dive) => dive.siteUuid === withSite!.siteUuid).length);
    expect(atSite.dives.every((row: { site: string }) => row.site === withSite!.siteName)).toBe(
      true,
    );
  });
});

describe('get_dive', () => {
  it('returns notes, cylinders and weights, by id or by number', async () => {
    const summaries = await host.listDives();
    let picked;
    for (const summary of summaries) {
      const dive = await host.getDive(summary.id);
      if (summary.number > 0 && dive.cylinders.length > 0) {
        picked = dive;
        break;
      }
    }
    expect(picked).toBeDefined();
    const dive = picked!;

    const byId = (await callTool('get_dive', { id: dive.id })).data;
    const byNumber = (await callTool('get_dive', { number: dive.number })).data;
    expect(byNumber.id).toBe(byId.id);

    expect(byId.notes).toBe(dive.notes || null);
    expect(byId.cylinders).toHaveLength(dive.cylinders.length);
    expect(byId.weights).toHaveLength(dive.weightsystems.length);
    const cylinder = dive.cylinders[0];
    expect(byId.cylinders[0].sizeL).toBe(
      cylinder.sizeMl > 0 ? Math.round(cylinder.sizeMl / 100) / 10 : null,
    );
    expect(byId.cylinders[0].o2Percent).toBe(Math.round(cylinder.gasmix.o2EffectivePermille) / 10);
    expect(byId.diveComputers).toHaveLength(dive.dcs.length);
  });

  it('says so for a dive that is not there', async () => {
    const missing = await callTool('get_dive', { number: 999999 });
    expect(missing.isError).toBe(true);
    expect(missing.text).toMatch(/No dive is numbered 999999/);
    expect((await callTool('get_dive', {})).isError).toBe(true);
  });
});

describe('get_statistics', () => {
  it('reports the core totals, with yearly buckets that add up', async () => {
    const summary = await host.getStatistics();
    const { data } = await callTool('get_statistics', { groupBy: ['year', 'month', 'depth'] });
    expect(data.total.dives).toBe(summary.total.selectionSize);
    expect(data.total.totalTimeMin).toBe(Math.round(summary.total.totalTimeSec / 60));
    expect(data.distinctSites).toBe(summary.siteCount);

    const yearly = data.byYear.reduce(
      (sum: number, year: { dives: number }) => sum + year.dives,
      0,
    );
    expect(yearly).toBe(summary.total.selectionSize);
    expect(data.byMonth[0].month).toMatch(/^\d{4}-\d{2}$/);
    const banded = data.byDepth.reduce(
      (sum: number, band: { dives: number }) => sum + band.dives,
      0,
    );
    expect(banded).toBe(summary.total.selectionSize);
  });

  it('passes filters to the core', async () => {
    const filtered = await host.getStatistics({ minDepthMm: 20000 });
    const { data } = await callTool('get_statistics', { minDepthM: 20 });
    expect(data.matched).toBe(filtered.matched);
    expect(data.total.dives).toBe(filtered.total.selectionSize);
  });

  it('refuses an unknown breakdown', async () => {
    expect((await callTool('get_statistics', { groupBy: ['weekday'] })).isError).toBe(true);
  });
});

describe('list_dive_sites', () => {
  it('lists the sites with positions in degrees', async () => {
    const sites = await host.listDiveSites();
    const { data } = await callTool('list_dive_sites');
    expect(data.total).toBe(sites.length);
    const gps = sites.find((site) => site.hasGps);
    if (gps) {
      const row = data.sites.find((site: { uuid: number }) => site.uuid === gps.uuid);
      expect(row.latitude).toBeCloseTo(gps.latUdeg / 1e6, 5);
      expect(row.longitude).toBeCloseTo(gps.lonUdeg / 1e6, 5);
    }
    const named = sites.find((site) => site.name !== '')!;
    const found = (await callTool('list_dive_sites', { query: named.name.toUpperCase() })).data;
    expect(found.sites.map((site: { uuid: number }) => site.uuid)).toContain(named.uuid);
  });
});

describe('export_dive_csv', () => {
  async function diveWithSamples() {
    for (const summary of await host.listDives()) {
      const dive = await host.getDive(summary.id);
      if ((dive.dcs[0]?.sampleCount ?? 0) > 0) {
        return dive;
      }
    }
    throw new Error('no dive with samples');
  }

  it('returns the computed profile at the app gradient factors by default', async () => {
    const dive = await diveWithSamples();
    const result = await callTool('export_dive_csv', { id: dive.id });
    expect(result.isError).toBe(false);
    const [header, ...rows] = result.text.trimEnd().split('\n');
    expect(header.startsWith('"in_deco","sec",')).toBe(true);
    const plot = await host.getProfile(dive.id, 0, GF);
    expect(rows).toHaveLength(plot.nr);
  });

  it('offers the other two CSV formats', async () => {
    const dive = await diveWithSamples();
    const details = await callTool('export_dive_csv', { id: dive.id, format: 'details' });
    expect(details.text.split('\n')[0]).toContain('"sample depth (m)"');
    const summary = await callTool('export_dive_csv', { id: dive.id, format: 'summary' });
    expect(summary.text.startsWith('dive number,date,time,duration [min]')).toBe(true);
    expect((await callTool('export_dive_csv', { id: dive.id, format: 'xlsx' })).isError).toBe(true);
  });
});
