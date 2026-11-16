// AI-generated (Claude)
// Signs real passes with a throwaway certificate shaped like Apple's Pass Type
// ID certificates, then checks the bundle the way Wallet would: every file in
// the manifest, the manifest under the signature.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import forge from 'node-forge';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  base64ToBytes,
  buildPkpass,
  bytesToBase64,
  describeIdentity,
  importPassIdentity,
  PassCertificateError,
} from './signing';

const UID_OID = '0.9.2342.19200300.100.1.1';

function makeCertificate(uid: string, notAfter: Date) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = notAfter;
  const subject = [
    { type: UID_OID, value: uid },
    { name: 'commonName', value: `Pass Type ID: ${uid}` },
    { shortName: 'OU', value: 'TEAM123456' },
    { name: 'organizationName', value: 'Test Diver' },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

function toP12(cert: forge.pki.Certificate, key: forge.pki.rsa.PrivateKey, password: string): string {
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], password, { algorithm: '3des' });
  return forge.util.encode64(forge.asn1.toDer(asn1).getBytes());
}

const valid = makeCertificate('pass.com.example.cards', new Date(Date.now() + 365 * 86_400_000));

describe('importPassIdentity', () => {
  it('reads the Pass Type ID and team out of the certificate', () => {
    const identity = importPassIdentity(toP12(valid.cert, valid.key, 'secret'), 'secret');
    expect(identity.passTypeIdentifier).toBe('pass.com.example.cards');
    expect(identity.teamIdentifier).toBe('TEAM123456');
    expect(identity.name).toBe('Pass Type ID: pass.com.example.cards');
    expect(identity.keyPem).toContain('PRIVATE KEY');
    expect(describeIdentity(identity).passTypeIdentifier).toBe('pass.com.example.cards');
  });

  it('says so when the password is wrong', () => {
    expect(() => importPassIdentity(toP12(valid.cert, valid.key, 'secret'), 'nope')).toThrow(
      PassCertificateError,
    );
  });

  it('rejects a certificate that is not a Pass Type ID', () => {
    const other = makeCertificate('com.example.app', new Date(Date.now() + 86_400_000));
    expect(() => importPassIdentity(toP12(other.cert, other.key, 'x'), 'x')).toThrow(/Pass Type ID/);
  });

  it('rejects an expired certificate', () => {
    const old = makeCertificate('pass.com.example.old', new Date(Date.now() - 1000));
    expect(() => importPassIdentity(toP12(old.cert, old.key, 'x'), 'x')).toThrow(/expired/);
  });

  it('rejects bytes that are no .p12 at all', () => {
    expect(() => importPassIdentity(bytesToBase64(new Uint8Array([1, 2, 3])), 'x')).toThrow(
      PassCertificateError,
    );
  });

  it('reads a .p12 written by OpenSSL 3 (AES-256, PBKDF2)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p12-'));
    try {
      writeFileSync(join(dir, 'key.pem'), forge.pki.privateKeyToPem(valid.key));
      writeFileSync(join(dir, 'cert.pem'), forge.pki.certificateToPem(valid.cert));
      try {
        execFileSync('openssl', [
          'pkcs12', '-export', '-inkey', join(dir, 'key.pem'), '-in', join(dir, 'cert.pem'),
          '-out', join(dir, 'out.p12'), '-passout', 'pass:modern',
        ], { stdio: 'ignore' });
      } catch {
        return; // No OpenSSL on this machine: the forge-written case above still runs.
      }
      const p12 = readFileSync(join(dir, 'out.p12')).toString('base64');
      expect(importPassIdentity(p12, 'modern').passTypeIdentifier).toBe('pass.com.example.cards');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('buildPkpass', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'pkpass-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const identity = {
    keyPem: forge.pki.privateKeyToPem(valid.key),
    certPem: forge.pki.certificateToPem(valid.cert),
  };
  const icon = base64ToBytes(bytesToBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])));

  it('hashes every file into the manifest and signs it', () => {
    const pass = { formatVersion: 1, serialNumber: 'ssi-1' };
    const files = unzipSync(buildPkpass(pass, { 'icon.png': icon }, identity));

    expect(Object.keys(files).sort()).toEqual(['icon.png', 'manifest.json', 'pass.json', 'signature']);
    expect(JSON.parse(strFromU8(files['pass.json']))).toEqual(pass);

    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Record<string, string>;
    for (const name of ['pass.json', 'icon.png']) {
      const md = forge.md.sha1.create();
      md.update(String.fromCharCode(...files[name]));
      expect(manifest[name]).toBe(md.digest().toHex());
    }

    // The signature carries the signer and Apple's intermediate.
    const p7 = forge.pkcs7.messageFromAsn1(
      forge.asn1.fromDer(String.fromCharCode(...files.signature)),
    ) as forge.pkcs7.PkcsSignedData;
    const subjects = p7.certificates.map((cert) => cert.subject.getField('CN')?.value);
    expect(subjects).toContain('Pass Type ID: pass.com.example.cards');
    expect(subjects).toContain('Apple Worldwide Developer Relations Certification Authority');

    // And it verifies against the manifest it was made for.
    writeFileSync(join(dir, 'manifest.json'), files['manifest.json']);
    writeFileSync(join(dir, 'signature'), files.signature);
    try {
      execFileSync('openssl', ['version'], { stdio: 'ignore' });
    } catch {
      return;
    }
    expect(() =>
      execFileSync(
        'openssl',
        [
          'smime', '-verify', '-noverify', '-binary', '-inform', 'DER',
          '-in', join(dir, 'signature'), '-content', join(dir, 'manifest.json'), '-out', '/dev/null',
        ],
        { stdio: 'pipe' },
      ),
    ).not.toThrow();
  });
});
