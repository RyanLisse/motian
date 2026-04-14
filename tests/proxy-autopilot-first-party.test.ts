import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

describe("proxy autopilot allowlist", () => {
  it("does not expose /api/autopilot as a first-party browser route", () => {
    const source = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");

    // Autopilot routes are internal — they must NOT appear in FIRST_PARTY_PATHS
    // to ensure they remain auth-gated.
    const firstPartyBlock = source.match(/FIRST_PARTY_PATHS\s*=\s*\[([\s\S]*?)\]/);
    expect(firstPartyBlock).not.toBeNull();
    expect(firstPartyBlock?.[1]).not.toContain("/api/autopilot");
  });
});
