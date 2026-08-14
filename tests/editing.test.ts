// AI-generated (Claude)
// Editing, driven through the real C++ bindings (task 10).
//
// The point of these tests is persistence, not the UI: a change is only a
// change once it is in the SSRF file, because the file is the source of truth.
// Every case therefore mutates, saves, and then loads the file into a *fresh*
// host process - which is what a force-quit and relaunch does to the app, ids
// and all.
//
// The patches themselves are built by the same model functions the editors use
// (src/models/dive-edit.ts, src/models/site-edit.ts), so what is exercised here
// is the whole path from draft to disk.

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildDivePatch, diveDraftFrom, parseNameList } from '../src/models/dive-edit';
import {
  buildSiteInput,
  parseCoordinates,
  siteDraftFrom,
  validateSiteDraft,
} from '../src/models/site-edit';
import { fixture, snapshotLog, tempDir } from './harness/fixtures';
import { diffSnapshots } from './harness/parity';
import { SsrfHost } from './harness/ssrf-host';

const SAMPLE = fixture('abitofeverything.ssrf');

let workDir: string;
let host: SsrfHost;

/**
 * The logbook the tests edit: the sample saved once, then reloaded. Editing
 * starts from that second generation on purpose - the first save of a file
 * authored elsewhere completes what the file left open (see harness/parity.ts),
 * and mixing that in would make an edit test fail for a reason that has nothing
 * to do with editing.
 */
async function freshLogbook(name: string): Promise<{ host: SsrfHost; path: string }> {
  const path = join(workDir, name);
  const first = new SsrfHost();
  await first.loadFromXML(SAMPLE);
  await first.saveToXML(path);
  await first.close();

  const reopened = new SsrfHost();
  await reopened.loadFromXML(path);
  return { host: reopened, path };
}

/** Loads `path` in a new process, the way a relaunch does. */
async function relaunch(path: string): Promise<SsrfHost> {
  const next = new SsrfHost();
  await next.loadFromXML(path);
  return next;
}

beforeAll(() => {
  workDir = tempDir('ssrf-editing-');
  if (!existsSync(workDir)) {
    mkdirSync(workDir, { recursive: true });
  }
});

afterAll(async () => {
  await host?.close();
});

