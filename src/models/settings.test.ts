// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from './settings';

describe('parseSettings', () => {
  it('reads a stored unit system', () => {
    expect(parseSettings('{"unitSystem":"imperial"}').unitSystem).toBe('imperial');
  });

  it('falls back to the default for junk, nulls and unknown values', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"unitSystem":"furlongs"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{}')).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips', () => {
    const settings = { unitSystem: 'imperial' as const };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });
});
