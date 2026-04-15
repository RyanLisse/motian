import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("search build wiring", () => {
  it("does not require Typesense bootstrap scripts after the migration", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.postbuild).toBeUndefined();
    expect(packageJson.scripts?.["search:bootstrap"]).toBeUndefined();
    expect(packageJson.scripts?.["search:reindex"]).toBeUndefined();
  });
});
