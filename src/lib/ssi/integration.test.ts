// AI-generated (Claude)
// Exercise the real registry client with synthetic network responses and
// in-memory platform storage. Never send credentials or writes to SSI.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';

import { authenticate, readAccount, signIn, signOut } from './auth';
import { fetchSsiLogbook } from './divelog';
import { createSsiClient, ssiData } from './api';
import { downloadSiteIndex, ensureSiteIndex, siteIndexInfo } from './site-cache';

const { secrets, files } = vi.hoisted(() => ({
  secrets: new Map<string, string>(),
  files: new Map<string, string>(),
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key: string) => secrets.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { secrets.set(key, value); },
  deleteItemAsync: async (key: string) => { secrets.delete(key); },
}));

vi.mock('expo-file-system', () => ({
  Paths: { document: '/documents' },
  File: class {
    path: string;
    constructor(root: string, name: string) { this.path = `${root}/${name}`; }
    get exists() { return files.has(this.path); }
    create() { files.set(this.path, ''); }
    write(text: string) { files.set(this.path, text); }
    textSync() { return files.get(this.path); }
    delete() { files.delete(this.path); }
  },
}));

const credentials = { email: 'diver@example.invalid', password: 'test-password' };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  secrets.clear();
  files.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => { vi.unstubAllGlobals(); });

function storedAccount(token = 'old-token') {
  secrets.set('ssi-credentials', JSON.stringify(credentials));
  secrets.set('ssi-token', token);
}

function request(index: number) {
  const [url, init] = fetchMock.mock.calls[index];
  return { url: new URL(String(url)), init };
}

describe('SSI client integration', () => {
  it('signs in, stores the session, and erases it on sign-out', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, token: 'new-token' }));
    expect(await signIn(credentials)).toEqual({ email: credentials.email, hasToken: true });
    expect(secrets.get('ssi-token')).toBe('new-token');
    expect(request(0).url.searchParams.get('what')).toBe('authenticate');
    expect(request(0).url.searchParams.get('l')).toBe(credentials.email);
    expect(request(0).init?.headers).toMatchObject({ 'user-agent': 'Dart/3.12 (dart:io)' });

    await signOut();
    expect(await readAccount()).toBeNull();
    expect(secrets.size).toBe(0);
    await expect(fetchSsiLogbook()).rejects.toThrow('Sign in to SSI');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the existing account when a sign-in is refused with HTTP 200', async () => {
    storedAccount();
    fetchMock.mockResolvedValueOnce(Response.json({
      authenticated: false, error_message: 'Wrong password', authenticated_message: 'not_valid',
    }));
    await expect(signIn(credentials)).rejects.toThrow('Wrong password');
    expect(secrets.get('ssi-token')).toBe('old-token');
  });

  it('rejects login responses without a session token', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true }));
    await expect(authenticate(credentials)).rejects.toThrow('sent no session token');
    expect(secrets.size).toBe(0);
  });

  it('renews an expired token once and preserves buddy history', async () => {
    storedAccount();
    fetchMock
      .mockResolvedValueOnce(Response.json({ authenticated: false }))
      .mockResolvedValueOnce(Response.json({ authenticated: true, token: 'new-token' }))
      .mockResolvedValueOnce(Response.json({
        logbook_details: [{ odin_user_log_nr: 41, odin_user_log_buddy_ids: [7],
          odin_user_log_user_confirmed_id: 0,
          odin_user_log_var_specialdive_id: 123,
          odin_user_log_user_confirmed_name: 0,
          odin_user_log_date: '2026-10-24' }],
        logbook_buddies: [
          { id: 7, firstname: 'Test', favorite: 1, leader_nr: '001234',
            leader_active: 1, city: 'Graz', country: 'AUT' },
          { id: 'bad', firstname: 'Invalid ID' },
        ],
      }));

    const logbook = await fetchSsiLogbook();
    expect(logbook.nextNumber).toBe(42);
    expect(logbook.buddies).toMatchObject([{ id: 7, name: 'Test', dives: 1, favorite: true,
      pro: true, city: 'Graz', country: 'AUT' }]);
    expect(secrets.get('ssi-token')).toBe('new-token');
    expect(request(0).url.searchParams.get('token')).toBe('old-token');
    expect(request(1).url.searchParams.get('what')).toBe('authenticate');
    expect(request(2).url.searchParams.get('token')).toBe('new-token');
  });

  it('stops after the renewed session is refused', async () => {
    storedAccount();
    fetchMock
      .mockResolvedValueOnce(Response.json({ authenticated: false }))
      .mockResolvedValueOnce(Response.json({ authenticated: true, token: 'new-token' }))
      .mockResolvedValueOnce(Response.json({ authenticated: false }));
    await expect(fetchSsiLogbook()).rejects.toThrow('SSI refused');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not reauthenticate or retry after HTTP failures', async () => {
    storedAccount();
    fetchMock.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    await expect(fetchSsiLogbook()).rejects.toMatchObject({ unauthenticated: false, message: 'SSI returned HTTP 503.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes cancellation through and does not retry network failures', async () => {
    storedAccount();
    const controller = new AbortController();
    fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    await expect(fetchSsiLogbook(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request(0).init?.signal).toBe(controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects HTTP 200 authentication failures on uploads', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: false, message: 'Session expired' }));
    await expect(ssiData(createSsiClient('token').save_divelog({ json_data: {} })))
      .rejects.toMatchObject({ message: 'Session expired', unauthenticated: true });
    expect(request(0).init?.method).toBe('POST');
  });
});

describe('SSI site catalogue', () => {
  it('downloads through the library and persists only the reduced catalogue', async () => {
    const archive = zipSync({ 'sites.json': strToU8(JSON.stringify({ divesites: [{
      odin_dive_sites_id: 5, odin_dive_sites_name: 'Reef',
      odin_dive_sites_lat: 12, odin_dive_sites_lon: 34,
    }, {
      // Real catalogue archives can contain invalid names despite the wire type.
      odin_dive_sites_id: 6, odin_dive_sites_name: 12345,
    }] })) });
    fetchMock.mockResolvedValueOnce(new Response(archive));
    const sites = await downloadSiteIndex();
    expect(sites).toEqual([{ id: 5, name: 'Reef', lat: 12, lon: 34, country: '' }]);
    expect(siteIndexInfo().count).toBe(1);
    expect(await ensureSiteIndex()).toEqual(sites);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request(0).url.pathname).toBe('/app/APP_CACHE_SITES.zip');
    expect(request(0).url.searchParams.has('token')).toBe(false);
    expect(files.size).toBe(2);
  });

  it('does not persist a catalogue from an archive without sites', async () => {
    fetchMock.mockResolvedValueOnce(new Response(zipSync({ 'sites.json': strToU8('{"divesites":[]}') })));
    await expect(downloadSiteIndex()).rejects.toThrow('catalogue came back empty');
    expect(files.size).toBe(0);
  });
});
