// AI-generated (Claude)
// The Wallet signing identity in the keychain.
//
// Imported once from a .p12 (src/lib/wallet/signing.ts reads it), then kept as
// the certificate and its unencrypted private key, so the .p12 password is not
// stored and a pass can be signed without asking for it again. Same keychain
// policy as the SSI credentials (src/lib/ssi/auth.ts): readable only while the
// device is unlocked, never in a backup or iCloud.

import * as SecureStore from 'expo-secure-store';

import { describeIdentity, importPassIdentity, type PassIdentity, type PassIdentityInfo } from './signing';

const KEY_ITEM = 'wallet-pass-key';
const CERT_ITEM = 'wallet-pass-cert';

const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type StoredPassIdentity = PassIdentity & PassIdentityInfo;

export async function readPassIdentity(): Promise<StoredPassIdentity | null> {
  try {
    const [keyPem, certPem] = await Promise.all([
      SecureStore.getItemAsync(KEY_ITEM, KEYCHAIN_OPTIONS),
      SecureStore.getItemAsync(CERT_ITEM, KEYCHAIN_OPTIONS),
    ]);
    if (keyPem === null || certPem === null) {
      return null;
    }
    const identity = { keyPem, certPem };
    return { ...identity, ...describeIdentity(identity) };
  } catch {
    // An item the device will not hand over, or one no longer readable, is
    // treated as absent: the user imports the certificate again.
    return null;
  }
}

/** Checks the .p12 and stores it. Nothing is written when it is refused. */
export async function savePassIdentity(p12Base64: string, password: string): Promise<StoredPassIdentity> {
  const identity = importPassIdentity(p12Base64, password);
  await SecureStore.setItemAsync(KEY_ITEM, identity.keyPem, KEYCHAIN_OPTIONS);
  await SecureStore.setItemAsync(CERT_ITEM, identity.certPem, KEYCHAIN_OPTIONS);
  return identity;
}

export async function deletePassIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ITEM, KEYCHAIN_OPTIONS);
  await SecureStore.deleteItemAsync(CERT_ITEM, KEYCHAIN_OPTIONS);
}