describe('dive edits persist', () => {
  it('keeps a new buddy and a new dive site across a relaunch', async () => {
    const opened = await freshLogbook('edit-dive.ssrf');
    const before = await snapshotLog(opened.host);

    const dives = await opened.host.listDives();
    const target = dives[0];
    const dive = await opened.host.getDive(target.id);

    // The site the dive is moved to does not exist yet: create it first, the
    // same order the editor's site picker uses.
    const draft = {
      uuid: 0,
      name: 'Test Reef',
      description: 'Created by the editing test',
      notes: '',
      ...parseCoordinates('12.345678, -45.678901')!,
    };
    expect(validateSiteDraft(draft)).toEqual({ ok: true });
    const { uuid } = await opened.host.upsertDiveSite(buildSiteInput(draft));
    expect(uuid).toBeGreaterThan(0);

    const patch = buildDivePatch(dive, {
      ...diveDraftFrom(dive),
      buddy: 'Alice Diver, Bob Diver',
      notes: 'Edited by the test.',
      rating: 5,
      tags: ['boat', 'test-edit'],
      siteUuid: uuid,
    });
    expect(patch.siteUuid).toBe(uuid);
    await opened.host.updateDive(dive.id, patch);
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    // Relaunch: nothing is cached, everything comes back off the file.
    host = await relaunch(opened.path);
    const after = await snapshotLog(host);

    const reloaded = (await host.listDives()).find((d) => d.number === target.number);
    expect(reloaded).toBeDefined();
    const full = await host.getDive(reloaded!.id);
    expect(parseNameList(full.buddy)).toEqual(['Alice Diver', 'Bob Diver']);
    expect(full.notes).toBe('Edited by the test.');
    expect(full.rating).toBe(5);
    expect(full.tags).toContain('test-edit');
    expect(full.siteUuid).toBe(uuid);
    expect(full.siteName).toBe('Test Reef');

    const site = (await host.listDiveSites()).find((s) => s.uuid === uuid);
    expect(site).toBeDefined();
    expect(site!.hasGps).toBe(true);
    expect(site!.latUdeg).toBe(12_345_678);
    expect(site!.lonUdeg).toBe(-45_678_901);
    expect(site!.description).toBe('Created by the editing test');
    expect(site!.diveCount).toBe(1);

    // Nothing else moved: every other dive is byte-for-byte what it was, and
    // so is every site except the two the move touched - the new one, and the
    // one the dive came from, which is down a dive.
    expect(after.dives).toHaveLength(before.dives.length);
    expect(after.sites).toHaveLength(before.sites.length + 1);
    const untouched = (snapshot: typeof before) =>
      snapshot.dives.filter((d) => d.number !== target.number);
    expect(diffSnapshots(untouched(before), untouched(after))).toEqual([]);

    const otherSites = (sites: typeof before.sites) =>
      sites.filter((s) => s.uuid !== uuid && s.uuid !== target.siteUuid);
    expect(diffSnapshots(otherSites(before.sites), otherSites(after.sites))).toEqual([]);
    if (target.siteUuid !== 0) {
      const previous = before.sites.find((s) => s.uuid === target.siteUuid)!;
      const now = after.sites.find((s) => s.uuid === target.siteUuid)!;
      expect(now.diveCount).toBe(previous.diveCount - 1);
      expect(now.name).toBe(previous.name);
    }

    await host.close();
  });

  it('detaches a dive from its site when the draft clears it', async () => {
    const opened = await freshLogbook('detach-dive.ssrf');
    const withSite = (await opened.host.listDives()).find((d) => d.siteUuid !== 0);
    expect(withSite).toBeDefined();
    const dive = await opened.host.getDive(withSite!.id);

    const patch = buildDivePatch(dive, { ...diveDraftFrom(dive), siteUuid: 0 });
    expect(patch).toEqual({ siteUuid: 0 });
    await opened.host.updateDive(dive.id, patch);
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const reloaded = (await host.listDives()).find((d) => d.number === withSite!.number);
    expect(reloaded!.siteUuid).toBe(0);
    expect(reloaded!.siteName).toBe('');
    // The site itself survives the detachment, it just has one dive fewer.
    const site = (await host.listDiveSites()).find((s) => s.uuid === withSite!.siteUuid);
    expect(site).toBeDefined();
    await host.close();
  });

  it('writes nothing when the draft matches the dive', async () => {
    const opened = await freshLogbook('no-op-edit.ssrf');
    const dives = await opened.host.listDives();
    const dive = await opened.host.getDive(dives[0].id);
    expect(buildDivePatch(dive, diveDraftFrom(dive))).toEqual({});
    await opened.host.close();
  });
});

