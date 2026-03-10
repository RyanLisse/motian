import { describe, expect, it } from "vitest";
import { getPoolConfig, getPoolSslConfig } from "@/src/db/pool-config";

describe("getPoolSslConfig", () => {
  it("disables ssl for local postgres urls", () => {
    expect(getPoolSslConfig("postgres://user:pass@localhost:5432/motian")).toBe(false);
    expect(getPoolSslConfig("postgres://user:pass@127.0.0.1:5432/motian")).toBe(false);
  });

  it("respects explicit sslmode settings", () => {
    expect(
      getPoolSslConfig("postgres://user:pass@db.example.com:5432/motian?sslmode=disable"),
    ).toBe(false);
    expect(
      getPoolSslConfig("postgres://user:pass@db.example.com:5432/motian?sslmode=require"),
    ).toEqual({ rejectUnauthorized: false });
  });

  it("defaults remote hosts to ssl", () => {
    expect(getPoolSslConfig("postgres://user:pass@db.example.com:5432/motian")).toEqual({
      rejectUnauthorized: false,
    });
  });
});

describe("getPoolConfig", () => {
  it("uses bounded defaults when pool env vars are missing", () => {
    expect(
      getPoolConfig("postgres://user:pass@localhost:5432/motian", {} as NodeJS.ProcessEnv),
    ).toMatchObject({
      connectionString: "postgres://user:pass@localhost:5432/motian",
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: false,
    });
  });

  it("clamps invalid pool env values to safe bounds", () => {
    expect(
      getPoolConfig("postgres://user:pass@db.example.com:5432/motian", {
        DB_POOL_MAX: "999",
        DB_POOL_IDLE_TIMEOUT_MS: "10",
        DB_POOL_CONNECTION_TIMEOUT_MS: "abc",
      } as NodeJS.ProcessEnv),
    ).toMatchObject({
      max: 50,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: false },
    });
  });
});
