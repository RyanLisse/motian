import { describe, expect, it } from "vitest";
import { getPoolSslConfig } from "@/src/db/pool-config";

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
