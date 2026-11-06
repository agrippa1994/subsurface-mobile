// AI-generated (Claude)
// The steps around an undo. The module is mocked: tests/undo-redo.test.ts covers what
// it does to the log, and this that the app then re-reads and writes the file.

import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HistoryState } from '@/models';

const native = vi.hoisted(() => ({
  saveToXML: vi.fn<(path: string) => void>(),
  undo: vi.fn(),
  redo: vi.fn(),
  listDives: vi.fn(() => [{ id: 1 }, { id: 2 }]),
  listener: null as null | ((state: unknown) => void),
}));

vi.mock('../../modules/ssrf-core/src', () => ({
  saveToXML: native.saveToXML,
  undo: native.undo,
  redo: native.redo,
  listDives: native.listDives,
  subscribeHistory: (listener: (state: unknown) => void) => {
    native.listener = listener;
    return () => undefined;
  },
}));

const {
  holdingHistory,
  lastRestoreRevision,
  logbookHistory,
  rememberScreenOfLastChange,
  screenToReopen,
  stepHistory,
  subscribeLogbookHistory,
} = await import('./logbook-history');
const { setPersistTarget } = await import('./logbook-persist');
const { currentDiveId, recordMerge } = await import('./merged-dives');

const entry = { kind: 'deleteDive', serial: 5, divesBefore: 2, divesAfter: 1, tripsBefore: 0, tripsAfter: 0 };

function report(fields: Partial<HistoryState>): void {
  native.listener?.({
    canUndo: true,
    canRedo: false,
    undo: entry,
    redo: null,
    undoDepth: 1,
    redoDepth: 0,
    bytes: 1,
    revision: 1,
    lastAction: 'change',
    ...fields,
  });
}

beforeEach(() => {
  native.saveToXML.mockReset();
  native.undo.mockReset().mockReturnValue({ entry, idsKept: true, state: {} });
  native.redo.mockReset().mockReturnValue({ entry, idsKept: true, state: {} });
  setPersistTarget('/logbook.ssrf');
});

describe('stepHistory', () => {
  it('writes the file before it is done, as any mutation does', async () => {
    await expect(stepHistory(new QueryClient(), 'undo')).resolves.toBe(entry);
    expect(native.undo).toHaveBeenCalledOnce();
    expect(native.saveToXML).toHaveBeenCalledExactlyOnceWith('/logbook.ssrf');

    await stepHistory(new QueryClient(), 'redo');
    expect(native.redo).toHaveBeenCalledOnce();
    expect(native.saveToXML).toHaveBeenCalledTimes(2);
  });

  it('re-reads what is on screen, keeping it while ids hold', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const reset = vi.spyOn(client, 'resetQueries');
    await stepHistory(client, 'undo');
    expect(invalidate).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();

    native.undo.mockReturnValue({ entry, idsKept: false, state: {} });
    await stepHistory(client, 'undo');
    expect(reset).toHaveBeenCalledOnce();
  });

  it('writes nothing if the module refused', async () => {
    native.undo.mockImplementation(() => {
      throw new Error('there is nothing to undo');
    });
    await expect(stepHistory(new QueryClient(), 'undo')).rejects.toThrow('nothing to undo');
    expect(native.saveToXML).not.toHaveBeenCalled();
  });

  it('forgets an answer nobody is watching, such as a dive that was gone', async () => {
    const client = new QueryClient();
    client.setQueryData(['log', 'data', 'dive', 7], { id: 7 });
    await stepHistory(client, 'undo');
    expect(client.getQueryData(['log', 'data', 'dive', 7])).toBeUndefined();
  });

  it('refuses while a sync is running, and takes it again afterwards', async () => {
    let finish = () => undefined as void;
    const sync = holdingHistory(() => new Promise<void>((resolve) => (finish = resolve)));
    await expect(stepHistory(new QueryClient(), 'undo')).rejects.toThrow('sync is running');
    expect(native.undo).not.toHaveBeenCalled();
    expect(native.saveToXML).not.toHaveBeenCalled();
    finish();
    await sync;
    await expect(stepHistory(new QueryClient(), 'undo')).resolves.toBe(entry);
  });

  it('sends a screen on a merged dive back to the dives that came back', async () => {
    recordMerge([1, 2], 3);
    expect(currentDiveId(1)).toBe(3);
    await stepHistory(new QueryClient(), 'undo');
    expect(currentDiveId(1)).toBe(1);
    expect(currentDiveId(3)).toBe(1);
  });
});

describe('the state the screens read', () => {
  it('follows what the module reports, and tells a restore from a change', () => {
    const seen: HistoryState[] = [];
    const unsubscribe = subscribeLogbookHistory((state) => seen.push(state));
    report({ revision: 11 });
    expect(logbookHistory().revision).toBe(11);
    const before = lastRestoreRevision();
    report({ revision: 12, lastAction: 'undo' });
    expect(lastRestoreRevision()).toBe(12);
    expect(before).not.toBe(12);
    report({ revision: 13 });
    expect(lastRestoreRevision()).toBe(12);
    unsubscribe();
    report({ revision: 14 });
    expect(seen).toHaveLength(3);
  });

  it('remembers the screen a change closed', () => {
    report({ undo: { ...entry, serial: 9 } });
    rememberScreenOfLastChange('/dives/4');
    expect(screenToReopen({ ...entry, serial: 9 })).toBe('/dives/4');
    expect(screenToReopen({ ...entry, serial: 10 })).toBeUndefined();
  });
});
