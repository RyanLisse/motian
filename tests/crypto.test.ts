import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "../src/lib/crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function encryptLegacy(plaintext: string, secret: string): string {
  const salt = Buffer.from(`motian-v1-${secret.length}`);
  const key = scryptSync(secret, salt, KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

describe("crypto — encrypt/decrypt", () => {
  const ORIGINAL_ENV = process.env;
  const TEST_SECRET = "test-secret-key-for-vitest-runs-2026";

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_SECRET: TEST_SECRET };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = ORIGINAL_ENV;
  });

  it("encrypt geeft base64 string terug", () => {
    const result = encrypt("hello world");
    expect(typeof result).toBe("string");
    // Moet geldige base64 zijn
    expect(() => Buffer.from(result, "base64")).not.toThrow();
  });

  it("decrypt herstelt originele tekst", () => {
    const plaintext = '{"username":"admin","password":"geheim123"}';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("encrypt produceert unieke ciphertexts (random salt + IV)", () => {
    const plaintext = "zelfde tekst";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("encrypt prepends een unieke 32-byte salt aan nieuwe blobs", () => {
    const plaintext = "zelfde tekst";
    const a = Buffer.from(encrypt(plaintext), "base64");
    const b = Buffer.from(encrypt(plaintext), "base64");

    expect(a.length).toBe(32 + 16 + 16 + Buffer.byteLength(plaintext));
    expect(b.length).toBe(32 + 16 + 16 + Buffer.byteLength(plaintext));
    expect(a.subarray(0, 32)).not.toEqual(b.subarray(0, 32));
  });

  it("decrypt faalt bij gemanipuleerde ciphertext", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const encrypted = encrypt("gevoelige data");
    const buf = Buffer.from(encrypted, "base64");
    // Flip een byte in de ciphertext (voorbij IV + tag)
    buf[33] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("verwerkt lege string correct", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("verwerkt unicode/emoji correct", () => {
    const text =
      "Nederlandse tekst met accenten: e\u0301e\u0301n, twee\u0308, co\u00f6rdinatie \u{1f1f3}\u{1f1f1}";
    const encrypted = encrypt(text);
    expect(decrypt(encrypted)).toBe(text);
  });

  it("verwerkt grote JSON payload", () => {
    const payload = JSON.stringify({
      username: "scraper-bot",
      password: "super-secret-password-123!@#",
      cookies: Array.from({ length: 20 }, (_, i) => ({
        name: `cookie_${i}`,
        value: `value_${i}_${"x".repeat(100)}`,
      })),
    });
    const encrypted = encrypt(payload);
    expect(decrypt(encrypted)).toBe(payload);
  });

  it("gooit fout als ENCRYPTION_SECRET ontbreekt", () => {
    delete process.env.ENCRYPTION_SECRET;
    expect(() => encrypt("test")).toThrow("Omgevingsvariabele ENCRYPTION_SECRET is vereist");
  });

  it("gooit fout bij decrypt zonder ENCRYPTION_SECRET", () => {
    const encrypted = encrypt("test");
    delete process.env.ENCRYPTION_SECRET;
    expect(() => decrypt(encrypted)).toThrow("Omgevingsvariabele ENCRYPTION_SECRET is vereist");
  });

  it("decrypt faalt met verkeerde secret", () => {
    const encrypted = encrypt("geheime data");
    process.env.ENCRYPTION_SECRET = "andere-secret-key-die-niet-klopt";
    expect(() => decrypt(encrypted)).toThrow();
  });

  it("decrypt ondersteunt legacy blobs met deterministische salt", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plaintext = '{"username":"legacy-user","password":"oude-geheim"}';
    const encrypted = encryptLegacy(plaintext, TEST_SECRET);
    expect(decrypt(encrypted)).toBe(plaintext);
    expect(warnSpy).toHaveBeenCalledWith(
      "[crypto] legacy_decrypt_fallback: blob mist salt-prefix, val terug op deterministische salt",
    );
  });

  it("gooit Nederlandse fout voor te korte payloads", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const encoded = Buffer.from([1, 2, 3]).toString("base64");
    expect(() => decrypt(encoded)).toThrow("Versleutelde payload is te kort");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("encryptAuthConfig / decryptAuthConfig", () => {
  const ORIGINAL_ENV = process.env;
  const TEST_SECRET = "test-secret-key-for-vitest-runs-2026";
  let encryptAuthConfig: typeof import("../src/services/scrapers").encryptAuthConfig;
  let decryptAuthConfig: typeof import("../src/services/scrapers").decryptAuthConfig;
  let isEncrypted: typeof import("../src/services/scrapers").isEncrypted;

  beforeAll(async () => {
    ({ encryptAuthConfig, decryptAuthConfig, isEncrypted } = await import(
      "../src/services/scrapers"
    ));
  }, 20_000);

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_SECRET: TEST_SECRET };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // Importeer helpers één keer buiten de timed test body zodat coverage runs niet flaken
  it("roundtrip van auth config object", () => {
    const config = { username: "bot@striive.nl", password: "P@ssw0rd!", sessionToken: "abc123" };
    const encrypted = encryptAuthConfig(config);
    expect(typeof encrypted).toBe("string");
    const decrypted = decryptAuthConfig(encrypted);
    expect(decrypted).toEqual(config);
  });

  it("isEncrypted detecteert base64 encrypted waarden", () => {
    const config = { user: "test" };
    const encrypted = encryptAuthConfig(config);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted('{"user":"test"}')).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted(null as unknown as string)).toBe(false);
  });

  it("decryptAuthConfig leest legacy credential blobs", () => {
    const config = { username: "motian", password: "legacy-secret" };
    const encrypted = encryptLegacy(JSON.stringify(config), TEST_SECRET);
    expect(decryptAuthConfig(encrypted)).toEqual(config);
  });
});
