import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

describe("settings page build contract", () => {
  it("keeps the database-backed settings page out of static prerendering", () => {
    const source = fs.readFileSync(path.join(ROOT, "app", "settings", "page.tsx"), "utf-8");

    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).not.toContain("export const revalidate");
  });
});
