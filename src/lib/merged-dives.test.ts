// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { currentDiveId, reconcileMerges, recordMerge } from './merged-dives';

describe('merged dives', () => {
  it('leaves a dive that was not merged alone', () => {
    expect(currentDiveId(1)).toBe(1);
  });

  it('leads both sources to the merged dive, through merges of merges', () => {
    recordMerge([10, 11], 12);
    expect(currentDiveId(10)).toBe(12);
    expect(currentDiveId(11)).toBe(12);
    recordMerge([12, 13], 14);
    expect(currentDiveId(10)).toBe(14);
    expect(currentDiveId(13)).toBe(14);
  });

  it('follows an undo and a redo of a merge, through merges of merges', () => {
    recordMerge([20, 21], 22);
    recordMerge([22, 23], 24);

    reconcileMerges(new Set([22, 23]));
    expect(currentDiveId(24)).toBe(22);
    expect(currentDiveId(20)).toBe(22);
    expect(currentDiveId(22)).toBe(22);

    reconcileMerges(new Set([20, 21, 23]));
    expect(currentDiveId(24)).toBe(20);
    expect(currentDiveId(22)).toBe(20);
    expect(currentDiveId(21)).toBe(21);

    reconcileMerges(new Set([24]));
    expect(currentDiveId(20)).toBe(24);
    expect(currentDiveId(23)).toBe(24);
  });
});
