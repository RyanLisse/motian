import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("@motian/db build safety", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
      return;
    }

    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("allows module import without DATABASE_URL until the db client is used", async () => {
    delete process.env.DATABASE_URL;

    const module = await import("../packages/db/src/index");

    expect(module).toHaveProperty("db");
    expect(() => module.db.select).toThrowError(/DATABASE_URL is not set/);
  });
});
