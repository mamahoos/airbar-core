import { describe, it, expect } from '@jest/globals';

import { decryptPii, encryptPii, hashPii, parsePiiKeyHex } from './pii-crypto.js';

const KEY = parsePiiKeyHex('a'.repeat(64));

describe('pii-crypto', () => {
  it('hashes deterministically', () => {
    expect(hashPii('1234567890')).toBe(hashPii('1234567890'));
    expect(hashPii('1234567890')).not.toBe(hashPii('0987654321'));
  });

  it('round-trips encrypt/decrypt', () => {
    const plain = 'IR123456789012345678901234';
    const enc = encryptPii(plain, KEY);
    expect(enc).not.toContain(plain);
    expect(decryptPii(enc, KEY)).toBe(plain);
  });
});
