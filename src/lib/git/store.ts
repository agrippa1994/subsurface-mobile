// AI-generated (Claude)
// Where the git sync keeps its settings and its key.
//
// The settings are a JSON file next to the logbook, like settings.json. The
// private key goes to the keychain, the same way the SSI password does
// (src/lib/ssi/auth.ts): the Documents directory is visible in the Files app,
// and a key left there would leave the device with the next backup.

import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import {
  DEFAULT_GIT_SYNC_CONFIG,
  parseGitSyncConfig,
  serializeGitSyncConfig,
  type GitSyncConfig,
} from '@/models/git/sync-config';

const CONFIG_FILENAME = 'git-sync.json';
const KEY_ITEM = 'git-ssh-key';

/** Unlocked device only, never in iCloud or a device backup. */
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function configFile(): File {
  return new File(Paths.document, CONFIG_FILENAME);
}

export function readConfig(): GitSyncConfig {
  try {
    const file = configFile();
    return file.exists ? parseGitSyncConfig(file.textSync()) : DEFAULT_GIT_SYNC_CONFIG;
  } catch {
    return DEFAULT_GIT_SYNC_CONFIG;
  }
}

export function writeConfig(config: GitSyncConfig): void {
  const file = configFile();
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  file.write(serializeGitSyncConfig(config));
}

export function updateConfig(change: (config: GitSyncConfig) => GitSyncConfig): GitSyncConfig {
  const next = change(readConfig());
  writeConfig(next);
  return next;
}

export type StoredKey = {
  privateKey: string;
  passphrase?: string;
  /** Shown so it can be added to the git host. Null for a PEM key. */
  publicKey: string | null;
  origin: 'generated' | 'imported';
};

export async function readKey(): Promise<StoredKey | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_ITEM, KEYCHAIN_OPTIONS);
    if (raw === null) {
      return null;
    }
    const stored = JSON.parse(raw) as Partial<StoredKey>;
    if (typeof stored.privateKey !== 'string') {
      return null;
    }
    return {
      privateKey: stored.privateKey,
      passphrase: typeof stored.passphrase === 'string' ? stored.passphrase : undefined,
      publicKey: typeof stored.publicKey === 'string' ? stored.publicKey : null,
      origin: stored.origin === 'imported' ? 'imported' : 'generated',
    };
  } catch {
    return null;
  }
}

export async function writeKey(key: StoredKey): Promise<void> {
  await SecureStore.setItemAsync(KEY_ITEM, JSON.stringify(key), KEYCHAIN_OPTIONS);
}

export async function deleteKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ITEM, KEYCHAIN_OPTIONS);
}
