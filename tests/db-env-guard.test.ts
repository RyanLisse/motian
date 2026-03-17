import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("@motian/db build safety", () => {
  const originalTursoUrl = process.env.TURSO_DATABASE_URL;
  const originalTursoToken = process.env.TURSO_AUTH_TOKEN;
  let dbModule: typeof import("../packages/db/src/index");

  beforeAll(async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    dbModule = await import("../packages/db/src/index");
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();

    if (originalTursoUrl === undefined) {
      delete process.env.TURSO_DATABASE_URL;
    } else {
      process.env.TURSO_DATABASE_URL = originalTursoUrl;
    }

    if (originalTursoToken === undefined) {
      delete process.env.TURSO_AUTH_TOKEN;
    } else {
      process.env.TURSO_AUTH_TOKEN = originalTursoToken;
    }
  });

  it("allows module import without TURSO_DATABASE_URL until the db client is used", () => {
    expect(dbModule).toHaveProperty("db");
    expect(() => dbModule.db.select).toThrowError(/TURSO_DATABASE_URL is not set/);
  });
});
