// AI-generated (Claude)
// Undo and redo through the bindings: every mutation, against the file it should
// take the log back to. The file is the source of truth, so that is the comparison:
// saved before the change and saved after its undo, byte for byte.

import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { DiveSummary, HistoryStepResult, PlanInput } from '../src/models';
import { DIVES_DIR, fixture } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const dir = mkdtempSync(join(tmpdir(), 'ssrf-undo-'));
const LOG = fixture('abitofeverything.ssrf');
const REPO_LOG = join(__dirname, '..', 'subsurface.xml');

describe('undo and redo', () => {
  const host = new SsrfHost();
  let file = 0;

  /** The log as the app would save it. */
  async function saved(): Promise<string> {
    const path = join(dir, `saved-${(file += 1)}.ssrf`);
    await host.saveToXML(path);
    return readFileSync(path, 'utf8');
  }

  /** A change must undo to the file before it and redo to the file after it. */
  async function expectReversible(
    kind: string,
    change: () => Promise<unknown>,
  ): Promise<{ undone: HistoryStepResult; redone: HistoryStepResult }> {
    const before = await saved();
    const depth = (await host.historyState()).undoDepth;
    await change();
    const state = await host.historyState();
    expect(state.undo?.kind).toBe(kind);
    expect(state.undoDepth).toBe(depth + 1);
    const after = await saved();
    expect(after).not.toBe(before);

    const undone = await host.undo();
    expect(undone.entry.kind).toBe(kind);
    expect(undone.idsKept).toBe(true);
    expect(await saved()).toBe(before);

    const redone = await host.redo();
    expect(redone.entry.serial).toBe(undone.entry.serial);
    expect(redone.idsKept).toBe(true);
    expect(await saved()).toBe(after);

    await host.undo();
    return { undone, redone };
  }

  const dives = () => host.listDives();

  beforeAll(async () => {
    await host.configure();
  });

  beforeEach(async () => {
    await host.loadFromXML(LOG);
  });

  afterAll(async () => {
    await host.close();
    expect(host.diagnostics).not.toMatch(/AddressSanitizer/);
  });

  it('starts empty, and says so when asked for what is not there', async () => {
    const state = await host.historyState();
    expect(state).toMatchObject({ canUndo: false, canRedo: false, undo: null, redo: null, lastAction: 'clear' });
    await expect(host.undo()).rejects.toThrow('nothing to undo');
    await expect(host.redo()).rejects.toThrow('nothing to redo');
  });

  it('undoes and redoes an edit, naming the dive', async () => {
    const [dive] = await dives();
    await expectReversible('updateDive', () => host.updateDive(dive.id, { notes: 'edited', rating: 3 }));
    expect((await host.historyState()).redo).toMatchObject({ kind: 'updateDive', diveNumber: dive.number });
  });

  it('undoes and redoes a delete, bringing the dive back under its id', async () => {
    const [first, second] = await dives();
    const { undone } = await expectReversible('deleteDive', () => host.deleteDive(second.id));
    expect(undone.entry.divesBefore - undone.entry.divesAfter).toBe(1);
    expect((await host.getDive(second.id)).id).toBe(second.id);
    expect((await host.getDive(first.id)).id).toBe(first.id);
  });

  it('keeps every id across an undo, and the cached list still matches', async () => {
    const list = await dives();
    await host.updateDive(list[0].id, { notes: 'x' });
    await host.undo();
    expect(await dives()).toEqual(list);
    await host.redo();
    expect((await dives()).map((dive) => dive.id)).toEqual(list.map((dive) => dive.id));
  });

  it('undoes and redoes saving, adding and deleting a site', async () => {
    const { uuid } = await host.upsertDiveSite({ name: 'Test Hole', latUdeg: 1000000, lonUdeg: 2000000 });
    let state = await host.historyState();
    expect(state.undo).toMatchObject({ kind: 'upsertDiveSite', isNew: true, siteName: 'Test Hole' });
    await host.undo();
    expect((await host.listDiveSites()).some((site) => site.name === 'Test Hole')).toBe(false);
    await host.redo();
    expect((await host.listDiveSites()).find((site) => site.uuid === uuid)?.name).toBe('Test Hole');

    await expectReversible('upsertDiveSite', () => host.upsertDiveSite({ uuid, name: 'Other Hole' }));
    state = await host.historyState();
    expect(state.redo).toMatchObject({ isNew: false, siteName: 'Other Hole' });
    await host.redo();

    await expectReversible('deleteDiveSite', () => host.deleteDiveSite(uuid));
    expect((await host.historyState()).redo).toMatchObject({ siteName: 'Other Hole', siteDives: 0 });
  });

  it('gives a deleted site back to its dives', async () => {
    const dive = (await dives()).find((candidate) => candidate.siteUuid !== 0) as DiveSummary;
    const sites = await host.listDiveSites();
    const site = sites.find((candidate) => candidate.uuid === dive.siteUuid);
    await expectReversible('deleteDiveSite', () => host.deleteDiveSite(dive.siteUuid));
    expect((await host.historyState()).redo?.siteDives).toBe(site?.diveCount);
    expect((await host.getDive(dive.id)).siteUuid).toBe(dive.siteUuid);
  });

  it('undoes and redoes the trip operations, keeping trip ids', async () => {
    const [a, b, c] = await dives();
    const tripBefore = a.tripId;
    const trip = await host.createTrip([a.id, b.id], 'Egypt');
    const created = await host.historyState();
    expect(created.undo).toMatchObject({ kind: 'createTrip', diveCount: 2, tripLocation: 'Egypt' });

    await expectReversible('addDivesToTrip', () => host.addDivesToTrip([c.id], trip.id));
    expect((await host.getDive(a.id)).tripId).toBe(trip.id);
    await expectReversible('updateTrip', () => host.updateTrip(trip.id, { location: 'Oman', notes: 'n' }));
    await expectReversible('removeDivesFromTrip', () => host.removeDivesFromTrip([a.id, b.id]));
    expect((await host.listTrips()).find((candidate) => candidate.id === trip.id)?.location).toBe('Egypt');

    await host.undo();
    expect((await host.getDive(a.id)).tripId).toBe(tripBefore);
    expect(await host.listTrips()).not.toContainEqual(expect.objectContaining({ id: trip.id }));
    await host.redo();
    expect((await host.getDive(a.id)).tripId).toBe(trip.id);
  });

  it('undoes and redoes ungrouping', async () => {
    expect((await host.listTrips()).length).toBeGreaterThan(0);
    await expectReversible('ungroupDives', () => host.ungroupDives());
  });

  it('undoes and redoes a merge, with both dives back under their ids', async () => {
    // The sample with one dive moved within reach of the one before.
    const close = join(dir, 'close.ssrf');
    writeFileSync(
      close,
      readFileSync(LOG, 'utf8').replace("date='2011-12-02' time='12:00:00'", "date='2011-12-02' time='11:35:00'"),
    );
    await host.loadFromXML(close);
    const [pair] = await host.listMergePairs();
    expect(pair).toBeDefined();
    const before = await dives();
    const { undone } = await expectReversible('mergeDives', () => host.mergeDives([pair.earlierId, pair.laterId]));
    expect(undone.entry.divesAfter).toBe(before.length - 1);
    expect(await dives()).toEqual(before);
  });

  it('undoes and redoes an import, labelled with its count', async () => {
    await host.loadFromXML(fixture('test10.xml'));
    const count = (await dives()).length;
    const { undone } = await expectReversible('importFile', () => host.importFile(fixture('test25.xml')));
    expect(undone.entry.divesBefore).toBe(count);
    expect(undone.entry.divesAfter).toBeGreaterThan(count);
    expect(await dives()).toHaveLength(count);
  });

  it('undoes and redoes saving a plan', async () => {
    const input: PlanInput = {
      when: 1800000000,
      cylinders: [{ o2Permille: 210, hePermille: 0, sizeMl: 12000, pressureMbar: 200000 }],
      segments: [{ depthMm: 20000, durationSec: 1200, cylinder: 0 }],
    };
    const before = await dives();
    const { undone } = await expectReversible('savePlan', () => host.savePlan(input));
    expect(undone.entry.divesAfter).toBe(before.length + 1);
    expect(await dives()).toEqual(before);
  });

  it('records a change it was never told about, under a general kind', async () => {
    // `historyKind` stands in for a method added later: nothing lists it.
    const [dive] = await dives();
    await host.call('updateDive', { id: dive.id, patch: { notes: 'x' }, historyKind: 'somethingNew' });
    expect((await host.historyState()).undo?.kind).toBe('somethingNew');
  });

  it('leaves no entry for a change that changes nothing, or a call that failed', async () => {
    const [dive] = await dives();
    await host.updateDive(dive.id, { notes: dive.notes });
    await expect(host.deleteDive(99999999)).rejects.toThrow();
    await expect(host.call('noSuchMethod')).rejects.toThrow();
    expect((await host.historyState()).canUndo).toBe(false);
  });

  it('clears redo when something new happens after an undo', async () => {
    const [a, b] = await dives();
    await host.updateDive(a.id, { notes: 'one' });
    await host.updateDive(a.id, { notes: 'two' });
    await host.undo();
    expect((await host.historyState()).canRedo).toBe(true);
    await host.updateDive(b.id, { notes: 'three' });
    const state = await host.historyState();
    expect(state).toMatchObject({ canRedo: false, redo: null, undoDepth: 2 });
    await expect(host.redo()).rejects.toThrow('nothing to redo');
  });

  it('walks a whole chain back and forth', async () => {
    const [a, b] = await dives();
    const states = [await saved()];
    await host.updateDive(a.id, { notes: 'one' });
    states.push(await saved());
    await host.deleteDive(b.id);
    states.push(await saved());
    await host.upsertDiveSite({ name: 'Chain' });
    states.push(await saved());

    await host.undo();
    expect(await saved()).toBe(states[2]);
    await host.undo();
    expect(await saved()).toBe(states[1]);
    await host.undo();
    expect(await saved()).toBe(states[0]);
    await host.redo();
    await host.redo();
    await host.redo();
    expect(await saved()).toBe(states[3]);
  });

  it('caps its depth, dropping the oldest', async () => {
    const [dive] = await dives();
    for (let i = 0; i < 55; i += 1) {
      await host.updateDive(dive.id, { notes: `note ${i}` });
    }
    let state = await host.historyState();
    expect(state.undoDepth).toBe(50);
    for (let i = 0; i < 50; i += 1) {
      await host.undo();
    }
    state = await host.historyState();
    expect(state).toMatchObject({ canUndo: false, redoDepth: 50 });
    // Back at the state after the fifth edit: the first five are gone.
    expect((await host.getDive(dive.id)).notes).toBe('note 4');
  });

  it('forgets on load, on clear and when told, including after a failed load', async () => {
    const [dive] = await dives();
    await host.updateDive(dive.id, { notes: 'x' });
    await host.loadFromXML(LOG);
    expect(await host.historyState()).toMatchObject({ canUndo: false, lastAction: 'clear' });
    await expect(host.undo()).rejects.toThrow('nothing to undo');

    const [again] = await dives();
    await host.updateDive(again.id, { notes: 'x' });
    await host.clearHistory();
    expect(await host.historyState()).toMatchObject({ canUndo: false, canRedo: false });

    await host.updateDive(again.id, { notes: 'y' });
    await expect(host.loadFromXML(join(dir, 'missing.ssrf'))).rejects.toThrow();
    expect((await host.historyState()).canUndo).toBe(false);
  });

  it('holds reads to not changing what is saved', async () => {
    const [dive] = await dives();
    const before = await saved();
    await host.getDive(dive.id);
    await host.getProfile(dive.id);
    await host.getStatistics();
    await host.listTrips();
    await host.listDiveSites();
    await host.listMergePairs();
    await host.exportDiveCSV(dive.id, join(dir, 'x.csv'), { format: 'profile' });
    expect(await saved()).toBe(before);
    expect((await host.historyState()).canUndo).toBe(false);
  });

  it('writes the undone state as the logbook, in a file that loads', async () => {
    const before = await saved();
    const [dive] = await dives();
    await host.deleteDive(dive.id);
    await host.undo();
    const path = join(dir, 'logbook.ssrf');
    await host.saveToXML(path);
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(statSync(`${path}.tmp`, { throwIfNoEntry: false })).toBeUndefined();
    await host.loadFromXML(path);
    expect(await saved()).toBe(before);
  });

  it('gives back the very file, for every logbook in the corpus', async () => {
    const files = readdirSync(DIVES_DIR).filter((name) => /\.(xml|ssrf)$/i.test(name));
    let checked = 0;
    for (const name of files) {
      try {
        await host.loadFromXML(fixture(name));
      } catch {
        continue;
      }
      const list = await dives();
      if (list.length === 0) {
        continue;
      }
      const before = await saved();
      const target = list[Math.floor(list.length / 2)];
      await host.deleteDive(target.id);
      const after = await saved();
      expect((await host.undo()).idsKept, name).toBe(true);
      expect(await saved(), name).toBe(before);
      expect((await dives()).map((dive) => dive.id), name).toEqual(list.map((dive) => dive.id));
      await host.redo();
      expect(await saved(), name).toBe(after);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('shares what states have in common, on a large log', async () => {
    const size = statSync(REPO_LOG).size;
    await host.loadFromXML(REPO_LOG);
    const list = await dives();
    for (let i = 0; i < 50; i += 1) {
      await host.updateDive(list[i].id, { notes: `edit ${i}` });
    }
    const state = await host.historyState();
    expect(state.undoDepth).toBe(50);
    // Fifty full copies would be 340 MB.
    expect(state.bytes).toBeLessThan(size * 2);
    const before = await saved();
    const undone = await host.undo();
    expect(undone.idsKept).toBe(true);
    await host.redo();
    expect(await saved()).toBe(before);
    await host.loadFromXML(LOG);
    expect((await host.historyState()).bytes).toBe(0);
  });
});
