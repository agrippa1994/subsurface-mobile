// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { mcpStatusLabel } from './status';

describe('mcpStatusLabel', () => {
  it('says whether a running server can be reached', () => {
    expect(mcpStatusLabel({ status: 'running' }, 2)).toBe('Running');
    expect(mcpStatusLabel({ status: 'running' }, 0)).toBe('Running, no network');
  });

  it('tells a failed start from a lost listener', () => {
    expect(mcpStatusLabel({ status: 'off', error: null }, 0)).toBe('Off');
    expect(mcpStatusLabel({ status: 'off', error: 'Address in use' }, 0)).toBe(
      'Could not start: Address in use',
    );
    expect(mcpStatusLabel({ status: 'interrupted', error: 'Network down' }, 0)).toBe(
      'Interrupted: Network down',
    );
    expect(mcpStatusLabel({ status: 'starting' }, 0)).toBe('Starting...');
  });
});
