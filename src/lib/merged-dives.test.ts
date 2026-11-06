// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { currentDiveId, recordMerge } from './merged-dives';

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
});
