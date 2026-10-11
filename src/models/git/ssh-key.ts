// AI-generated (Claude)
// SSH key files, as far as the sync needs them.
//
// The app generates Ed25519 keys - the native side only supplies the random
// seed - and writes them in the OpenSSH format `ssh-keygen` produces, so the
// key libssh2 is handed is byte-for-byte the kind of file every SSH tool reads.
// For a key the user imports, all that is needed is to recognise it and to
// show its public half, which the OpenSSH format stores unencrypted even when
// the private half is protected by a passphrase.

import { decodeBase64, encodeBase64 } from './base64';

const MAGIC = 'openssh-key-v1\0';
const OPENSSH_BEGIN = '-----BEGIN OPENSSH PRIVATE KEY-----';
const OPENSSH_END = '-----END OPENSSH PRIVATE KEY-----';

// UTF-8 by hand: TextEncoder is not something to count on in every JS engine
// React Native runs on.
function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return Uint8Array.from(out);
}

// Only ever applied to key type and cipher names, which are ASCII.
function fromUtf8(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

class Writer {
  private parts: number[] = [];

  uint32(value: number): this {
    this.parts.push(
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    );
    return this;
  }

  bytes(value: Uint8Array): this {
    this.uint32(value.length);
    this.parts.push(...value);
    return this;
  }

  string(value: string): this {
    return this.bytes(utf8(value));
  }

  raw(value: Uint8Array | number[]): this {
    this.parts.push(...value);
    return this;
  }

  get length(): number {
    return this.parts.length;
  }

  done(): Uint8Array {
    return Uint8Array.from(this.parts);
  }
}

class Reader {
  private offset = 0;
  private readonly data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  uint32(): number {
    if (this.offset + 4 > this.data.length) {
      throw new Error('The key file is truncated.');
    }
    const d = this.data;
    const o = this.offset;
    this.offset += 4;
    return ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
  }

  bytes(): Uint8Array {
    const length = this.uint32();
    if (this.offset + length > this.data.length) {
      throw new Error('The key file is truncated.');
    }
    const out = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  string(): string {
    return fromUtf8(this.bytes());
  }

  magic(expected: string): boolean {
    const bytes = utf8(expected);
    if (this.data.length < bytes.length || bytes.some((byte, i) => this.data[i] !== byte)) {
      return false;
    }
    this.offset = bytes.length;
    return true;
  }
}

function wrap(text: string, width: number): string {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    lines.push(text.slice(i, i + width));
  }
  return lines.join('\n');
}

export type KeyPair = {
  /** The private key file, OpenSSH format, not encrypted. */
  privateKey: string;
  /** One line for authorized_keys or a git host's "add SSH key" form. */
  publicKey: string;
};

/**
 * Writes an Ed25519 key in the OpenSSH format, unencrypted: on the device the
 * key lives in the keychain, which is the protection a passphrase would give.
 *
 * `checkInt` is the random value OpenSSH repeats twice ahead of the private
 * section (it is how a decryption with a wrong passphrase is detected).
 */
export function encodeEd25519Key(
  seed: Uint8Array,
  publicKey: Uint8Array,
  checkInt: number,
  comment: string,
): KeyPair {
  if (seed.length !== 32 || publicKey.length !== 32) {
    throw new Error('An Ed25519 key has a 32-byte seed and a 32-byte public key.');
  }
  const publicBlob = new Writer().string('ssh-ed25519').bytes(publicKey).done();
  const secret = new Uint8Array(64);
  secret.set(seed, 0);
  secret.set(publicKey, 32);

  const section = new Writer()
    .uint32(checkInt)
    .uint32(checkInt)
    .string('ssh-ed25519')
    .bytes(publicKey)
    .bytes(secret)
    .string(comment);
  // Padded to the cipher block size, 8 for "none", with the bytes 1, 2, 3...
  for (let pad = 1; section.length % 8 !== 0; pad++) {
    section.raw([pad]);
  }

  const file = new Writer()
    .raw(utf8(MAGIC))
    .string('none')
    .string('none')
    .string('')
    .uint32(1)
    .bytes(publicBlob)
    .bytes(section.done())
    .done();

  return {
    privateKey: `${OPENSSH_BEGIN}\n${wrap(encodeBase64(file), 70)}\n${OPENSSH_END}\n`,
    publicKey: `ssh-ed25519 ${encodeBase64(publicBlob)}${comment ? ` ${comment}` : ''}`,
  };
}

export type KeyInfo = {
  format: 'openssh' | 'pem';
  /** "ssh-ed25519", "ssh-rsa", ... - null when the format does not say. */
  type: string | null;
  /** The public key line, when the file carries it (OpenSSH format only). */
  publicKey: string | null;
  /** Whether a passphrase is needed to use it. */
  encrypted: boolean;
};

/**
 * Recognises a private key file. Throws with a readable message for anything
 * that is not one - a public key picked by mistake being the likely case.
 */
export function describePrivateKey(text: string): KeyInfo {
  const trimmed = text.trim();
  if (/^(ssh-|ecdsa-)\S+ [A-Za-z0-9+/=]+/.test(trimmed)) {
    throw new Error('This is a public key. Pick the private key file (the one without .pub).');
  }

  if (trimmed.startsWith(OPENSSH_BEGIN)) {
    const end = trimmed.indexOf(OPENSSH_END);
    if (end < 0) {
      throw new Error('The key file is incomplete.');
    }
    const reader = new Reader(decodeBase64(trimmed.slice(OPENSSH_BEGIN.length, end)));
    if (!reader.magic(MAGIC)) {
      throw new Error('This is not an OpenSSH private key.');
    }
    const cipher = reader.string();
    reader.string(); // kdf name
    reader.bytes(); // kdf options
    if (reader.uint32() < 1) {
      throw new Error('The key file holds no key.');
    }
    const publicBlob = reader.bytes();
    const type = new Reader(publicBlob).string();
    return {
      format: 'openssh',
      type,
      publicKey: `${type} ${encodeBase64(publicBlob)}`,
      encrypted: cipher !== 'none',
    };
  }

  const pem = /^-----BEGIN ((?:RSA |EC |ENCRYPTED )?PRIVATE KEY)-----/.exec(trimmed);
  if (pem) {
    const label = pem[1];
    return {
      format: 'pem',
      type: label.startsWith('RSA') ? 'ssh-rsa' : label.startsWith('EC') ? 'ecdsa' : null,
      publicKey: null,
      encrypted: label.startsWith('ENCRYPTED') || /Proc-Type:\s*4,ENCRYPTED/.test(trimmed),
    };
  }

  throw new Error('This is not an SSH private key.');
}
