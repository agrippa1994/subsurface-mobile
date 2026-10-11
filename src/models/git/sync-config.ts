// AI-generated (Claude)
// Git sync settings and their (de)serialization.
//
// Kept in a JSON file of its own next to the logbook (src/lib/git-sync-store.ts).
// Nothing here is secret - the private key is in the keychain - but it is also
// not a preference anyone wants exported with the settings.

import { hostKeyId, parseRemoteUrl } from './remote-url';

export type GitSyncConfig = {
  /** SSH URL of the repository; empty while sync is not set up. */
  url: string;
  branch: string;
  /** Where in the repository the logbook is kept. */
  pathInRepo: string;
  authorName: string;
  authorEmail: string;
  /** Trusted host key fingerprints ("SHA256:..."), by `hostKeyId`. */
  knownHosts: Record<string, string>;
  /** When the last sync finished without an error, ms since the epoch. */
  lastSyncAt: number | null;
};

export const DEFAULT_GIT_SYNC_CONFIG: GitSyncConfig = {
  url: '',
  branch: 'main',
  pathInRepo: 'logbook.ssrf',
  authorName: 'Subsurface Mobile',
  authorEmail: 'subsurface-mobile@localhost',
  knownHosts: {},
  lastSyncAt: null,
};

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export function parseGitSyncConfig(text: string): GitSyncConfig {
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    raw = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return DEFAULT_GIT_SYNC_CONFIG;
  }
  const knownHosts: Record<string, string> = {};
  if (typeof raw.knownHosts === 'object' && raw.knownHosts !== null) {
    for (const [host, fingerprint] of Object.entries(raw.knownHosts)) {
      if (typeof fingerprint === 'string') {
        knownHosts[host] = fingerprint;
      }
    }
  }
  const d = DEFAULT_GIT_SYNC_CONFIG;
  return {
    url: typeof raw.url === 'string' ? raw.url : d.url,
    branch: stringOr(raw.branch, d.branch),
    pathInRepo: stringOr(raw.pathInRepo, d.pathInRepo),
    authorName: stringOr(raw.authorName, d.authorName),
    authorEmail: stringOr(raw.authorEmail, d.authorEmail),
    knownHosts,
    lastSyncAt: typeof raw.lastSyncAt === 'number' ? raw.lastSyncAt : null,
  };
}

export function serializeGitSyncConfig(config: GitSyncConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** The fingerprint trusted for the URL's server, if any. */
export function trustedHostKey(config: GitSyncConfig): string | undefined {
  const url = parseRemoteUrl(config.url);
  return url === null ? undefined : config.knownHosts[hostKeyId(url)];
}

export type RepositorySettings = Pick<
  GitSyncConfig,
  'url' | 'branch' | 'pathInRepo' | 'authorName' | 'authorEmail'
>;

/**
 * Why the repository settings cannot be saved, by field, or null if they can.
 * Branch names follow the subset of git's rules a person is likely to break.
 */
export function validateRepositorySettings(
  settings: RepositorySettings,
): { field: keyof RepositorySettings; message: string } | null {
  const branch = settings.branch.trim();
  if (branch === '' || /[\s~^:?*[\\]|\.\.|^\/|\/$|\.lock$|^-/.test(branch)) {
    return { field: 'branch', message: 'Not a valid branch name.' };
  }
  const path = settings.pathInRepo.trim();
  if (
    path === '' ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.split('/').some((p) => p === '..' || p === '.git')
  ) {
    return { field: 'pathInRepo', message: 'A relative file path, such as logbook.ssrf.' };
  }
  if (settings.authorName.trim() === '') {
    return { field: 'authorName', message: 'Commits need an author name.' };
  }
  if (!/^[^\s<>@]+@[^\s<>@]+$/.test(settings.authorEmail.trim())) {
    return { field: 'authorEmail', message: 'Commits need an email address.' };
  }
  return null;
}

/**
 * Whether changing from `before` to `after` points the sync at different
 * history, which means the local repository has to start over: its commits
 * belong to the old remote.
 */
export function changesHistory(before: RepositorySettings, after: RepositorySettings): boolean {
  return before.url.trim() !== after.url.trim() || before.branch.trim() !== after.branch.trim();
}
