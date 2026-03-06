import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Candidate profile summary migration coverage", () => {
  it("maps candidates.profileSummary to profile_summary in the schema", () => {
    const schema = readFile("src", "db", "schema.ts");
    expect(schema).toContain('profileSummary: text("profile_summary")');
  });

  it("has a drizzle migration for candidates.profile_summary", () => {
    const drizzleDir = path.join(ROOT, "drizzle");
    const migrationSql = fs
      .readdirSync(drizzleDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => fs.readFileSync(path.join(drizzleDir, file), "utf-8"))
      .join("\n");

    expect(migrationSql).toMatch(
      /ALTER TABLE "candidates" ADD COLUMN(?: IF NOT EXISTS)? "profile_summary" text;|CREATE TABLE "candidates"[\s\S]*?"profile_summary" text/,
    );
  });
});