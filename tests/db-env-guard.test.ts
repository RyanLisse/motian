import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("@motian/db build safety", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalTursoDatabaseUrl = process.env.TURSO_DATABASE_URL;

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

    if (originalTursoDatabaseUrl === undefined) {
      delete process.env.TURSO_DATABASE_URL;
    } else {
      process.env.TURSO_DATABASE_URL = originalTursoDatabaseUrl;
    }
  });

  it("allows module import without DATABASE_URL until the db client is used", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.TURSO_DATABASE_URL;
    const dbModule = await import("../packages/db/src/index");

    expect(dbModule).toHaveProperty("db");
    expect(() => dbModule.getDatabaseDialect()).toThrowError(
      /DATABASE_URL is not set and TURSO_DATABASE_URL is not set/,
    );
  }, 120_000);

  it("reports postgres as the active dialect when DATABASE_URL is configured", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/motian");

    const { getDatabaseDialect, isPostgresDatabase } = await import("../packages/db/src/index");

    expect(getDatabaseDialect()).toBe("postgres");
    expect(isPostgresDatabase()).toBe(true);
  }, 120_000);
});
