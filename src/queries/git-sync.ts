// AI-generated (Claude)
// The git sync as the screens see it.
//
// Like the SSI queries, these talk to the network and to the keychain, so they
// set their own policy rather than inheriting the client defaults that suit the
// synchronous native core. Everything lives under the ['git'] root.
//
// Syncs share one mutation scope, so a second tap while one is running queues
// behind it instead of racing it on the repository.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';

import { importFile, listDives, listDiveSites, loadFromXML } from '../../modules/ssrf-core/src';
import {
  aheadBehind,
  commitFile,
  describeCommit,
  extractFile,
  fetchBranch,
  generateKeyPair,
  heads,
  pushBranch,
  resetRepository,
  setBranch,
  type CommitInfo,
  type Remote,
} from '../../modules/git-sync/src';
import { toNativePath } from '@/lib/logbook-file';
import { flush, schedulePersist } from '@/lib/logbook-persist';
import { queryKeys } from '@/lib/query-keys';
import {
  deleteKey,
  readConfig,
  readKey,
  updateConfig,
  writeKey,
  type StoredKey,
} from '@/lib/git/store';
import { runSync, type SyncDeps, type SyncMode, type SyncResult } from '@/lib/git/sync';
import { decodeBase64 } from '@/models/git/base64';
import { hostKeyId, parseRemoteUrl } from '@/models/git/remote-url';
import { describePrivateKey, encodeEd25519Key } from '@/models/git/ssh-key';
import {
  changesHistory,
  trustedHostKey,
  type GitSyncConfig,
  type RepositorySettings,
} from '@/models/git/sync-config';
import { ensureLogbookLoaded } from '@/queries/logbook';
import { adoptLogbook, resetData } from '@/queries/logbook-mutations';

// --- Settings --------------------------------------------------------------

export function useGitSyncConfig(): GitSyncConfig {
  const { data } = useQuery({
    queryKey: queryKeys.gitConfig(),
    queryFn: readConfig,
    initialData: readConfig,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

function storeConfig(client: QueryClient, change: (config: GitSyncConfig) => GitSyncConfig): void {
  client.setQueryData(queryKeys.gitConfig(), updateConfig(change));
}

/**
 * Saves the repository settings. Pointing the sync at another repository or
 * branch starts the local history over: the commits here belong to the old one,
 * and pushing them somewhere new would publish an unrelated history.
 */
export function useSaveRepositorySettings(): UseMutationResult<void, Error, RepositorySettings> {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'git-sync' },
    mutationFn: async (settings: RepositorySettings) => {
      const trimmed: RepositorySettings = {
        url: settings.url.trim(),
        branch: settings.branch.trim(),
        pathInRepo: settings.pathInRepo.trim(),
        authorName: settings.authorName.trim(),
        authorEmail: settings.authorEmail.trim(),
      };
      if (changesHistory(readConfig(), trimmed)) {
        await resetRepository();
      }
      storeConfig(client, (config) => ({
        ...config,
        ...trimmed,
        lastSyncAt: changesHistory(config, trimmed) ? null : config.lastSyncAt,
      }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gitStatus() }),
  });
}

/** Remembers the server's host key for the configured URL. */
export function useTrustHostKey(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (fingerprint: string) => {
      const url = parseRemoteUrl(readConfig().url);
      if (url === null) {
        throw new Error('Set the repository URL first.');
      }
      storeConfig(client, (config) => ({
        ...config,
        knownHosts: { ...config.knownHosts, [hostKeyId(url)]: fingerprint },
      }));
    },
  });
}

export function useForgetHostKey(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (host: string) => {
      storeConfig(client, (config) => {
        const knownHosts = { ...config.knownHosts };
        delete knownHosts[host];
        return { ...config, knownHosts };
      });
    },
  });
}

/**
 * Turns sync off: the repository URL is cleared and the local history removed.
 * The logbook, the key and the trusted host keys stay.
 */
export function useDisconnectSync(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'git-sync' },
    mutationFn: async () => {
      await resetRepository();
      storeConfig(client, (config) => ({ ...config, url: '', lastSyncAt: null }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gitStatus() }),
  });
}

// --- Key -------------------------------------------------------------------

/** What the screen shows of the key; the private half never enters the cache. */
export type KeySummary = {
  publicKey: string | null;
  origin: StoredKey['origin'];
  hasPassphrase: boolean;
};

