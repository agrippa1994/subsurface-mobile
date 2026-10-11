// AI-generated (Claude)
// Byte-level base64. Hand-rolled because React Native has no Buffer and
// atob/btoa work on strings, not bytes.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(chunk >> 18) & 63];
    out += ALPHABET[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(chunk >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[chunk & 63] : '=';
  }
  return out;
}

/** Decodes base64, ignoring whitespace. Throws on anything else. */
export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '').replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of clean) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) {
      throw new Error('Not valid base64.');
    }
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (value >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}
