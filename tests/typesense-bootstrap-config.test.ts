import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("typesense bootstrap build wiring", () => {
  it("runs bootstrap as a postbuild step", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.postbuild).toBe("pnpm search:bootstrap");
    expect(packageJson.scripts?.["search:bootstrap"]).toBe("tsx scripts/bootstrap-typesense.ts");
  });
});
