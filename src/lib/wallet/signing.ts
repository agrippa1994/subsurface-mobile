// AI-generated (Claude)
// Builds a signed Apple Wallet pass (.pkpass) on the device.
//
// A .pkpass is a zip of pass.json, its images, a manifest.json with the SHA-1
// of every file, and `signature`: a detached PKCS#7 signature of the manifest,
// made with a Pass Type ID certificate and carrying Apple's WWDR intermediate.
// iOS has no public CMS signing API, so the signature is node-forge (pure JS);
// fflate zips. Nothing here touches React Native, so the Node tests sign and
// verify real passes.
//
// The signing identity comes from a .p12 the user exports from their Apple
// Developer account and imports once (src/lib/wallet/identity.ts). No key is
// built into the app.

import { zipSync } from 'fflate';
import forge from 'node-forge';

import { t } from '@/i18n';

import { WWDR_G4_PEM } from './pass-assets';

/** What a pass is signed with: PEM strings, as they are kept in the keychain. */
export type PassIdentity = {
  keyPem: string;
  certPem: string;
};

/** What the certificate says about itself, shown in Settings. */
export type PassIdentityInfo = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  /** The certificate's common name, "Pass Type ID: pass.com.example.cards". */
  name: string;
  /** ISO timestamp. Apple's pass certificates last a year. */
  expiresAt: string;
};

// userId (UID): Apple puts the Pass Type ID there.
const UID_OID = '0.9.2342.19200300.100.1.1';

export class PassCertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PassCertificateError';
  }
}

function attribute(cert: forge.pki.Certificate, match: (attr: forge.pki.CertificateField) => boolean) {
  const value = cert.subject.attributes.find(match)?.value;
  return typeof value === 'string' ? value : null;
}

export function describeIdentity(identity: PassIdentity): PassIdentityInfo {
  const cert = forge.pki.certificateFromPem(identity.certPem);
  const passTypeIdentifier = attribute(cert, (attr) => attr.type === UID_OID);
  const teamIdentifier = attribute(cert, (attr) => attr.shortName === 'OU');
  if (passTypeIdentifier === null || !passTypeIdentifier.startsWith('pass.')) {
    throw new PassCertificateError(t('certificates.wallet.notPassCertificate'));
  }
  if (teamIdentifier === null) {
    throw new PassCertificateError(t('certificates.wallet.noTeam'));
  }
  return {
    passTypeIdentifier,
    teamIdentifier,
    name: attribute(cert, (attr) => attr.shortName === 'CN') ?? passTypeIdentifier,
    expiresAt: cert.validity.notAfter.toISOString(),
  };
}

/**
 * Reads the Pass Type ID certificate and its private key out of a .p12 (as
 * exported from Keychain Access) and checks it can sign passes. Throws a
 * PassCertificateError with a message for the user when it cannot.
 */
export function importPassIdentity(p12Base64: string, password: string): PassIdentity & PassIdentityInfo {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(p12Base64));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new PassCertificateError(
      /mac|password|decrypt/i.test(message)
        ? t('certificates.wallet.wrongPassword')
        : t('certificates.wallet.unreadable'),
    );
  }

  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => cert !== undefined);
  const keys = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ]
    .map((bag) => bag.key)
    .filter((key): key is forge.pki.rsa.PrivateKey => key !== undefined && 'n' in key);

  const cert = certs.find((candidate) => attribute(candidate, (attr) => attr.type === UID_OID)?.startsWith('pass.'));
  if (!cert) {
    throw new PassCertificateError(t('certificates.wallet.notPassCertificate'));
  }
  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const key = keys.find((candidate) => candidate.n.equals(publicKey.n));
  if (!key) {
    throw new PassCertificateError(t('certificates.wallet.noKey'));
  }

  const identity = {
    keyPem: forge.pki.privateKeyToPem(key),
    certPem: forge.pki.certificateToPem(cert),
  };
  const info = describeIdentity(identity);
  if (new Date(info.expiresAt).getTime() < Date.now()) {
    throw new PassCertificateError(t('certificates.wallet.expired'));
  }
  return { ...identity, ...info };
}

function bytesToBinary(bytes: Uint8Array): string {
  let out = '';
  // Chunked: String.fromCharCode with a whole image as arguments overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function base64ToBytes(base64: string): Uint8Array {
  return binaryToBytes(forge.util.decode64(base64));
}

export function bytesToBase64(bytes: Uint8Array): string {
  return forge.util.encode64(bytesToBinary(bytes));
}

function sha1Hex(bytes: Uint8Array): string {
  const md = forge.md.sha1.create();
  md.update(bytesToBinary(bytes));
  return md.digest().toHex();
}

/** The detached PKCS#7 signature of `manifest`, DER. */
function sign(manifest: Uint8Array, identity: PassIdentity, signingTime: Date): Uint8Array {
  const cert = forge.pki.certificateFromPem(identity.certPem);
  const key = forge.pki.privateKeyFromPem(identity.keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(bytesToBinary(manifest));
  p7.addCertificate(cert);
  p7.addCertificate(forge.pki.certificateFromPem(WWDR_G4_PEM));
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // forge's typing says string; it encodes a Date as UTCTime.
      { type: forge.pki.oids.signingTime, value: signingTime as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  return binaryToBytes(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/**
 * The .pkpass bundle: pass.json and `images` (file name to PNG bytes), with
 * the manifest and its signature.
 */
export function buildPkpass(
  pass: object,
  images: Readonly<Record<string, Uint8Array>>,
  identity: PassIdentity,
  signingTime = new Date(),
): Uint8Array {
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    'pass.json': encoder.encode(JSON.stringify(pass)),
    ...images,
  };
  const manifest = encoder.encode(
    JSON.stringify(Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha1Hex(bytes)]))),
  );
  return zipSync({
    ...files,
    'manifest.json': manifest,
    signature: sign(manifest, identity, signingTime),
  });
}