export function useGitKey(): UseQueryResult<KeySummary | null> {
  return useQuery({
    queryKey: queryKeys.gitKey(),
    queryFn: async (): Promise<KeySummary | null> => {
      const key = await readKey();
      return key === null
        ? null
        : {
            publicKey: key.publicKey,
            origin: key.origin,
            hasPassphrase: key.passphrase !== undefined,
          };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

function keyComment(): string {
  const device = (Device.deviceName ?? 'device').replace(/\s+/g, '-');
  return `subsurface-mobile@${device}`;
}

/** Generates an Ed25519 key, replacing any key stored before. */
export function useGenerateKey(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const raw = await generateKeyPair();
      const pair = encodeEd25519Key(
        decodeBase64(raw.seed),
        decodeBase64(raw.publicKey),
        raw.checkInt,
        keyComment(),
      );
      await writeKey({
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        origin: 'generated',
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gitKey() }),
  });
}

export type ImportKeyInput = { text: string; passphrase?: string };

/**
 * Stores a private key the user picked. It is checked for being a private key at
 * all; whether the passphrase is right only shows on the first connection,
 * since libssh2 is what decrypts it.
 */
export function useImportKey(): UseMutationResult<void, Error, ImportKeyInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, passphrase }: ImportKeyInput) => {
      const info = describePrivateKey(text);
      if (info.encrypted && !passphrase) {
        throw new Error('This key is protected by a passphrase.');
      }
      await writeKey({
        privateKey: `${text.trim()}\n`,
        publicKey: info.publicKey,
        passphrase: info.encrypted ? passphrase : undefined,
        origin: 'imported',
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gitKey() }),
  });
}

export function useDeleteKey(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deleteKey(),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gitKey() }),
  });
}

// --- Status ----------------------------------------------------------------

export type GitStatus = {
  /** The newest commit here, if there is one. */
  head: CommitInfo | null;
  /** Commits here the server did not have at the last fetch or push. */
  ahead: number;
  /** Commits on the server, as of the last fetch, not yet brought in. */
  behind: number;
  /** True while nothing has reached the server yet. */
  neverPushed: boolean;
};

/** Where the branches stood at the last sync. Reads the repository only. */
export function useGitStatus(enabled: boolean): UseQueryResult<GitStatus> {
  const { branch } = useGitSyncConfig();
  return useQuery({
    queryKey: [...queryKeys.gitStatus(), branch],
    queryFn: async (): Promise<GitStatus> => {
      const { local, remote } = await heads(branch);
      if (local === null) {
        return { head: null, ahead: 0, behind: 0, neverPushed: true };
      }
      const head = await describeCommit(local);
      if (remote === null) {
        return { head, ahead: 0, behind: 0, neverPushed: true };
      }
      return { head, ...(await aheadBehind(local, remote)), neverPushed: false };
    },
    enabled,
    staleTime: 0,
  });
}

// --- Sync ------------------------------------------------------------------

/** Thrown before anything happens when sync is not set up far enough to run. */
export class SyncNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncNotReadyError';
  }
}

async function remoteFor(config: GitSyncConfig): Promise<Remote> {
  if (config.url === '') {
    throw new SyncNotReadyError('Set up the repository first.');
  }
  const key = await readKey();
  if (key === null) {
    throw new SyncNotReadyError('Generate or import an SSH key first.');
  }
  return {
    url: config.url,
    privateKey: key.privateKey,
    passphrase: key.passphrase,
    trustedHostKey: trustedHostKey(config),
  };
}

function syncDeps(client: QueryClient): SyncDeps {
  return {
    git: { heads, fetchBranch, commitFile, aheadBehind, setBranch, extractFile, pushBranch },
    logbook: {
      flush: async () => {
        // The commit must hold every edit made so far, and must not race the
        // initial load (src/queries/logbook-mutations.ts explains that race).
        const { path } = await ensureLogbookLoaded(client);
        await flush();
        return path;
      },
      mergeFrom: async (path) => {
        importFile(path);
        await resetData(client);
        schedulePersist();
        await flush();
      },
      reload: async () => {
        const { path } = await ensureLogbookLoaded(client);
        await adoptLogbook(client, { path, lastLoad: loadFromXML(path) });
      },
      isEmpty: async () => {
        await ensureLogbookLoaded(client);
        return listDives().length === 0 && listDiveSites().length === 0;
      },
    },
    tempPath: () => toNativePath(new File(Paths.cache, `git-sync-${Date.now()}.ssrf`).uri),
    removeFile: (path) => {
      const file = new File(`file://${encodeURI(path)}`);
      if (file.exists) {
        file.delete();
      }
    },
  };
}

/**
 * Commits the logbook and brings in the server's changes; with mode 'sync' it
 * then pushes. See src/lib/git/sync.ts for the order and why.
 */
export function useGitSync(): UseMutationResult<SyncResult, Error, SyncMode> {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'git-sync' },
    mutationFn: async (mode: SyncMode) => {
      const config = readConfig();
      const remote = await remoteFor(config);
      const device = Device.deviceName ?? 'Subsurface Mobile';
      return runSync(
        mode,
        config,
        remote,
        {
          update: `Update logbook from ${device}`,
          merge: `Merge logbook changes into ${device}`,
        },
        syncDeps(client),
      );
    },
    onSuccess: () => {
      storeConfig(client, (config) => ({ ...config, lastSyncAt: Date.now() }));
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.gitStatus() }),
  });
}
