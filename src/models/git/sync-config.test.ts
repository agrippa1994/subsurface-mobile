// AI-generated (Claude)
import { describe, expect, test } from 'vitest';

import {
  changesHistory,
  DEFAULT_GIT_SYNC_CONFIG,
  parseGitSyncConfig,
  serializeGitSyncConfig,
  trustedHostKey,
  validateRepositorySettings,
} from './sync-config';

const settings = {
  url: 'git@github.com:diver/logbook.git',
  branch: 'main',
  pathInRepo: 'logbook.ssrf',
  authorName: 'Diver',
  authorEmail: 'diver@example.org',
};

describe('parseGitSyncConfig', () => {
  test('round-trips', () => {
    const config = {
      ...DEFAULT_GIT_SYNC_CONFIG,
      ...settings,
      knownHosts: { 'github.com': 'SHA256:abc' },
      lastSyncAt: 123,
    };
    expect(parseGitSyncConfig(serializeGitSyncConfig(config))).toEqual(config);
  });

  test('falls back field by field', () => {
    expect(parseGitSyncConfig('not json')).toEqual(DEFAULT_GIT_SYNC_CONFIG);
    expect(parseGitSyncConfig('{"branch":"","knownHosts":{"a":1,"b":"SHA256:x"}}')).toEqual({
      ...DEFAULT_GIT_SYNC_CONFIG,
      knownHosts: { b: 'SHA256:x' },
    });
  });
});

describe('trustedHostKey', () => {
  test('looks the fingerprint up by the URL host', () => {
    const config = {
      ...DEFAULT_GIT_SYNC_CONFIG,
      ...settings,
      knownHosts: { 'github.com': 'SHA256:abc' },
    };
    expect(trustedHostKey(config)).toBe('SHA256:abc');
    expect(trustedHostKey({ ...config, url: 'ssh://git@github.com:2222/x' })).toBeUndefined();
  });
});

describe('validateRepositorySettings', () => {
  test('accepts sensible settings', () => {
    expect(validateRepositorySettings(settings)).toBeNull();
    expect(
      validateRepositorySettings({ ...settings, pathInRepo: 'dives/logbook.ssrf' }),
    ).toBeNull();
  });

  test.each([
    ['branch', ''],
    ['branch', 'my branch'],
    ['branch', 'a..b'],
    ['branch', 'x.lock'],
    ['pathInRepo', '/abs'],
    ['pathInRepo', '../up'],
    ['pathInRepo', '.git/config'],
    ['authorName', ' '],
    ['authorEmail', 'nobody'],
  ] as const)('rejects %s %j', (field, value) => {
    expect(validateRepositorySettings({ ...settings, [field]: value })?.field).toBe(field);
  });
});

describe('changesHistory', () => {
  test('only the URL and the branch move the history', () => {
    expect(changesHistory(settings, { ...settings, authorName: 'Other' })).toBe(false);
    expect(changesHistory(settings, { ...settings, url: 'git@other:x.git' })).toBe(true);
    expect(changesHistory(settings, { ...settings, branch: 'logbook' })).toBe(true);
  });
});
