import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("trigger config env sync regressions", () => {
  it("syncs the env vars required for Striive scraping and Trigger.dev Sentry", () => {
    const triggerSource = readFile("trigger.config.ts");

    expect(triggerSource).toContain('"STRIIVE_USERNAME"');
    expect(triggerSource).toContain('"STRIIVE_PASSWORD"');
    expect(triggerSource).toContain('"MODAL_TOKEN_ID"');
    expect(triggerSource).toContain('"MODAL_TOKEN_SECRET"');
    expect(triggerSource).toContain('"SENTRY_DSN"');
  });
});
