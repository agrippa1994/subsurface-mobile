// AI-generated (Claude)
// Unit tests for the SSI credentials model. Pure TypeScript: no keychain.
import { describe, expect, it } from 'vitest';

import { normalizeCredentials, validateCredentials } from './credentials';

describe('validateCredentials', () => {
  it('accepts an ordinary account', () => {
    expect(validateCredentials({ email: 'diver@example.com', password: 'hunter2' })).toEqual({
      ok: true,
    });
  });

  it('names the empty field rather than failing anonymously', () => {
    expect(validateCredentials({ email: '', password: 'hunter2' })).toMatchObject({
      ok: false,
      field: 'email',
    });
    expect(validateCredentials({ email: 'diver@example.com', password: '' })).toMatchObject({
      ok: false,
      field: 'password',
    });
  });

  it('rejects an address with no @ or with spaces in it', () => {
    expect(validateCredentials({ email: 'diver', password: 'x' }).ok).toBe(false);
    expect(validateCredentials({ email: '@example.com', password: 'x' }).ok).toBe(false);
    expect(validateCredentials({ email: 'diver@', password: 'x' }).ok).toBe(false);
    expect(validateCredentials({ email: 'di ver@example.com', password: 'x' }).ok).toBe(false);
  });

  it('reports whitespace around the address as empty, not as a bad address', () => {
    expect(validateCredentials({ email: '   ', password: 'x' })).toMatchObject({
      ok: false,
      field: 'email',
    });
  });

  it('accepts a password that is only spaces', () => {
    // Trimming one would produce a sign-in failure with no explanation.
    expect(validateCredentials({ email: 'diver@example.com', password: '   ' }).ok).toBe(true);
  });
});

describe('normalizeCredentials', () => {
  it('trims the address and leaves the password exactly as typed', () => {
    expect(normalizeCredentials({ email: '  diver@example.com ', password: ' pass ' })).toEqual({
      email: 'diver@example.com',
      password: ' pass ',
    });
  });
});
