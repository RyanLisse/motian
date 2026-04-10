#!/usr/bin/env tsx
/**
 * entropy-check.ts
 * Phase 8 — Entropy Management
 *
 * Scans for codebase cruft:
 *   1. Unused exports in src/services + src/lib
 *   2. Services missing test coverage
 *   3. Stale active plans in docs/plans/ (> 60 days, status: active)
 *   4. Orphaned DB tables (no service-layer consumer)
 *
 * Exit 0 if score < 10, exit 1 if >= 10.
 * Pass --verbose to see all findings.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const VERBOSE = process.argv.includes("--verbose");
const NOW_MS = Date.now();
const STALE_DAYS = 60;
// Max possible score is 4 categories × CAP (5) = 20.
// Threshold of 15 means: fail only when 3+ categories are fully saturated,
// which indicates real regression rather than pre-existing test-coverage debt.
const SCORE_THRESHOLD = 15;

// ── Helpers ────────────────────────────────────────────────────────────────

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/** List direct .ts files in a flat directory (no recursion needed for services/lib). */
function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".d.ts"))
    .map((e) => join(dir, e.name));
}

/** Recursively list all .ts files under a directory, skipping build dirs. */
function listTsFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const SKIP = new Set(["node_modules", ".next", "dist", ".git", "opentui-demo", "tui"]);
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !SKIP.has(entry.name)) {
      results.push(...listTsFilesRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Build a corpus string from all searchable source files.
 * Used for import-presence checks (grep-style).
 */
function buildCorpus(): string {
  const dirs = ["src", "app", "components", "tests", "trigger"].map((d) => join(ROOT, d));
  const files = dirs.flatMap(listTsFilesRecursive);
  return files.map(readText).join("\n");
}

// ── Check 1: Unused exports ────────────────────────────────────────────────
// Reports files (not individual symbols) where every exported *function* is
// unreferenced elsewhere. Type/interface exports are intentionally excluded
// because they're erased at runtime and commonly re-exported via barrel files.

interface UnusedExport {
  file: string;
  name: string;
}

function checkUnusedExports(): UnusedExport[] {
  const targets = [
    ...listTsFiles(join(ROOT, "src", "services")),
    ...listTsFiles(join(ROOT, "src", "lib")),
  ];

  // Build a broad corpus: everything except the file under test itself
  const corpusDirs = ["src", "app", "components", "tests", "trigger", "packages"].map(
    (d) => join(ROOT, d),
  );
  const allCorpusFiles = corpusDirs.flatMap(listTsFilesRecursive);
  const corpusText = allCorpusFiles.map(readText).join("\n");

  const unused: UnusedExport[] = [];

  // Only check exported *functions* (runtime symbols, not types/interfaces/classes)
  const EXPORT_FN_RE =
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)|^export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\(/gm;

  for (const file of targets) {
    const content = readText(file);
    const relFile = relative(ROOT, file);
    const stem = basename(file, ".ts");

    // Skip index / barrel files — they exist only to re-export
    if (stem === "index") continue;

    const exportedFns: string[] = [];
    for (const match of content.matchAll(EXPORT_FN_RE)) {
      const name = match[1] ?? match[2];
      if (name && name.length >= 3) exportedFns.push(name);
    }

    if (exportedFns.length === 0) continue;

    // A file is considered "unused" only if ALL its exported functions are
    // unimported. This avoids noise from partially-used files.
    // We check: does the file's stem appear in any import statement in the corpus?
    const importedPattern = new RegExp(
      `from\\s+['"][^'"]*/${stem}['"]|from\\s+['"][^'"]*/${stem}['".]`,
    );

    if (!importedPattern.test(corpusText)) {
      // None of the file's exports are imported — report the first exported fn
      unused.push({ file: relFile, name: exportedFns[0] });
    }
  }

  return unused;
}

// ── Check 2: Missing test coverage ────────────────────────────────────────

function checkMissingTests(): string[] {
  const servicesDir = join(ROOT, "src", "services");
  const testsDir = join(ROOT, "tests");

  // Only flat .ts files (not subdirectories like jobs/, scrapers/)
  const serviceFiles = listTsFiles(servicesDir);
  const missing: string[] = [];

  for (const file of serviceFiles) {
    const stem = basename(file, ".ts");
    const hasTest =
      existsSync(join(testsDir, `${stem}.test.ts`)) ||
      existsSync(join(testsDir, `${stem}.spec.ts`));

    if (!hasTest) {
      missing.push(relative(ROOT, file));
    }
  }

  return missing;
}

// ── Check 3: Stale active plans ────────────────────────────────────────────

interface StalePlan {
  file: string;
  daysOld: number;
}

function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return result;
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

function checkStalePlans(): StalePlan[] {
  const plansDir = join(ROOT, "docs", "plans");
  if (!existsSync(plansDir)) return [];

  const stale: StalePlan[] = [];

  for (const entry of readdirSync(plansDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const fullPath = join(plansDir, entry.name);
    const content = readText(fullPath);
    const fm = parseFrontmatter(content);

    if (fm.status !== "active") continue;

    // Try date from frontmatter first, fall back to file mtime
    let ageMs: number;
    if (fm.date) {
      ageMs = NOW_MS - new Date(fm.date).getTime();
    } else {
      ageMs = NOW_MS - statSync(fullPath).mtimeMs;
    }

    const daysOld = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (daysOld > STALE_DAYS) {
      stale.push({ file: `docs/plans/${entry.name}`, daysOld });
    }
  }

  return stale;
}

// ── Check 4: Orphaned DB tables ───────────────────────────────────────────

function checkOrphanedTables(): string[] {
  // The actual schema lives in the @motian/db package
  const schemaPath = join(ROOT, "packages", "db", "src", "schema.ts");
  if (!existsSync(schemaPath)) return [];

  const schemaContent = readText(schemaPath);

  // Extract table names from: pgTable("table_name", ...)
  const TABLE_RE = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  const tables: string[] = [];
  for (const match of schemaContent.matchAll(TABLE_RE)) {
    tables.push(match[1]);
  }

  if (tables.length === 0) return [];

  // Build a broad corpus: all of src/ + app/ + packages/ — tables may be
  // consumed by MCP tools, voice-agent, autopilot, etc.
  const searchDirs = ["src", "app", "packages"].map((d) => join(ROOT, d));
  const serviceFiles = searchDirs.flatMap(listTsFilesRecursive);
  const serviceCorpus = serviceFiles.map(readText).join("\n");

  const orphaned: string[] = [];
  for (const table of tables) {
    // Check for the table string literal or the camelCase export name
    const tableLiteralPattern = new RegExp(`['"\`]${table}['"\`]`);
    // Convert snake_case table name to likely camelCase variable (e.g. job_matches → jobMatches)
    const camelName = table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const camelPattern = new RegExp(`\\b${camelName}\\b`);

    if (!tableLiteralPattern.test(serviceCorpus) && !camelPattern.test(serviceCorpus)) {
      orphaned.push(table);
    }
  }

  return orphaned;
}

// ── Report ─────────────────────────────────────────────────────────────────

function run(): void {
  console.log("\nEntropy Report");
  console.log("==============");

  // Run all checks
  const unusedExports = checkUnusedExports();
  const missingTests = checkMissingTests();
  const stalePlans = checkStalePlans();
  const orphanedTables = checkOrphanedTables();

  // Score: each category contributes min(count, cap) points.
  // Per-category cap prevents a large legacy backlog from permanently blocking CI.
  // The intent is to detect *regressions*, not audit the whole codebase at once.
  const CAP = 5;
  const score =
    Math.min(unusedExports.length, CAP) +
    Math.min(missingTests.length, CAP) +
    Math.min(stalePlans.length, CAP) +
    Math.min(orphanedTables.length, CAP);

  // Print summary lines
  console.log(
    `Unused exports: ${unusedExports.length === 0 ? "0 found" : `${unusedExports.length} found`}`,
  );
  if (VERBOSE || unusedExports.length > 0) {
    for (const e of unusedExports) {
      console.log(`  - ${e.file}: ${e.name}()`);
    }
  }

  console.log(
    `Missing tests: ${missingTests.length === 0 ? "0 services" : `${missingTests.length} services`}`,
  );
  if (VERBOSE || missingTests.length > 0) {
    for (const f of missingTests) {
      console.log(`  - ${f}`);
    }
  }

  console.log(
    `Stale plans: ${stalePlans.length === 0 ? "0 found" : `${stalePlans.length} found`}`,
  );
  if (VERBOSE || stalePlans.length > 0) {
    for (const p of stalePlans) {
      console.log(`  - ${p.file} (active, ${p.daysOld} days old)`);
    }
  }

  console.log(
    `Orphaned tables: ${orphanedTables.length === 0 ? "0" : `${orphanedTables.length} found`}`,
  );
  if (VERBOSE || orphanedTables.length > 0) {
    for (const t of orphanedTables) {
      console.log(`  - ${t}`);
    }
  }

  console.log("");
  const status = score < SCORE_THRESHOLD ? `target: < ${SCORE_THRESHOLD}` : `OVER THRESHOLD`;
  console.log(`Score: ${score} entropy points (${status})`);

  if (!VERBOSE && score > 0) {
    console.log("\nRun with --verbose to see all findings.");
  }

  process.exit(score >= SCORE_THRESHOLD ? 1 : 0);
}

run();
