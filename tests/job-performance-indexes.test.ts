import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
	__dirname,
	"..",
	"drizzle",
	"0020_performance_composite_indexes.sql",
);

describe("0020_performance_composite_indexes migration", () => {
	const sql = readFileSync(MIGRATION_PATH, "utf-8");

	const expectedIndexes = [
		"idx_job_skills_esco_job",
		"idx_jobs_open_active",
		"idx_applications_job_active",
		"idx_jobs_platform_active",
	];

	test("contains all expected index names", () => {
		for (const name of expectedIndexes) {
			expect(sql).toContain(`"${name}"`);
		}
	});

	test("every CREATE INDEX uses IF NOT EXISTS", () => {
		const createStatements = sql.match(/CREATE INDEX\b[^;]+;/g) ?? [];
		expect(createStatements.length).toBeGreaterThanOrEqual(4);

		for (const stmt of createStatements) {
			expect(stmt).toContain("IF NOT EXISTS");
		}
	});

	test("idx_jobs_open_active has partial WHERE clause for deleted_at IS NULL and status = open", () => {
		// Extract the CREATE INDEX block for idx_jobs_open_active
		const block = sql.match(
			/CREATE INDEX[^;]*"idx_jobs_open_active"[^;]*;/s,
		)?.[0];
		expect(block).toBeDefined();
		expect(block).toContain("deleted_at");
		expect(block).toContain("IS NULL");
		expect(block).toContain("'open'");
	});

	test("idx_applications_job_active has partial WHERE clause for deleted_at IS NULL", () => {
		const block = sql.match(
			/CREATE INDEX[^;]*"idx_applications_job_active"[^;]*;/s,
		)?.[0];
		expect(block).toBeDefined();
		expect(block).toContain("deleted_at");
		expect(block).toContain("IS NULL");
	});

	test("idx_jobs_platform_active has partial WHERE clause for deleted_at IS NULL", () => {
		const block = sql.match(
			/CREATE INDEX[^;]*"idx_jobs_platform_active"[^;]*;/s,
		)?.[0];
		expect(block).toBeDefined();
		expect(block).toContain("deleted_at");
		expect(block).toContain("IS NULL");
	});

	test("idx_job_skills_esco_job indexes esco_uri and job_id columns", () => {
		const block = sql.match(
			/CREATE INDEX[^;]*"idx_job_skills_esco_job"[^;]*;/s,
		)?.[0];
		expect(block).toBeDefined();
		expect(block).toContain("esco_uri");
		expect(block).toContain("job_id");
	});
});
