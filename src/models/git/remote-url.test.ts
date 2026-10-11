// AI-generated (Claude)
import { describe, expect, test } from 'vitest';

import { hostKeyId, parseRemoteUrl, validateRemoteUrl } from './remote-url';

describe('parseRemoteUrl', () => {
  test('scp-like', () => {
    expect(parseRemoteUrl('git@github.com:diver/logbook.git')).toEqual({
      user: 'git',
      host: 'github.com',
      port: null,
      path: 'diver/logbook.git',
    });
    expect(parseRemoteUrl('server:logbook.git')).toEqual({
      user: null,
      host: 'server',
      port: null,
      path: 'logbook.git',
    });
  });

  test('ssh:// with and without a port', () => {
    expect(parseRemoteUrl('ssh://git@example.org:2222/srv/logbook.git')).toEqual({
      user: 'git',
      host: 'example.org',
      port: 2222,
      path: '/srv/logbook.git',
    });
    expect(parseRemoteUrl('ssh://example.org:22/logbook.git')?.port).toBeNull();
    expect(parseRemoteUrl('ssh://git@[::1]:2222/logbook.git')?.host).toBe('::1');
  });

  test('not SSH', () => {
    expect(parseRemoteUrl('https://github.com/diver/logbook.git')).toBeNull();
    expect(parseRemoteUrl('logbook.git')).toBeNull();
    expect(parseRemoteUrl('ssh://host:99999/x')).toBeNull();
  });
});

describe('validateRemoteUrl', () => {
  test('says what is wrong', () => {
    expect(validateRemoteUrl('')).toMatch(/Enter/);
    expect(validateRemoteUrl('https://github.com/a/b.git')).toMatch(/Only SSH/);
    expect(validateRemoteUrl('nonsense')).toMatch(/not an SSH/);
    expect(validateRemoteUrl(' git@github.com:a/b.git ')).toBeNull();
  });
});

describe('hostKeyId', () => {
  test('adds the port the way known_hosts does', () => {
    expect(hostKeyId(parseRemoteUrl('git@github.com:a/b')!)).toBe('github.com');
    expect(hostKeyId(parseRemoteUrl('ssh://git@h:2222/b')!)).toBe('[h]:2222');
  });
});
