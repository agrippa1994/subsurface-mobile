// AI-generated (Claude)
import { describe, expect, test } from 'vitest';

import {
  describeHead,
  describeServerState,
  describeSyncError,
  describeSyncResult,
} from './presentation';

const result = { logbookChanged: false, pushed: false, unpushed: false, head: 'abc' };

describe('describeSyncResult', () => {
  test('one line per outcome', () => {
    expect(describeSyncResult({ ...result, outcome: 'up-to-date' })).toMatch(/up to date/);
    expect(describeSyncResult({ ...result, outcome: 'sent', pushed: true })).toMatch(/pushed/);
    expect(describeSyncResult({ ...result, outcome: 'sent', unpushed: true })).toMatch(/next push/);
    expect(describeSyncResult({ ...result, outcome: 'received', logbookChanged: true })).toMatch(
      /changes from the server/,
    );
    expect(describeSyncResult({ ...result, outcome: 'merged', pushed: true })).toMatch(
      /merged.*pushed/,
    );
  });
});

describe('describeSyncError', () => {
  test('explains the actionable codes, passes the rest through', () => {
    expect(describeSyncError({ code: 'auth-failed', message: 'x' }).title).toMatch(
      /refused the key/,
    );
    expect(describeSyncError({ code: 'push-rejected', message: 'x' }).title).toMatch(
      /refused the push/,
    );
    expect(describeSyncError({ message: 'boom' })).toEqual({
      title: 'Sync failed',
      message: 'boom',
    });
    expect(
      describeSyncError({
        code: 'failed',
        message:
          'Fetch failed: failed to authenticate SSH session: Unable to extract public key from private key file: Unsupported private key file format',
      }).message,
    ).toMatch(/passphrase/);
  });
});

test('describeHead', () => {
  expect(describeHead(null, String)).toBe('No commits yet');
  expect(describeHead({ id: '0123456789', time: 0 }, (d) => d.toISOString().slice(0, 10))).toBe(
    '0123456, 1970-01-01',
  );
});

test('describeServerState', () => {
  expect(describeServerState({ ahead: 0, behind: 0, neverPushed: true })).toBe('Not pushed yet');
  expect(describeServerState({ ahead: 0, behind: 0, neverPushed: false })).toBe('In sync');
  expect(describeServerState({ ahead: 2, behind: 1, neverPushed: false })).toBe(
    '2 to push, 1 to pull',
  );
});
