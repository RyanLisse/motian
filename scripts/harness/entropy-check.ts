#!/usr/bin/env tsx
/**
 * entropy-check.ts
 * Detects drift and entropy in the codebase: stale docs, untested services,
 * orphaned imports, and schema drift.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const VERBOSE = args.includes("--verbose");

interface Issue {
  label: string;
  severity: "critical" | "warning";
}

interface CheckResult {
  name: string;
  issues: Issue[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function listFiles(dir: string, ext?: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && (ext === undefined || d.name.endsWith(ext)))
    .map((d) => join(dir, d.name));
}

// ── Check 1: Stale Docs ────────────────────────────────────────────────────
// Scans docs/architecture.md for file references and verifies they exist.

function checkStaleDocs(): CheckResult {
  const issues: Issue[] = [];
  const archPath = join(ROOT, "docs", "architecture.md");

  if (!existsSync(archPath)) {
    return { name: "Stale Docs", issues };
  }

  const content = readText(archPath);

  // Match references like `src/services/foo.ts` or `src/db/schema.ts`
  const fileRefPattern = /`(src\/[^\s`]+\.[a-z]+)`/g;
  let match: RegExpExecArray | null;

  while ((match = fileRefPattern.exec(content)) !== null) {
    const refPath = join(ROOT, match[1]);
    if (!existsSync(refPath)) {
      issues.push({
        label: `docs/architecture.md references missing file: ${match[1]}`,
        severity: "warning",
      });
    }
  }

  return { name: "Stale Docs", issues };
}

// ── Check 2: Untested Services ────────────────────────────────────────────
// Each .ts file in src/services/ should have a matching test in tests/.

function checkUntestedServices(): CheckResult {
  const issues: Issue[] = [];
  const servicesDir = join(ROOT, "src", "services");
  const testsDir = join(ROOT, "tests");

  const serviceFiles = listFiles(servicesDir, ".ts").filter((f) => !f.endsWith(".d.ts"));

  for (const serviceFile of serviceFiles) {
    const name = basename(serviceFile, ".ts");
    // Accept any test file that contains the service name
    const testCandidates = [join(testsDir, `${name}.test.ts`), join(testsDir, `${name}.spec.ts`)];

    const hasTest = testCandidates.some(existsSync);

    if (!hasTest) {
      issues.push({
        label: `src/services/${name}.ts has no corresponding test in tests/`,
        severity: "warning",
      });
    }
  }

  return { name: "Untested Services", issues };
}

// ── Check 3: Orphaned Imports ─────────────────────────────────────────────
// Detects .ts files under src/ that are never imported by any other file
// (simple heuristic: check if the filename stem appears in any import statement).

function checkOrphanedImports(): CheckResult {
  const issues: Issue[] = [];
  const srcDir = join(ROOT, "src");

  // Collect all .ts source files (excluding index files and .d.ts)
  function collectTs(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectTs(full));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts") &&
        entry.name !== "index.ts"
      ) {
        files.push(full);
      }
    }
    return files;
  }

  const allSrcFiles = collectTs(srcDir);

  // Build a search corpus: content of all .ts files in project (src + tests + app)
  const searchDirs = ["src", "tests", "app"].map((d) => join(ROOT, d));
  const corpusFiles = searchDirs.flatMap((d) => collectTs(d));
  // Also include index files in corpus
  const indexFiles = ["src/db/index.ts", "src/services"].flatMap((p) => {
    const full = join(ROOT, p);
    if (existsSync(full) && full.endsWith(".ts")) return [full];
    return [];
  });

  const corpus = [...corpusFiles, ...indexFiles].map(readText).join("\n");

  for (const file of allSrcFiles) {
    const stem = basename(file, ".ts");
    const relPath = relative(ROOT, file);

    // Check if stem appears in any import/require anywhere in the project
    // Match: from '...stem' or from "...stem" or require('...stem')
    const importPattern = new RegExp(
      `from\\s+['"][^'"]*${stem}['"]|require\\(['"][^'"]*${stem}['"]\\)`,
    );

    if (!importPattern.test(corpus)) {
      issues.push({
        label: `${relPath} may be dead code (not imported anywhere)`,
        severity: "warning",
      });
    }
  }

  return { name: "Orphaned Code", issues };
}

// ── Check 4: Schema Drift ─────────────────────────────────────────────────
// Check if tables defined in src/db/schema.ts have corresponding migration files.

function checkSchemaDrift(): CheckResult {
  const issues: Issue[] = [];
  const schemaPath = join(ROOT, "src", "db", "schema.ts");
  const migrationsDir = join(ROOT, "drizzle");

  if (!existsSync(schemaPath)) {
    return { name: "Schema Drift", issues };
  }

  const schemaContent = readText(schemaPath);

  // Extract table names from pgTable('table_name', ...) calls
  const tablePattern = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  const tables: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(schemaContent)) !== null) {
    tables.push(match[1]);
  }

  if (tables.length === 0) {
    return { name: "Schema Drift", issues };
  }

  // Collect all migration SQL content
  const migrationFiles = listFiles(migrationsDir, ".sql");
  const migrationContent = migrationFiles.map(readText).join("\n");

  for (const table of tables) {
    // Check if any migration creates this table
    const createPattern = new RegExp(`CREATE TABLE.*?["']?${table}["']?`, "i");
    if (!createPattern.test(migrationContent)) {
      issues.push({
        label: `Table "${table}" in schema.ts has no CREATE TABLE in drizzle/ migrations`,
        severity: "warning",
      });
    }
  }

  return { name: "Schema Drift", issues };
}

// ── Reporting ──────────────────────────────────────────────────────────────

function _formatCount(issues: Issue[], label: string): string {
  const count = issues.length;
  return `${label}: ${count === 0 ? "0 issues" : `${count} file${count === 1 ? "" : "s"} missing tests`}`;
}

function run(): void {
  const results: CheckResult[] = [
    checkStaleDocs(),
    checkUntestedServices(),
    checkOrphanedImports(),
    checkSchemaDrift(),
  ];

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalCount = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "critical").length,
    0,
  );
  const warningCount = totalIssues - criticalCount;

  console.log("\nEntropy Check Results");
  console.log("═══════════════════════");

  for (const result of results) {
    const count = result.issues.length;
    let line: string;

    if (result.name === "Untested Services") {
      line = `Untested Services: ${count === 0 ? "0 issues" : `${count} file${count === 1 ? "" : "s"} missing tests`}`;
    } else if (result.name === "Orphaned Code") {
      line = `Orphaned Code:   ${count === 0 ? "0 issues" : `${count} potential dead file${count === 1 ? "" : "s"}`}`;
    } else {
      line = `${result.name}:${" ".repeat(Math.max(1, 17 - result.name.length))}${count === 0 ? "0 issues" : `${count} issue${count === 1 ? "" : "s"}`}`;
    }

    console.log(line);

    if (VERBOSE && count > 0) {
      for (const issue of result.issues) {
        const tag = issue.severity === "critical" ? "[CRITICAL]" : "[warn]";
        console.log(`  ${tag} ${issue.label}`);
      }
    }
  }

  console.log("═══════════════════════");
  console.log(
    `Total: ${totalIssues} issue${totalIssues === 1 ? "" : "s"} (${criticalCount} critical, ${warningCount} warnings)`,
  );
  console.log();

  if (!VERBOSE && totalIssues > 0) {
    console.log("Run with --verbose to see details.");
  }

  if (STRICT && criticalCount > 0) {
    process.exit(1);
  }

  process.exit(0);
}

run();
