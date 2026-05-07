import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  return Buffer.from(config.KEYS_ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a prefixed string: `enc:v1:<base64(iv|tag|ciphertext)>`
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Layout: iv (12) | tag (16) | ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return PREFIX + combined.toString('base64');
}

/**
 * Decrypts a value produced by `encrypt()`.
 * If the value does NOT start with the `enc:v1:` prefix it is treated as
 * legacy plaintext and returned as-is (lazy migration path).
 */
export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) {
    // Legacy plaintext — return as-is; will be encrypted on next write
    return value;
  }

  const combined = Buffer.from(value.slice(PREFIX.length), 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}

/** Returns true when the value has already been encrypted by this module. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
