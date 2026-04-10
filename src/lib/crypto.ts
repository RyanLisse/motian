import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET env var is required");
  return secret;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

function getLegacySalt(secret: string): Buffer {
  return Buffer.from(`motian-v1-${secret.length}`);
}

function encryptWithSalt(plaintext: string, secret: string, salt: Buffer): string {
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

function decryptPayload(secret: string, salt: Buffer, payload: Buffer): string {
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted payload is too short");
  }

  const key = deriveKey(secret, salt);
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/** Encrypt plaintext naar base64 encoded string (salt + iv + tag + ciphertext) */
export function encrypt(plaintext: string): string {
  const secret = getSecret();
  const salt = randomBytes(SALT_LENGTH);
  return encryptWithSalt(plaintext, secret, salt);
}

/** Decrypt base64 encoded string naar plaintext */
export function decrypt(encoded: string): string {
  const secret = getSecret();
  const buf = Buffer.from(encoded, "base64");

  if (buf.length >= SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    try {
      const salt = buf.subarray(0, SALT_LENGTH);
      const payload = buf.subarray(SALT_LENGTH);
      return decryptPayload(secret, salt, payload);
    } catch {
      // Backwards compatibility for previously stored credentials that packed only iv+tag+ciphertext.
    }
  }

  return decryptPayload(secret, getLegacySalt(secret), buf);
}
