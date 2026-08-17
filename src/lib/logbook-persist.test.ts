// AI-generated (Claude)
// The debounce over the logbook file. The native module is mocked: what is
// under test is when a write is attempted, where it goes and how a write that
// cannot happen is reported - not the serialization itself, which the
// module-driven suite in tests/ covers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveToXML = vi.fn<(path: string) => void>();

vi.mock('../../modules/ssrf-core/src', () => ({
  saveToXML: (path: string) => saveToXML(path),
}));

const { flush, schedulePersist, setPersistTarget } = await import('./logbook-persist');

beforeEach(() => {
  saveToXML.mockReset();
  setPersistTarget('/logbook.ssrf');
});

afterEach(async () => {
  // Leave no failure behind for the next test to trip over.
  setPersistTarget('/logbook.ssrf');
  await flush().catch(() => undefined);
});

describe('flush', () => {
  it('writes the logbook the target points at', async () => {
    schedulePersist();
    await flush();
    expect(saveToXML).toHaveBeenCalledExactlyOnceWith('/logbook.ssrf');
  });

  it('writes once for a burst of edits', async () => {
    schedulePersist();
    schedulePersist();
    schedulePersist();
    await flush();
    expect(saveToXML).toHaveBeenCalledTimes(1);
  });

  it('has nothing to do when no edit is waiting', async () => {
    await flush();
    expect(saveToXML).not.toHaveBeenCalled();
  });

  it('reports what the write failed on', async () => {
    saveToXML.mockImplementation(() => {
      throw new Error('disk full');
    });
    schedulePersist();
    await expect(flush()).rejects.toThrow('disk full');
  });

  // The bug this guards: an import into a logbook that was not open yet
  // scheduled a save, the save found no target and returned quietly, and the
  // screen showed "Import complete" for a change that reached no file.
  it('fails rather than silently skipping a change with no logbook open', async () => {
    setPersistTarget(null);
    schedulePersist();
    await expect(flush()).rejects.toThrow(/no logbook is open/i);
    expect(saveToXML).not.toHaveBeenCalled();
  });

  it('reports a failure once', async () => {
    setPersistTarget(null);
    schedulePersist();
    await expect(flush()).rejects.toThrow();

    setPersistTarget('/logbook.ssrf');
    await expect(flush()).resolves.toBeUndefined();
  });
});
