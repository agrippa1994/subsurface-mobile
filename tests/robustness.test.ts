// AI-generated (Claude)
// Robustness (task 12, step 4): malformed input, and a stress session that must
// not corrupt the logbook.
//
// Two things are being defended here. First, that no file a user can hand the
// app - truncated, empty, binary, the wrong format entirely - can take the
// process down or leave the module claiming dives it no longer holds; the app
// turns whatever is thrown into a message (src/models/errors.ts), so what
// matters is that something *is* thrown and the module stays usable afterwards.
// Second, that a long run of edits, imports and saves leaves a file that still
// parses to exactly what the last write meant - the SSRF file is the only copy
// of the user's log, so a half-written one is the worst bug this app has.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildDivePatch, diveDraftFrom } from '../src/models/dive-edit';
import { describeError, formatErrorLine } from '../src/models/errors';
import { fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const SAMPLE = fixture('abitofeverything.ssrf');
const SUUNTO = fixture('TestDiveDM3.SDE');

let workDir: string;

beforeAll(() => {
  workDir = tempDir('ssrf-robust-');
});

/** Writes `content` into the work directory and returns its path. */
function file(name: string, content: string | Buffer): string {
  const path = join(workDir, name);
  writeFileSync(path, content);
  return path;
}

describe('malformed input', () => {
  const host = new SsrfHost();

  beforeAll(async () => {
    await host.configure();
  });

  afterAll(async () => {
    await host.close();
  });

  const cases: { name: string; make: () => string }[] = [
    { name: 'an empty file', make: () => file('empty.ssrf', '') },
    {
      name: 'a logbook cut in half mid-dive',
      make: () => {
        const xml = readFileSync(SAMPLE, 'utf8');
        return file('truncated.ssrf', xml.slice(0, Math.floor(xml.length / 2)));
      },
    },
    {
      name: 'binary noise under a logbook name',
      make: () => file('noise.ssrf', Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256))),
    },
    {
      name: 'well-formed XML that is not a divelog',
      make: () => file('other.xml', "<?xml version='1.0'?>\n<recipes><cake sugar='2'/></recipes>\n"),
    },
    {
      name: 'a logbook whose root tag never closes',
      make: () => file('unclosed.ssrf', "<divelog program='subsurface' version='3'>\n<dives>\n"),
    },
    { name: 'a path that does not exist', make: () => join(workDir, 'nothing-here.ssrf') },
    { name: 'a directory', make: () => workDir },
  ];

  for (const { name, make } of cases) {
    it(`refuses ${name} with a message, not a crash`, async () => {
      const path = make();
      await expect(host.loadFromXML(path)).rejects.toThrow();

      // Still alive and still answering: the next file must load normally.
      const load = await host.loadFromXML(SAMPLE);
      expect(load.dives).toBe(18);
    });
  }

  it('leaves no dives behind when a load fails', async () => {
    await host.loadFromXML(SAMPLE);
    expect(await host.listDives()).toHaveLength(18);

    await expect(host.loadFromXML(file('empty2.ssrf', ''))).rejects.toThrow();
    // A failed load clears the divelog rather than leaving the previous one
    // half-replaced - which is what src/store/log-store.ts documents and why it
    // drops its cache on the way to the error state.
    expect(await host.listDives()).toHaveLength(0);
  });

  it('refuses an import of a file it cannot read, keeping the log intact', async () => {
    await host.loadFromXML(SAMPLE);
    const before = await host.listDives();

    await expect(host.importFile(file('noise2.sde', Buffer.alloc(512, 0xff)))).rejects.toThrow();

    const after = await host.listDives();
    expect(after.map((dive) => dive.number)).toEqual(before.map((dive) => dive.number));
  });

  it('turns a core failure into one line a screen can show', async () => {
    const path = file('for-message.ssrf', 'not a logbook');
    try {
      await host.loadFromXML(path);
      expect.unreachable('the load should have failed');
    } catch (error) {
      const line = formatErrorLine(describeError(error));
      expect(line.length).toBeGreaterThan(0);
      expect(line.split('\n')).toHaveLength(1);
      // No container path in the user's face: only the file name survives.
      expect(line).not.toContain(workDir);
      expect(line).toContain('for-message.ssrf');
    }
  });
});

describe('a stress session of edits, imports and saves', () => {
  const ROUNDS = 12;
  let logbook: string;

  beforeAll(() => {
    logbook = join(workDir, 'stress.ssrf');
  });

  it('never leaves the logbook unreadable or short of dives', async () => {
    const host = new SsrfHost();
    await host.configure();
    await host.loadFromXML(SAMPLE);
    await host.saveToXML(logbook);

    let previousCount = (await host.listDives()).length;

    for (let round = 0; round < ROUNDS; round += 1) {
      const dives = await host.listDives();
      const target = dives[round % dives.length];

      // An edit through the same model functions the editor screens use.
      const dive = await host.getDive(target.id);
      const draft = diveDraftFrom(dive);
      const patch = buildDivePatch(dive, {
        ...draft,
        notes: `${draft.notes}\nround ${round}`,
        rating: (round % 5) + 1,
      });
      await host.updateDive(target.id, patch);

      // A site, created on odd rounds and edited on even ones.
      const uuid = await host.upsertDiveSite({
        name: `Stress site ${round}`,
        description: 'created by the stress session',
        latUdeg: 47_000_000 + round,
        lonUdeg: 8_000_000 + round,
      });
      expect(uuid.uuid).not.toBe(0);

      // Every third round pulls a real import through the same file.
      if (round % 3 === 0) {
        await host.importFile(SUUNTO);
      }

      await host.saveToXML(logbook);

      // The file, as a relaunch would see it.
      const reader = new SsrfHost();
      await reader.configure();
      const load = await reader.loadFromXML(logbook);
      const reloaded = await reader.listDives();
      expect(load.dives).toBe(reloaded.length);
      expect(reloaded.length).toBeGreaterThanOrEqual(previousCount);
      expect(reloaded.some((row) => row.number === undefined)).toBe(false);
      previousCount = reloaded.length;
      await reader.close();
    }

    // The written notes survived every round in between.
    const finalHost = new SsrfHost();
    await finalHost.loadFromXML(logbook);
    const first = await finalHost.getDive((await finalHost.listDives())[0].id);
    expect(first.notes).toContain('round');
    await finalHost.close();
    await host.close();
  });

  it('writes atomically: no temporary files, and a fixed point on re-save', async () => {
    expect(existsSync(logbook)).toBe(true);
    const leftovers = readdirSync(workDir).filter(
      (name) => name.endsWith('.tmp') || name.startsWith('.')
    );
    expect(leftovers).toEqual([]);

    const host = new SsrfHost();
    await host.loadFromXML(logbook);
    const before = readFileSync(logbook);
    await host.saveToXML(logbook);
    // Saving what was just loaded must produce the same bytes; anything else
    // means a save loses or invents something every time the app writes.
    expect(readFileSync(logbook).equals(before)).toBe(true);
    await host.close();
  });

  it('leaves the logbook untouched when the write itself fails', async () => {
    const host = new SsrfHost();
    await host.loadFromXML(logbook);
    const before = readFileSync(logbook);
    const beforeStat = statSync(logbook);

    await expect(host.saveToXML(join(workDir, 'no-such-dir', 'out.ssrf'))).rejects.toThrow();

    expect(readFileSync(logbook).equals(before)).toBe(true);
    expect(statSync(logbook).mtimeMs).toBe(beforeStat.mtimeMs);
    // And the module still holds the log it failed to write.
    expect(await host.listDives()).not.toHaveLength(0);
    await host.close();
  });
});
