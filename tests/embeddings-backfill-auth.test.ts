import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("embeddings backfill auth (trust boundary)", () => {
  it("admits via requirePrincipal only — does not also require CRON_SECRET", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/embeddings/backfill/route.ts"),
      "utf8",
    );
    expect(source).toContain("requirePrincipal");
    expect(source).not.toMatch(/CRON_SECRET/);
  });
});
