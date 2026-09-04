import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

describe("proxy autopilot allowlist", () => {
  it("does not list /api/autopilot as a public route", () => {
    const source = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");

    const publicBlock = source.match(/PUBLIC_PATHS\s*=\s*\[([\s\S]*?)\]/);
    expect(publicBlock).not.toBeNull();
    if (!publicBlock) {
      throw new Error("Expected PUBLIC_PATHS block");
    }
    expect(publicBlock[1]).not.toContain("/api/autopilot");
  });

  it("admits via API_SECRET bearer, not header signals or login session", () => {
    const source = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");

    expect(source).toContain("hasValidBearer");
    expect(source).toContain("isOriginIsolationOk");
    expect(source).not.toContain("isFirstPartyBrowserRoute");
    expect(source).not.toContain("FIRST_PARTY_PATHS");
    expect(source).not.toContain("hasVerifiablePrincipal");
    expect(source).not.toContain("redirectToLogin");
    expect(source).not.toContain("/inloggen");
    expect(source).not.toContain("/api/sessie");
  });

  it("scopes the matcher to /api and /pipeline only (no page login gate)", () => {
    const source = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");

    expect(source).toContain('"/api/:path*"');
    expect(source).toContain('"/pipeline/:path*"');
    expect(source).not.toContain("_next/static");
  });
});
