import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("@motian/db build safety", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("allows module import without DATABASE_URL until the db client is used", async () => {
    delete process.env.DATABASE_URL;
    const dbModule = await import("../packages/db/src/index");

    expect(dbModule).toHaveProperty("db");
    expect(() => dbModule.getDatabaseDialect()).toThrowError(/DATABASE_URL is not set/);
  }, 120_000);

  it("reports postgres as the active dialect when DATABASE_URL is configured", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/motian");

    const { getDatabaseDialect } = await import("../packages/db/src/index");

    expect(getDatabaseDialect()).toBe("postgres");
  }, 120_000);

  it("rejects a public database env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATABASE_URL", "postgres://public.example");

    const dbModule = await import("../packages/db/src/index");

    expect(() => dbModule.getDatabaseDialect()).toThrowError(
      /NEXT_PUBLIC_DATABASE_URL is set\. Keep the Neon connection string server-only in DATABASE_URL\./,
    );
  }, 120_000);
});
