import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("legacy vacancy archive normalization", () => {
  it("adds archived_at and snapshots affected jobs before clearing deleted_at", () => {
    const migration = readFile("drizzle", "0014_legacy_job_archive_normalization.sql");

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "job_archive_normalization_backups"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "archived_at" timestamp');
    expect(migration).toContain("\"status\" = 'archived'");
    expect(migration).toContain('"archived_at" = COALESCE("archived_at", "deleted_at")');
    expect(migration).toContain('"deleted_at" = NULL');
  });

  it("provides preview, rollback validation, and commit modes for subset backfills", () => {
    const script = readFile("scripts", "backfill-legacy-job-archives.ts");

    expect(script).toContain("--rollback|--commit");
    expect(script).toContain('type Mode = "preview" | "rollback" | "commit"');
    expect(script).toContain('status: "archived"');
    expect(script).toContain("deletedAt: null");
    expect(script).toContain("Subset validation rolled back intentionally.");
  });
});
