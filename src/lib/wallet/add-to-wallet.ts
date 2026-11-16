// AI-generated (Claude)
// One certification card into Apple Wallet: build pass.json, sign and zip it
// with the stored identity, and hand it to the system sheet.

import type { SsiCertificate } from '@/models/ssi/certificates';
import { buildPassJson } from '@/models/wallet/pass';

import { addPass } from '../../../modules/wallet-pass/src';
import { PASS_IMAGES } from './pass-assets';
import { readPassIdentity } from './identity';
import { base64ToBytes, buildPkpass, bytesToBase64 } from './signing';

export class NoPassIdentityError extends Error {
  constructor() {
    super('No Wallet signing certificate');
    this.name = 'NoPassIdentityError';
  }
}

/** Resolves true when the card is in Wallet afterwards, false when cancelled. */
export async function addCardToWallet(card: SsiCertificate, holder: string | null): Promise<boolean> {
  const identity = await readPassIdentity();
  if (identity === null) {
    throw new NoPassIdentityError();
  }
  const pass = buildPassJson(card, identity, holder);
  const images = Object.fromEntries(
    Object.entries(PASS_IMAGES).map(([name, data]) => [name, base64ToBytes(data)]),
  );
  // Signing is synchronous JS; yield once so the "Preparing" state can render.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return addPass(bytesToBase64(buildPkpass(pass, images, identity)));
}
