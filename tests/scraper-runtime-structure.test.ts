import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function resolveFromRoot(...segments: string[]) {
  return path.join(ROOT, ...segments);
}

function readFile(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}

describe("scraper runtime structure", () => {
  it("keeps reset-circuit-breaker under a static platform segment to avoid Next.js dynamic route conflicts", () => {
    expect(
      fs.existsSync(
        resolveFromRoot(
          "app",
          "api",
          "scraper-configuraties",
          "platform",
          "[platform]",
          "reset-circuit-breaker",
          "route.ts",
        ),
      ),
    ).toBe(true);

    expect(
      fs.existsSync(
        resolveFromRoot(
          "app",
          "api",
          "scraper-configuraties",
          "[platform]",
          "reset-circuit-breaker",
          "route.ts",
        ),
      ),
    ).toBe(false);
  });

  it("runs the scrape pipeline on an hourly cadence so DB cron expressions can decide which platform is due", () => {
    const source = readFile(resolveFromRoot("trigger", "scrape-pipeline.ts"));

    expect(source).toContain('pattern: "0 * * * *"');
    expect(source).not.toContain('pattern: "0 6,10,14,18 * * *"');
  });
});
