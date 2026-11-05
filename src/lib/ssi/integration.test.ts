// AI-generated (Claude)
// Exercise the real registry client with synthetic network responses and
// in-memory platform storage. Never send credentials or writes to SSI.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';

import { authenticate, readAccount, signIn, signOut } from './auth';
import { fetchSsiLogbook } from './divelog';
import { createSsiClient, ssiData } from './api';
import { fetchSsiSiteLookups } from './site-detail';
import { downloadSiteIndex, ensureSiteIndex, refreshSiteIndex, siteIndexInfo } from './site-cache';

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
  const zipRow = { odin_dive_sites_id: 5, odin_dive_sites_name: 'Reef', odin_dive_sites_lat: 12, odin_dive_sites_lon: 34 };
  const zip = (rows: unknown[] = [zipRow], header: object = { created: '2026-11-05 10:39:59' }) =>
    new Response(zipSync({ 'sites.json': strToU8(JSON.stringify({ ...header, divesites: rows })) }));
  const page = (rows: unknown[]) =>
    new Response(JSON.stringify({ divesites: rows }), { headers: { 'content-type': 'application/json' } });
  const reef = { id: 5, name: 'Reef', lat: 12, lon: 34, country: '' };
  const wall = { id: 7, name: 'Wall', lat: 0, lon: 0, country: '' };

  /** The ZIP, then a one-page walk that finds `Wall`, then an empty delta. */
  function mockFullDownload() {
    fetchMock
      .mockResolvedValueOnce(zip())
      .mockResolvedValueOnce(page([{ odin_dive_sites_id: 7, odin_dive_sites_name: 'Wall', odin_dive_sites_deleted: 0 }]))
      .mockResolvedValueOnce(page([{ odin_dive_sites_id: 3, odin_dive_sites_deleted: 1 }]))
      .mockResolvedValueOnce(page([]));
  }

  function storeOldInstall(sites: unknown[]) {
    files.set('/documents/ssi-sites-index.json', JSON.stringify(sites));
    files.set('/documents/ssi-sites-info.json', JSON.stringify({ count: sites.length, downloadedAt: 1 }));
  }

  it('merges the ZIP and the site list, persisting only the reduced catalogue', async () => {
    mockFullDownload();
    const sites = await downloadSiteIndex();
    expect(sites).toEqual([reef, wall]);
    expect(siteIndexInfo()).toMatchObject({ count: 2, complete: true });
    expect(files.size).toBe(2);

    expect(request(0).url.pathname).toBe('/app/APP_CACHE_SITES.zip');
    expect(request(0).url.searchParams.has('token')).toBe(false);
    expect(request(1).url.searchParams.has('token')).toBe(false);

    expect(await ensureSiteIndex()).toEqual(sites);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('sees numeric names and deletion markers from the site list unfiltered', async () => {
    fetchMock
      .mockResolvedValueOnce(zip([zipRow, { odin_dive_sites_id: 6, odin_dive_sites_name: 12345 }], {}))
      .mockResolvedValueOnce(page([
        { odin_dive_sites_id: 8, odin_dive_sites_name: 42, odin_dive_sites_deleted: '' },
        { odin_dive_sites_id: 5, odin_dive_sites_deleted: 1 },
      ]))
      .mockResolvedValueOnce(page([{ odin_dive_sites_id: 9, odin_dive_sites_deleted: 1 }]));
    expect((await downloadSiteIndex()).map((site) => [site.id, site.name])).toEqual([
      [6, '12345'],
      [8, '42'],
    ]);
  });

  it('does not persist a catalogue from an archive without sites', async () => {
    fetchMock.mockResolvedValueOnce(zip([]));
    await expect(downloadSiteIndex()).rejects.toThrow('catalogue came back empty');
    expect(files.size).toBe(0);
  });

  it('keeps the ZIP alone when a first top-up fails, and marks it incomplete', async () => {
    fetchMock.mockResolvedValueOnce(zip()).mockRejectedValueOnce(new Error('offline'));
    expect(await downloadSiteIndex()).toEqual([reef]);
    expect(siteIndexInfo()).toMatchObject({ count: 1, complete: false });
  });

  it('does not call a walk complete when it falls well short of the announced total', async () => {
    fetchMock
      .mockResolvedValueOnce(zip([zipRow], { divesites_total: 1000 }))
      .mockResolvedValueOnce(page([{ odin_dive_sites_id: 3, odin_dive_sites_deleted: 1 }]));
    expect(await downloadSiteIndex()).toEqual([reef]);
    expect(siteIndexInfo()).toMatchObject({ count: 1, complete: false });
  });

  it('leaves a stored catalogue alone when a refresh fails', async () => {
    mockFullDownload();
    const before = await downloadSiteIndex();

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(zip()).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(refreshSiteIndex()).rejects.toThrow('HTTP 500');
    expect(await ensureSiteIndex()).toEqual(before);
    expect(siteIndexInfo()).toMatchObject({ count: 2, complete: true });

    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(refreshSiteIndex()).rejects.toThrow('offline');
    expect(await ensureSiteIndex()).toEqual(before);
  });

  it('upgrades an existing install in the background, returning the stored sites first', async () => {
    storeOldInstall([reef]);
    mockFullDownload();
    const upgraded = new Promise((resolve) => {
      void ensureSiteIndex(resolve).then((stored) => expect(stored).toEqual([reef]));
    });
    expect(await upgraded).toEqual([reef, wall]);
    expect(siteIndexInfo()).toMatchObject({ count: 2, complete: true });
  });

  it('keeps serving an existing install when its upgrade fails, without surfacing the error', async () => {
    storeOldInstall([reef]);
    fetchMock.mockRejectedValue(new Error('offline'));
    const onUpgraded = vi.fn();
    expect(await ensureSiteIndex(onUpgraded)).toEqual([reef]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve));
    expect(onUpgraded).not.toHaveBeenCalled();
    expect(await ensureSiteIndex()).toEqual([reef]);
    expect(siteIndexInfo()).toMatchObject({ count: 1, complete: false });
  });

  it('removes placeholder positions after judging completeness against the total', async () => {
    const stacked = [1, 2, 3, 4, 5].map((id) => ({
      odin_dive_sites_id: 100 + id, odin_dive_sites_name: `Stacked ${id}`,
      odin_dive_sites_lat: 51.2025, odin_dive_sites_lon: 10.3822,
    }));
    fetchMock
      .mockResolvedValueOnce(zip([zipRow], { divesites_total: 6 }))
      .mockResolvedValueOnce(page(stacked))
      .mockResolvedValueOnce(page([{ odin_dive_sites_id: 3, odin_dive_sites_deleted: 1 }]));
    expect(await downloadSiteIndex()).toEqual([reef]);
    expect(siteIndexInfo()).toMatchObject({ count: 1, complete: true });
  });

  it('rebuilds a complete index that older rules produced', async () => {
    storeOldInstall([reef]);
    files.set('/documents/ssi-sites-info.json', JSON.stringify({ count: 1, downloadedAt: 1, complete: true }));
    expect(siteIndexInfo().complete).toBe(false);
    mockFullDownload();
    const upgraded = new Promise((resolve) => { void ensureSiteIndex(resolve); });
    expect(await upgraded).toEqual([reef, wall]);
    expect(siteIndexInfo().complete).toBe(true);
    fetchMock.mockClear();
    await ensureSiteIndex();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares one download between concurrent callers', async () => {
    mockFullDownload();
    const [first, second] = await Promise.all([downloadSiteIndex(), downloadSiteIndex()]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// Public details must work without an SSI account, and server refusals must
// remain recoverable errors rather than a successful empty panel.
describe('SSI site details', () => {
  it('reads the public site-detail array and forwards cancellation', async () => {
    const { fetchSsiSiteDetail } = await import('./site-detail');
    fetchMock.mockResolvedValueOnce(
      Response.json([{ dive_site_id: 6179, dive_site_name: 'Blue Holes', images: [], descr: [] }]),
    );
    const controller = new AbortController();
    expect((await fetchSsiSiteDetail(6179, controller.signal))?.dive_site_name).toBe('Blue Holes');
    expect(request(0).url.searchParams.get('what')).toBe('get_divesite_details');
    expect(request(0).url.searchParams.get('site_id')).toBe('6179');
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
  it('surfaces deleted/merged sites and permits a subsequent retry', async () => {
    const { fetchSsiSiteDetail } = await import('./site-detail');
    fetchMock.mockResolvedValueOnce(Response.json({ error: { error: 'SITE DELETED!' } }));
    await expect(fetchSsiSiteDetail(1)).rejects.toThrow('SITE DELETED!');
    fetchMock.mockResolvedValueOnce(
      Response.json([{ dive_site_id: 1, dive_site_name: 'Restored' }]),
    );
    expect((await fetchSsiSiteDetail(1))?.dive_site_name).toBe('Restored');
  });
});

describe('SSI site lookups', () => {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  const answers: Record<string, () => Response> = {
    get_divelog_vars: () => json({ logbook_vars: { current: { '6': 'no_current' } } }),
    get_wildlife_vars: () => json({ wildlife: { animal: [{ id: 22, title_key: 'pike' }] } }),
    get_translations: () => json({ eng: { no_current: 'No Current', pike: 'Pike' } }),
  };
  const answer = async (url: unknown) => {
    const action = new URL(String(url)).searchParams.get('what') ?? '';
    return answers[action]?.() ?? new Response('[]', { status: 404 });
  };

  it('asks for each table with the app identity and without a token', async () => {
    fetchMock.mockImplementation(answer);
    const lookups = await fetchSsiSiteLookups();
    expect(lookups.current.get(6)).toBe('No Current');
    expect(lookups.wildlife.get(22)?.name).toBe('Pike');

    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams);
    expect(urls.map((query) => query.get('what')).sort()).toEqual(Object.keys(answers).sort());
    expect(urls.every((query) => query.get('ssiapp') !== null && !query.has('token'))).toBe(true);
  });

  it('keeps what it got when one table fails', async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('get_translations') ? new Response('[]', { status: 500 }) : answer(url)
    );
    const lookups = await fetchSsiSiteLookups();
    expect(lookups.current.get(6)).toBe('No current');
    expect(lookups.wildlife.get(22)?.name).toBe('Pike');
  });

  it('fails when every table fails', async () => {
    fetchMock.mockImplementation(async () => new Response('[]', { status: 500 }));
    await expect(fetchSsiSiteLookups()).rejects.toThrow('no lookup tables');
  });
});
