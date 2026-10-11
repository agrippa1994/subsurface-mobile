// AI-generated (Claude)
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { decodeBase64, encodeBase64 } from './base64';
import { describePrivateKey, encodeEd25519Key } from './ssh-key';

function nodeKey(): { seed: Uint8Array; publicKey: Uint8Array } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  // The raw keys are the last 32 bytes of their DER encodings.
  return {
    seed: new Uint8Array(privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)),
    publicKey: new Uint8Array(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)),
  };
}

function hasSshKeygen(): boolean {
  try {
    execFileSync('ssh-keygen', ['-?'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    // ssh-keygen exits non-zero on -? but still exists.
    return (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

describe('base64', () => {
  test('round-trips every length modulo 3', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 64]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37) & 0xff);
      expect(encodeBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
      expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
    }
  });

  test('rejects garbage', () => {
    expect(() => decodeBase64('no!')).toThrow();
  });
});

describe('encodeEd25519Key', () => {
  test('writes a key its own parser reads back', () => {
    const { seed, publicKey } = nodeKey();
    const pair = encodeEd25519Key(seed, publicKey, 0xdeadbeef, 'diver@phone');

    expect(pair.privateKey.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----\n')).toBe(true);
    expect(pair.privateKey.endsWith('-----END OPENSSH PRIVATE KEY-----\n')).toBe(true);
    expect(pair.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ diver@phone$/);

    const info = describePrivateKey(pair.privateKey);
    expect(info).toEqual({
      format: 'openssh',
      type: 'ssh-ed25519',
      publicKey: pair.publicKey.replace(/ diver@phone$/, ''),
      encrypted: false,
    });
  });

  test('rejects keys of the wrong size', () => {
    expect(() => encodeEd25519Key(new Uint8Array(31), new Uint8Array(32), 1, '')).toThrow();
  });

  test.skipIf(!hasSshKeygen())('produces a key OpenSSH accepts', () => {
    const { seed, publicKey } = nodeKey();
    const pair = encodeEd25519Key(seed, publicKey, 42, 'diver@phone');
    const dir = mkdtempSync(join(tmpdir(), 'ssh-key-test-'));
    try {
      const file = join(dir, 'id_ed25519');
      writeFileSync(file, pair.privateKey);
      chmodSync(file, 0o600);
      // -y derives the public key from the private key file: it only succeeds
      // when OpenSSH parsed the file, and has to come out identical.
      const derived = execFileSync('ssh-keygen', ['-y', '-f', file]).toString().trim();
      expect(derived).toBe(pair.publicKey);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('describePrivateKey', () => {
  test('recognises a passphrase-protected OpenSSH key and still shows its public half', () => {
    const { seed, publicKey } = nodeKey();
    const plain = encodeEd25519Key(seed, publicKey, 1, '');
    // Re-label the cipher: the parser only reads the header and public blob.
    const body = decodeBase64(plain.privateKey.replace(/-----[A-Z ]+-----/g, ''));
    const magic = 'openssh-key-v1\0'.length;
    const cipher = new TextEncoder().encode('aes256-ctr');
    const rewritten = new Uint8Array([
      ...body.subarray(0, magic),
      0,
      0,
      0,
      cipher.length,
      ...cipher,
      ...body.subarray(magic + 4 + 4),
    ]);
    const text = `-----BEGIN OPENSSH PRIVATE KEY-----\n${encodeBase64(rewritten)}\n-----END OPENSSH PRIVATE KEY-----\n`;

    const info = describePrivateKey(text);
    expect(info.encrypted).toBe(true);
    expect(info.publicKey).toBe(plain.publicKey);
  });

  test('recognises PEM keys', () => {
    expect(
      describePrivateKey('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----'),
    ).toEqual({
      format: 'pem',
      type: 'ssh-rsa',
      publicKey: null,
      encrypted: false,
    });
    expect(
      describePrivateKey(
        '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nAAAA\n-----END RSA PRIVATE KEY-----',
      ).encrypted,
    ).toBe(true);
    expect(describePrivateKey('-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA').encrypted).toBe(true);
  });

  test('turns down a public key with a hint', () => {
    expect(() => describePrivateKey('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA== me@host')).toThrow(
      /public key/,
    );
  });

  test('turns down anything else', () => {
    expect(() => describePrivateKey('hello')).toThrow(/not an SSH private key/);
  });
});
