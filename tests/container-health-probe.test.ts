import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/gezondheid/leeft/route";

const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
/** Instructions with comments stripped, so prose cannot satisfy an assertion. */
const instructions = dockerfile
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

describe("/api/gezondheid/leeft", () => {
  it("reports ok without touching the database", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("is not cached, so a probe never reads a stale answer", () => {
    expect(GET().headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("Dockerfile", () => {
  it("skips install scripts, which otherwise abort the build", () => {
    // extension/package.json is present without its sources, so `wxt prepare`
    // fails and takes the whole `pnpm install` with it.
    expect(instructions).toContain("--ignore-scripts");
  });

  it("probes liveness rather than the database-backed readiness view", () => {
    const healthcheck = instructions
      .split("\n")
      .filter((line) => line.includes("HEALTHCHECK") || line.includes("curl"))
      .join("\n");

    expect(healthcheck).toContain("/api/gezondheid/leeft");
    // Not the bare readiness endpoint, which queries Neon on every probe.
    expect(healthcheck).not.toContain('/api/gezondheid"');
    // A cold Next boot must not count as a failure.
    expect(healthcheck).toContain("start-period");
  });
});
