import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

function readFile(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Overzicht dashboard query shape", () => {
  it("batches overview data into two execute queries", () => {
    const source = readFile("app", "overzicht", "page.tsx");
    const executeCalls = source.match(/db\.execute\(sql`/g) ?? [];

    expect(executeCalls).toHaveLength(2);
    expect(source).toContain("WITH filtered_jobs AS");
    expect(source).toContain("WITH active_scrapers AS");
  });
});
