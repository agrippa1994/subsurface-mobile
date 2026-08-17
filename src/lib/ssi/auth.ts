// AI-generated (Claude)
// SSI sign-in, and the keychain the credentials and session token live in.
//
// This is the only place in the app that stores a secret. It uses
// expo-secure-store rather than the settings file next to the logbook, because
// that file is exported and shared - a password must not leave the device with
// it.
//
// Why the password is kept at all: SSI issues a token with no refresh
// mechanism and no expiry it tells us about, and the only signal that one has
// gone stale is a request coming back refused. Keeping the credentials lets
// `withToken` sign in again and retry once, so a dive sync does not fail with
// "sign in again" in the middle of a boat trip. Signing out erases both.

import * as SecureStore from 'expo-secure-store';

import { normalizeCredentials, type SsiCredentials } from '@/models/ssi/credentials';
import { ssiGet, SsiApiError } from './api';

const CREDENTIALS_KEY = 'ssi-credentials';
const TOKEN_KEY = 'ssi-token';

/**
 * The keychain item stays readable only while the device is unlocked, and is
 * not written to iCloud or a device backup: a stolen backup should not carry a
 * dive logbook account with it.
 */
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** The successful half of the `authenticate` response. */
type AuthenticatedResponse = {
  authenticated: true;
  token: string;
  authenticated_email?: string;
  imperial?: boolean;
};

export type SsiAccount = {
  email: string;
  /** Whether a session token is on hand. False means the next call signs in. */
  hasToken: boolean;
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    // A keychain item written by an older build, or one the device will not
    // hand over, is treated as absent: the user signs in again.
    return null;
  }
}

export async function readCredentials(): Promise<SsiCredentials | null> {
  const stored = await readJson<Partial<SsiCredentials>>(CREDENTIALS_KEY);
  if (typeof stored?.email !== 'string' || typeof stored?.password !== 'string') {
    return null;
  }
  return { email: stored.email, password: stored.password };
}

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, KEYCHAIN_OPTIONS);
  } catch {
    return null;
  }
}

/** Who the app is signed in as, for the Settings row. */
export async function readAccount(): Promise<SsiAccount | null> {
  const credentials = await readCredentials();
  if (credentials === null) {
    return null;
  }
  return { email: credentials.email, hasToken: (await readToken()) !== null };
}

/** Exchanges credentials for a session token. Does not store anything. */
export async function authenticate(credentials: SsiCredentials): Promise<string> {
  const { email, password } = normalizeCredentials(credentials);
  const response = await ssiGet<AuthenticatedResponse>({
    what: 'authenticate',
    l: email,
    p: password,
  });

  if (typeof response.token !== 'string' || response.token === '') {
    throw new SsiApiError('SSI accepted the sign-in but sent no session token.', false);
  }

  return response.token;
}

/**
 * Signs in and remembers the account. Nothing is written until SSI has accepted
 * the credentials, so a failed attempt cannot leave a wrong password behind for
 * `withToken` to keep retrying with.
 */
export async function signIn(credentials: SsiCredentials): Promise<SsiAccount> {
  const normalized = normalizeCredentials(credentials);
  const token = await authenticate(normalized);

  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(normalized), KEYCHAIN_OPTIONS);
  await SecureStore.setItemAsync(TOKEN_KEY, token, KEYCHAIN_OPTIONS);

  return { email: normalized.email, hasToken: true };
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY, KEYCHAIN_OPTIONS);
  await SecureStore.deleteItemAsync(TOKEN_KEY, KEYCHAIN_OPTIONS);
}

/** Thrown instead of calling SSI when there is no account to call it with. */
export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to SSI in Settings first.');
    this.name = 'NotSignedInError';
  }
}

/**
 * Runs an authenticated call, once with the stored token and, if SSI says that
 * token is no good, once more with a freshly minted one. Only a refusal SSI
 * attributes to authentication is retried - a rejected payload would fail the
 * same way the second time.
 */
export async function withToken<T>(call: (token: string) => Promise<T>): Promise<T> {
  const credentials = await readCredentials();
  if (credentials === null) {
    throw new NotSignedInError();
  }

  const existing = await readToken();
  if (existing !== null) {
    try {
      return await call(existing);
    } catch (caught) {
      if (!(caught instanceof SsiApiError) || !caught.unauthenticated) {
        throw caught;
      }
    }
  }

  const token = await authenticate(credentials);
  await SecureStore.setItemAsync(TOKEN_KEY, token, KEYCHAIN_OPTIONS);
  return call(token);
}
