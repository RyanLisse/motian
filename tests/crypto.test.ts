import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/lib/crypto";

describe("crypto — encrypt/decrypt", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_SECRET: "test-secret-key-for-vitest-runs-2026" };
  });

  afterEach(() => {
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

  it("encrypt produceert unieke ciphertexts (random IV)", () => {
    const plaintext = "zelfde tekst";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("decrypt faalt bij gemanipuleerde ciphertext", () => {
    const encrypted = encrypt("gevoelige data");
    const buf = Buffer.from(encrypted, "base64");
    // Flip een byte in de ciphertext (voorbij IV + tag)
    buf[33] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
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
    expect(() => encrypt("test")).toThrow("ENCRYPTION_SECRET env var is required");
  });

  it("gooit fout bij decrypt zonder ENCRYPTION_SECRET", () => {
    const encrypted = encrypt("test");
    delete process.env.ENCRYPTION_SECRET;
    expect(() => decrypt(encrypted)).toThrow("ENCRYPTION_SECRET env var is required");
  });

  it("decrypt faalt met verkeerde secret", () => {
    const encrypted = encrypt("geheime data");
    process.env.ENCRYPTION_SECRET = "andere-secret-key-die-niet-klopt";
    expect(() => decrypt(encrypted)).toThrow();
  });
});

describe("encryptAuthConfig / decryptAuthConfig", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_SECRET: "test-secret-key-for-vitest-runs-2026" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // Importeer helpers — deze worden getest na implementatie in scrapers.ts
  it("roundtrip van auth config object", async () => {
    const { encryptAuthConfig, decryptAuthConfig } = await import("../src/services/scrapers");
    const config = { username: "bot@striive.nl", password: "P@ssw0rd!", sessionToken: "abc123" };
    const encrypted = encryptAuthConfig(config);
    expect(typeof encrypted).toBe("string");
    const decrypted = decryptAuthConfig(encrypted);
    expect(decrypted).toEqual(config);
  });

  it("isEncrypted detecteert base64 encrypted waarden", async () => {
    const { encryptAuthConfig, isEncrypted } = await import("../src/services/scrapers");
    const config = { user: "test" };
    const encrypted = encryptAuthConfig(config);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted('{"user":"test"}')).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted(null as unknown as string)).toBe(false);
  });
});