describe('dive site management', () => {
  it('creates, edits and deletes a site with a position', async () => {
    const opened = await freshLogbook('sites.ssrf');
    const siteCountBefore = (await opened.host.listDiveSites()).length;

    // Create.
    const coords = parseCoordinates("N 47 22.614' E 8 32.502'")!;
    const { uuid } = await opened.host.upsertDiveSite(
      buildSiteInput({
        uuid: 0,
        name: 'Lake Zurich',
        description: 'Cold',
        notes: 'Entry by the pier',
        latUdeg: coords.latUdeg,
        lonUdeg: coords.lonUdeg,
      })
    );
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    let site = (await host.listDiveSites()).find((s) => s.uuid === uuid)!;
    expect(site.name).toBe('Lake Zurich');
    expect(site.notes).toBe('Entry by the pier');
    // 47 deg 22.614 min is 47.3769 deg, within a metre of the decimal spelling.
    expect(site.latUdeg).toBeGreaterThan(47_376_800);
    expect(site.latUdeg).toBeLessThan(47_377_000);

    // Edit: the rename must not blank the fields it does not mention.
    const renamed = buildSiteInput({ ...siteDraftFrom(site), name: 'Lake Zurich North' }, site);
    expect(renamed).toEqual({ uuid, name: 'Lake Zurich North' });
    await host.upsertDiveSite(renamed);
    await host.saveToXML(opened.path);
    await host.close();

    host = await relaunch(opened.path);
    site = (await host.listDiveSites()).find((s) => s.uuid === uuid)!;
    expect(site.name).toBe('Lake Zurich North');
    expect(site.description).toBe('Cold');
    expect(site.notes).toBe('Entry by the pier');

    // Delete.
    await host.deleteDiveSite(uuid);
    await host.saveToXML(opened.path);
    await host.close();

    host = await relaunch(opened.path);
    const sites = await host.listDiveSites();
    expect(sites.find((s) => s.uuid === uuid)).toBeUndefined();
    expect(sites).toHaveLength(siteCountBefore);
    await host.close();
  });

  it('clears a position without touching the rest of the site', async () => {
    const opened = await freshLogbook('clear-gps.ssrf');
    // The site must have something other than its position, because
    // `dive_site::is_empty()` (core/divesite.cpp:155) treats a site with no
    // name, description, notes *and* no location as pointless, and
    // save-xml.cpp:661 drops it on the way out. That is why the editor refuses
    // to save a site without a name (validateSiteDraft): a site the app wrote
    // must survive the next save.
    const site = (await opened.host.listDiveSites()).find((s) => s.hasGps && s.name !== '')!;
    const input = buildSiteInput({ ...siteDraftFrom(site), latUdeg: null, lonUdeg: null }, site);
    expect(input).toEqual({ uuid: site.uuid, latUdeg: 0, lonUdeg: 0 });

    await opened.host.upsertDiveSite(input);
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const reloaded = (await host.listDiveSites()).find((s) => s.uuid === site.uuid)!;
    expect(reloaded.hasGps).toBe(false);
    expect(reloaded.name).toBe(site.name);
    expect(reloaded.description).toBe(site.description);
    expect(reloaded.diveCount).toBe(site.diveCount);
    await host.close();
  });

  it('keeps the dives of a deleted site, minus the site', async () => {
    const opened = await freshLogbook('delete-site.ssrf');
    const site = (await opened.host.listDiveSites()).find((s) => s.diveCount > 0)!;
    const diveCountBefore = (await opened.host.listDives()).length;
    const affected = (await opened.host.listDives())
      .filter((d) => d.siteUuid === site.uuid)
      .map((d) => d.number);
    expect(affected.length).toBeGreaterThan(0);

    await opened.host.deleteDiveSite(site.uuid);
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const dives = await host.listDives();
    expect(dives).toHaveLength(diveCountBefore);
    for (const number of affected) {
      const dive = dives.find((d) => d.number === number)!;
      expect(dive.siteUuid).toBe(0);
    }
    await host.close();
  });

  it('reports an unknown dive id instead of taking the process down', async () => {
    // `dive_table::get_by_uniq_id()` (core/divelist.cpp:757-765) calls exit(1)
    // on an unknown id in a DEBUG build, and dive ids are process-local: a
    // screen that outlived a reload of the logbook hands over a stale one as a
    // matter of course. The bindings must answer with an error - if this
    // regresses, the host process dies here and every later call in this file
    // fails with "ssrf-smoke exited".
    const opened = await freshLogbook('stale-id.ssrf');
    await expect(opened.host.getDive(999_999)).rejects.toThrow(/no dive with id/);
    await expect(opened.host.getProfile(999_999)).rejects.toThrow(/no dive with id/);
    await expect(opened.host.updateDive(999_999, { notes: 'x' })).rejects.toThrow(
      /no dive with id/
    );
    // Still alive and still answering.
    expect((await opened.host.listDives()).length).toBeGreaterThan(0);
    await opened.host.close();
  });

  it('rejects an upsert naming a site that does not exist', async () => {
    const opened = await freshLogbook('bad-uuid.ssrf');
    await expect(opened.host.upsertDiveSite({ uuid: 999_999, name: 'Nowhere' })).rejects.toThrow(
      /no dive site with uuid/
    );
    await opened.host.close();
  });
});

describe('repeated edits stay a fixed point', () => {
  it('is byte-stable from the app own output onwards', async () => {
    const opened = await freshLogbook('fixed-point.ssrf');
    const dives = await opened.host.listDives();
    const dive = await opened.host.getDive(dives[0].id);
    await opened.host.updateDive(
      dive.id,
      buildDivePatch(dive, { ...diveDraftFrom(dive), buddy: 'Repeat Buddy' })
    );
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const generation2 = await snapshotLog(host);
    const again = join(workDir, 'fixed-point-2.ssrf');
    await host.saveToXML(again);
    await host.close();

    host = await relaunch(again);
    const generation3 = await snapshotLog(host);
    expect(diffSnapshots(generation2, generation3)).toEqual([]);
    await host.close();
  });
});
