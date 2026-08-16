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

import type { Dive } from '../src/models';
import {
  buildCylinderPatches,
  cylinderDraftsFrom,
  newCylinderDraft,
} from '../src/models/cylinder-edit';
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

describe('cylinder edits', () => {
  /** The first dive whose cylinders carry hand-entered start/end pressures. */
  async function diveWithPressures(from: SsrfHost) {
    for (const summary of await from.listDives()) {
      const dive = await from.getDive(summary.id);
      if (dive.cylinders.some((cyl) => cyl.startMbar > 0 && cyl.endMbar > 0) && dive.sac > 0) {
        return dive;
      }
    }
    throw new Error('no dive with manually entered cylinder pressures in the fixture');
  }

  it('recomputes the SAC from a new end pressure and keeps both across a relaunch', async () => {
    const opened = await freshLogbook('edit-cylinders.ssrf');
    const dive = await diveWithPressures(opened.host);
    const index = dive.cylinders.findIndex((cyl) => cyl.startMbar > 0 && cyl.endMbar > 0);

    // Surfacing with more gas left than the log says: less gas used, so the
    // SAC has to come down. That is the whole point of the recomputation - a
    // pressure edit that left `dive::sac` alone would show the old figure.
    const drafts = cylinderDraftsFrom(dive, 'metric');
    const raised = Number(drafts[index].endText) + 30;
    drafts[index] = { ...drafts[index], endText: String(raised) };

    const patches = buildCylinderPatches(dive, drafts, 'metric');
    expect(patches).not.toBeNull();
    expect(patches![index]).toEqual({ sourceIndex: index, endMbar: raised * 1000 });

    const preview = await opened.host.previewDive(dive.id, { cylinders: patches! });
    expect(preview.sac).toBeGreaterThan(0);
    expect(preview.sac).toBeLessThan(dive.sac);

    // A preview is a read: the log still holds the dive as it was.
    const untouched = await opened.host.getDive(dive.id);
    expect(untouched.sac).toBe(dive.sac);
    expect(untouched.cylinders[index].endMbar).toBe(dive.cylinders[index].endMbar);

    const updated = await opened.host.updateDive(dive.id, { cylinders: patches! });
    expect(updated.sac).toBe(preview.sac);
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const reloaded = (await host.listDives()).find((d) => d.number === dive.number)!;
    const full = await host.getDive(reloaded.id);
    expect(full.cylinders[index].endMbar).toBe(raised * 1000);
    // The SAC is derived, so the reload recomputes it - and must land on the
    // same number the editor showed before the save.
    expect(full.sac).toBe(preview.sac);
    await host.close();
  });

  it('refuses to remove a cylinder the dive computer recorded', async () => {
    const opened = await freshLogbook('remove-used-cylinder.ssrf');
    const dive = await diveWithPressures(opened.host);
    const used = dive.cylinders.findIndex((cyl) => cyl.used);
    expect(used).toBeGreaterThanOrEqual(0);

    const drafts = cylinderDraftsFrom(dive, 'metric').filter(
      (_draft, at) => at !== used
    );
    await expect(
      opened.host.updateDive(dive.id, {
        cylinders: buildCylinderPatches(dive, drafts, 'metric')!,
      })
    ).rejects.toThrow(/cannot be removed/);

    // The refusal leaves the dive exactly as it was, cylinders and all.
    const after = await opened.host.getDive(dive.id);
    expect(after.cylinders).toHaveLength(dive.cylinders.length);
    await opened.host.close();
  });

  it('removes the unused cylinders and adds a new one, and both survive a relaunch', async () => {
    const opened = await freshLogbook('add-remove-cylinder.ssrf');

    let target: Dive | null = null;
    for (const summary of await opened.host.listDives()) {
      const dive = await opened.host.getDive(summary.id);
      if (dive.cylinders.filter((cyl) => !cyl.used).length >= 2) {
        target = dive;
        break;
      }
    }
    expect(target).not.toBeNull();
    const dive = target!;
    const keptCount = dive.cylinders.filter((cyl) => cyl.used).length;

    const drafts = [
      ...cylinderDraftsFrom(dive, 'metric').filter((draft) => draft.used),
      {
        ...newCylinderDraft(),
        description: 'Stage 40',
        sizeText: '5.5',
        workingPressureText: '207',
        o2Text: '50',
        startText: '200',
        endText: '90',
      },
    ];

    await opened.host.updateDive(dive.id, {
      cylinders: buildCylinderPatches(dive, drafts, 'metric')!,
    });
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const reloaded = (await host.listDives()).find((d) => d.number === dive.number)!;
    const full = await host.getDive(reloaded.id);
    expect(full.cylinders).toHaveLength(keptCount + 1);

    const added = full.cylinders[keptCount];
    expect(added.description).toBe('Stage 40');
    expect(added.sizeMl).toBe(5500);
    expect(added.workingPressureMbar).toBe(207000);
    expect(added.gasmix.o2Permille).toBe(500);
    expect(added.startMbar).toBe(200000);
    expect(added.endMbar).toBe(90000);

    // The list row carries the descriptions the editor autocompletes from.
    expect(reloaded.cylinderDescriptions).toContain('Stage 40');
    await host.close();
  });

  it('leaves a sampled pressure sampled when the editor only opens the dive', async () => {
    const opened = await freshLogbook('untouched-cylinders.ssrf');

    // A cylinder whose pressures came from the dive computer seeds the editor
    // from `sampleStart`/`sampleEnd`. Round-tripping that draft must not
    // promote those readings into manually entered `start`/`end` values.
    let sampled: Dive | null = null;
    for (const summary of await opened.host.listDives()) {
      const dive = await opened.host.getDive(summary.id);
      if (dive.cylinders.some((cyl) => cyl.startMbar === 0 && cyl.sampleStartMbar > 0)) {
        sampled = dive;
        break;
      }
    }
    expect(sampled).not.toBeNull();
    expect(buildCylinderPatches(sampled!, cylinderDraftsFrom(sampled!, 'metric'), 'metric')).toBeNull();
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
    await expect(opened.host.deleteDive(999_999)).rejects.toThrow(/no dive with id/);
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

describe('dive deletion', () => {
  it('drops the dive and leaves every other one across a relaunch', async () => {
    const opened = await freshLogbook('delete-dive.ssrf');
    const before = await opened.host.listDives();
    const victim = before[1];
    const survivors = before.filter((d) => d.id !== victim.id).map((d) => d.number);

    const result = await opened.host.deleteDive(victim.id);
    expect(result.dives).toBe(before.length - 1);
    await opened.host.saveToXML(opened.path);
    await opened.host.close();

    host = await relaunch(opened.path);
    const after = await host.listDives();
    // Ids are reassigned on load, so identity here is the dive number.
    expect(after.map((d) => d.number)).toEqual(survivors);
    await host.close();
  });

  it('detaches the deleted dive from its site, keeping the site', async () => {
    const opened = await freshLogbook('delete-dive-site-kept.ssrf');
    const dives = await opened.host.listDives();
    const victim = dives.find((d) => d.siteUuid !== 0)!;
    const siteBefore = (await opened.host.listDiveSites()).find((s) => s.uuid === victim.siteUuid)!;

    await opened.host.deleteDive(victim.id);

    const siteAfter = (await opened.host.listDiveSites()).find((s) => s.uuid === siteBefore.uuid);
    expect(siteAfter).toBeDefined();
    expect(siteAfter!.diveCount).toBe(siteBefore.diveCount - 1);
    await opened.host.close();
  });

  it('drops a trip once its last dive is deleted', async () => {
    const opened = await freshLogbook('delete-dive-trip.ssrf');
    const dives = await opened.host.listDives();
    const byLocation = new Map<string, number[]>();
    for (const dive of dives) {
      const location = dive.tripLocation.trim();
      if (location !== '') {
        byLocation.set(location, [...(byLocation.get(location) ?? []), dive.id]);
      }
    }
    const trip = [...byLocation.entries()].find(([, ids]) => ids.length >= 2);
    // The sample carries trips; if it ever stops doing so this test is vacuous,
    // so say that out loud rather than pass by accident.
    expect(trip).toBeDefined();
    const [location, ids] = trip!;

    // After the first delete the trip is still standing - that count is the
    // baseline the last delete has to come in one under.
    const withTrip = (await opened.host.deleteDive(ids[0])).trips;
    let result = { dives: 0, trips: withTrip };
    for (const id of ids.slice(1)) {
      result = await opened.host.deleteDive(id);
    }
    expect(result.trips).toBe(withTrip - 1);

    const left = await opened.host.listDives();
    expect(left.every((d) => d.tripLocation.trim() !== location)).toBe(true);
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
