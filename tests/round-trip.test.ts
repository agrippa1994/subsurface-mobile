// AI-generated (Claude)
// Round-trip parity: what the app writes must read back as the same logbook,
// and writing it again must produce the same bytes.
//
// This is the test that protects the architecture. The SSRF file is the source
// of truth and every mutation re-serializes the whole logbook, so anything the
// parser understands but the writer drops would silently destroy user data.
//
// Generations, because the first save is not a no-op for files authored
// elsewhere (see tests/harness/parity.ts for the four upstream fixups):
//
//   original -> save A -> load -> snapshot 1 -> save B -> load -> snapshot 2 -> save C
//
// Snapshot 2 must equal snapshot 1 and C must equal B exactly: from its own
// output onwards the app is a fixed point. Snapshot 1 against the original load
// is compared too, but there the documented fixups are allowed.
//
// The sweep over every logbook in subsurface/dives/ is the project-level
// "round-trip parity with the C++ core" criterion. Files the API deliberately
// rejects (CSV, sqlite, binary dive-computer dumps) are skipped by trying the
// load and moving on when it fails - the same discrimination the app makes.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DIVES_DIR, fixture, snapshotLog, tempDir, type LogSnapshot } from './harness/fixtures';
import { diffSnapshots } from './harness/parity';
import { SsrfHost } from './harness/ssrf-host';

let host: SsrfHost;
let work: string;

beforeAll(() => {
  host = new SsrfHost();
  work = tempDir();
});

afterAll(async () => {
  await host.close();
});

type RoundTrip = {
  /** The logbook as parsed from the original file. */
  original: LogSnapshot;
  /** After one save/load cycle - the app's own output. */
  gen1: LogSnapshot;
  /** After a second cycle. Must equal gen1. */
  gen2: LogSnapshot;
  /** The file written from gen1 and the one written from gen2. */
  xmlB: string;
  xmlC: string;
};

async function roundTrip(path: string, name: string): Promise<RoundTrip> {
  const safe = name.replace(/[^\w.-]/g, '_');
  const a = join(work, `${safe}.a.ssrf`);
  const b = join(work, `${safe}.b.ssrf`);
  const c = join(work, `${safe}.c.ssrf`);

  await host.loadFromXML(path);
  const original = await snapshotLog(host);
  await host.saveToXML(a);

  await host.loadFromXML(a);
  const gen1 = await snapshotLog(host);
  await host.saveToXML(b);

  await host.loadFromXML(b);
  const gen2 = await snapshotLog(host);
  await host.saveToXML(c);

  return { original, gen1, gen2, xmlB: readFileSync(b, 'utf8'), xmlC: readFileSync(c, 'utf8') };
}

const NAMED_FIXTURES = [
  'test29.xml',
  'test15.xml',
  'test40.xml',
  'test42.xml',
  'abitofeverything.ssrf',
  'ostc.xml',
  'vyper.xml',
];

describe.each(NAMED_FIXTURES)('%s', (name) => {
  let result: RoundTrip;

  beforeAll(async () => {
    result = await roundTrip(fixture(name), name);
  });

  it('loses nothing on the first save', () => {
    expect(diffSnapshots(result.original, result.gen1, { allowFixups: true })).toEqual([]);
  });

  it('is a fixed point from its own output onwards', () => {
    expect(diffSnapshots(result.gen1, result.gen2)).toEqual([]);
  });

  it('is byte-stable', () => {
    expect(result.xmlC).toBe(result.xmlB);
  });
});

describe('every logbook in subsurface/dives', () => {
  // Anything the parser accepts has to survive the round trip, not just the
  // handful of files above.
  const candidates = readdirSync(DIVES_DIR)
    .filter((f) => f.endsWith('.xml') || f.endsWith('.ssrf'))
    .sort();

  it('round-trips without losing anything', async () => {
    expect(candidates.length).toBeGreaterThan(50);

    const rejected: string[] = [];
    const lossy: Record<string, string[]> = {};
    const notFixedPoint: Record<string, string[]> = {};
    const unstable: string[] = [];
    let checked = 0;

    for (const name of candidates) {
      try {
        await host.loadFromXML(fixture(name));
      } catch {
        // Not a logbook this API accepts (some .xml files here are dive
        // computer dumps in other dialects); the app rejects them too.
        rejected.push(name);
        continue;
      }
      const result = await roundTrip(fixture(name), `sweep-${name}`);

      const lost = diffSnapshots(result.original, result.gen1, { allowFixups: true });
      if (lost.length > 0) {
        lossy[name] = lost.slice(0, 5);
      }
      const moved = diffSnapshots(result.gen1, result.gen2);
      if (moved.length > 0) {
        notFixedPoint[name] = moved.slice(0, 5);
      }
      if (result.xmlC !== result.xmlB) {
        unstable.push(name);
      }
      checked++;
    }

    expect({ lossy, notFixedPoint, unstable }).toEqual({
      lossy: {},
      notFixedPoint: {},
      unstable: [],
    });
    expect(checked).toBeGreaterThan(50);
    // A load failure is fine, a silent zero is not.
    expect(checked + rejected.length).toBe(candidates.length);
  });
});

describe('mutations survive a round trip', () => {
  it('keeps an edited dive and a new dive site', async () => {
    await host.loadFromXML(fixture('test29.xml'));
    const [summary] = await host.listDives();

    const { uuid } = await host.upsertDiveSite({
      name: 'Round trip test site',
      latUdeg: 12488540,
      lonUdeg: -61491340,
      description: 'created by the test suite',
    });
    const patched = await host.updateDive(summary.id, {
      notes: 'edited by the test suite',
      buddy: 'Test Buddy',
      rating: 4,
      tags: ['boat', 'cave'],
      siteUuid: uuid,
    });
    expect(patched.notes).toBe('edited by the test suite');

    const path = join(work, 'mutated.ssrf');
    await host.saveToXML(path);
    await host.loadFromXML(path);

    const reloaded = await host.getDive((await host.listDives())[0].id);
    expect(reloaded.notes).toBe('edited by the test suite');
    expect(reloaded.buddy).toBe('Test Buddy');
    expect(reloaded.rating).toBe(4);
    expect(reloaded.tags).toEqual(['boat', 'cave']);
    // Dive site uuids are persisted, unlike dive ids.
    expect(reloaded.siteUuid).toBe(uuid);
    expect(reloaded.siteName).toBe('Round trip test site');
  });

  it('detaches dives from a deleted site', async () => {
    await host.loadFromXML(fixture('test15.xml'));
    const sites = await host.listDiveSites();
    await host.deleteDiveSite(sites[0].uuid);

    expect(await host.listDiveSites()).toHaveLength(0);
    const [summary] = await host.listDives();
    expect(summary.siteUuid).toBe(0);

    const path = join(work, 'no-site.ssrf');
    await host.saveToXML(path);
    await host.loadFromXML(path);
    expect(await host.listDiveSites()).toHaveLength(0);
  });
});
