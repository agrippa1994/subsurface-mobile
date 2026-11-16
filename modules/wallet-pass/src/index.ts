// AI-generated (Claude)
// Public API of the wallet-pass native module: hand a signed .pkpass to Apple
// Wallet, and Apple's "Add to Apple Wallet" button. iOS only - there is no
// native module on Android or web, where `canAddPasses` is false and the button
// renders nothing.
import { requireOptionalNativeModule } from 'expo';

export { AddPassButton, type AddPassButtonProps } from './AddPassButton';

type WalletPassModule = {
  canAddPasses(): boolean;
  addPass(base64: string): Promise<boolean>;
};

const native = requireOptionalNativeModule<WalletPassModule>('WalletPass');

/** Whether this device can take a pass into Wallet at all. */
export function canAddPasses(): boolean {
  return native?.canAddPasses() ?? false;
}

/**
 * Shows the system sheet for the pass. Resolves true when the pass is in
 * Wallet afterwards, false when the user cancelled; rejects when PassKit
 * refuses the pass (most often its signature).
 */
export function addPass(pkpassBase64: string): Promise<boolean> {
  if (!native) {
    return Promise.reject(new Error('Apple Wallet is not available on this platform.'));
  }
  return native.addPass(pkpassBase64);
}
