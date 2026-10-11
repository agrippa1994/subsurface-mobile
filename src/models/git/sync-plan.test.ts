// AI-generated (Claude)
import { expect, test } from 'vitest';

import { planSync, shortId } from './sync-plan';

test('planSync covers every way the branches can stand', () => {
  expect(planSync('a', null, null)).toEqual({ kind: 'push' });
  expect(planSync('a', 'a', null)).toEqual({ kind: 'up-to-date' });
  expect(planSync('a', 'b', { ahead: 2, behind: 0 })).toEqual({ kind: 'push' });
  expect(planSync('a', 'b', { ahead: 0, behind: 3 })).toEqual({ kind: 'fast-forward' });
  expect(planSync('a', 'b', { ahead: 1, behind: 1 })).toEqual({ kind: 'merge' });
  expect(() => planSync('a', 'b', null)).toThrow();
});

test('shortId', () => {
  expect(shortId('0123456789abcdef')).toBe('0123456');
});
