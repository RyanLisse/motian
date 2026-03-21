import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("@motian/db build safety", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let dbModule: typeof import("../packages/db/src/index");

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    dbModule = await import("../packages/db/src/index");
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("allows module import without DATABASE_URL until the db client is used", () => {
    expect(dbModule).toHaveProperty("db");
    expect(() => dbModule.db.select).toThrowError(
      /DATABASE_URL is not set/,
    );
  });
});
