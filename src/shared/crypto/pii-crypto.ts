import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export class PiiCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PiiCryptoError';
  }
}

/** SHA-256 hex digest for uniqueness lookups without storing plaintext. */
export function hashPii(value: string): string {
  const normalized = value.trim().replace(/\s/g, '');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Encrypt a PII string as `iv:authTag:ciphertext` (base64 segments).
 * Key must be 32 bytes (256-bit).
 */
export function encryptPii(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new PiiCryptoError('PII encryption key must be 32 bytes');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

export function decryptPii(payload: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new PiiCryptoError('PII encryption key must be 32 bytes');
  }
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new PiiCryptoError('Invalid encrypted PII payload');
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function parsePiiKeyHex(hex: string): Buffer {
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new PiiCryptoError('PII_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return key;
}
