/**
 * Structural tests — architectural constraint enforcement for Motian recruitment platform.
 *
 * These tests are fast (no DB, no network). They scan the file system and source
 * text to guarantee invariants hold across the codebase. Run as part of CI on
 * every PR.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../..");

function resolveFromRoot(...segments: string[]): string {
  return path.join(ROOT, ...segments);
}

/**
 * Recursively collect all files under `dir` that match the given extension
 * list (e.g. ['.ts', '.tsx']).
 */
function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, dist at any depth
      if (["node_modules", ".next", "dist", ".git"].includes(entry.name)) {
        continue;
      }
      results.push(...collectFiles(full, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Read file as UTF-8 string, returning empty string if the file does not exist.
 */
function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Extract all import paths from a TypeScript/TSX source file.
 * Handles:
 *   import ... from '...'
 *   import ... from "..."
 *   require('...')  /  require("...")
 */
function extractImports(source: string): string[] {
  const imports: string[] = [];

  // Static import declarations: import X from '...'  /  import '...'
  const staticImportRe = /from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(staticImportRe)) {
    imports.push(match[1]);
  }

  // Dynamic imports: import('...')
  const dynamicImportRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(dynamicImportRe)) {
    imports.push(match[1]);
  }

  // require('...')
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(requireRe)) {
    imports.push(match[1]);
  }

  return imports;
}

// ---------------------------------------------------------------------------
// 1. Risk contract validity
// ---------------------------------------------------------------------------

describe("Risk contract (harness.config.json)", () => {
  const configPath = resolveFromRoot("harness.config.json");

  it("exists at project root", () => {
    expect(
      fs.existsSync(configPath),
      `Expected harness.config.json to exist at ${configPath}`,
    ).toBe(true);
  });

  it("parses as valid JSON", () => {
    const raw = readFile(configPath);
    expect(() => JSON.parse(raw), "harness.config.json must be valid JSON").not.toThrow();
  });

  it("has required top-level fields: version, riskTierRules, mergePolicy, docsDriftRules", () => {
    const config = JSON.parse(readFile(configPath));

    expect(config).toHaveProperty("version");
    expect(config).toHaveProperty("riskTierRules");
    expect(config).toHaveProperty("mergePolicy");
    expect(config).toHaveProperty("docsDriftRules");
  });

  it("riskTierRules has high, medium, and low tiers", () => {
    const { riskTierRules } = JSON.parse(readFile(configPath));

    expect(riskTierRules).toHaveProperty("high");
    expect(riskTierRules).toHaveProperty("medium");
    expect(riskTierRules).toHaveProperty("low");

    expect(Array.isArray(riskTierRules.high)).toBe(true);
    expect(Array.isArray(riskTierRules.medium)).toBe(true);
    expect(Array.isArray(riskTierRules.low)).toBe(true);
  });

  it("mergePolicy has required check lists for each tier", () => {
    const { mergePolicy } = JSON.parse(readFile(configPath));

    for (const tier of ["high", "medium", "low"] as const) {
      expect(mergePolicy, `mergePolicy must have '${tier}' key`).toHaveProperty(tier);
      expect(
        Array.isArray(mergePolicy[tier].requiredChecks),
        `mergePolicy.${tier}.requiredChecks must be an array`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Dependency direction
//    UI components (components/) must NOT import directly from src/db/.
// ---------------------------------------------------------------------------

describe("Dependency direction", () => {
  const componentsDir = resolveFromRoot("components");

  it("components/ files do not import directly from src/db/", () => {
    const componentFiles = collectFiles(componentsDir, [".ts", ".tsx"]);

    const violations: string[] = [];

    for (const file of componentFiles) {
      const source = readFile(file);
      const imports = extractImports(source);

      for (const imp of imports) {
        // Detect any import that resolves to src/db — relative or alias-based
        const isDbImport =
          imp.includes("/db/") ||
          imp.includes('/db"') ||
          imp.endsWith("/db") ||
          imp === "@/db" ||
          imp.startsWith("@/db/");

        if (isDbImport) {
          violations.push(`${path.relative(ROOT, file)}: imports '${imp}'`);
        }
      }
    }

    expect(
      violations,
      `UI components must not import from src/db/. Violations:\n${violations.join("\n")}`,
    ).toHaveLength(0);
  });

  it("src/services/ files are allowed to import from src/db/", () => {
    // This is a positive check — services/ should be importing from db.
    const servicesDir = resolveFromRoot("src", "services");
    const serviceFiles = collectFiles(servicesDir, [".ts"]);

    const filesWithDbImport = serviceFiles.filter((file) => {
      const imports = extractImports(readFile(file));
      return imports.some(
        (imp) => imp.includes("/db") || imp === "@/db" || imp.startsWith("@/db/"),
      );
    });

    // At least one service must use the DB (sanity check that services are actually connected)
    expect(
      filesWithDbImport.length,
      "Expected at least one service to import from src/db/",
    ).toBeGreaterThan(0);
  });

  it("src/ai/ files do not import directly from src/db/ (should go through services)", () => {
    const aiDir = resolveFromRoot("src", "ai");
    if (!fs.existsSync(aiDir)) return; // Skip if ai dir doesn't exist yet

    const aiFiles = collectFiles(aiDir, [".ts", ".tsx"]);

    // Known exceptions: AI tool files that currently bypass the service layer.
    // These are tracked as tech-debt — remove entries as each is refactored.
    const KNOWN_EXCEPTIONS = new Set([
      "src/ai/tools/analyse-data.ts",
      "src/ai/tools/trigger-scraper.ts",
    ]);

    const violations: string[] = [];

    for (const file of aiFiles) {
      const relativePath = path.relative(ROOT, file);
      if (KNOWN_EXCEPTIONS.has(relativePath)) continue;

      const imports = extractImports(readFile(file));
      for (const imp of imports) {
        // Detect import paths that resolve to src/db — handles:
        //   @/src/db, @/src/db/schema, @/db, @/db/schema, ../db, ../../db
        const isDbImport =
          imp === "@/db" ||
          imp.startsWith("@/db/") ||
          imp === "@/src/db" ||
          imp.startsWith("@/src/db/") ||
          /[/\\]db(?:[/\\]|$)/.test(imp);

        if (isDbImport) {
          violations.push(`${relativePath}: imports '${imp}'`);
        }
      }
    }

    expect(
      violations,
      `src/ai/ files (outside known exceptions) must not import directly from src/db/.\nUse the services layer instead.\nViolations:\n${violations.join("\n")}\n\nNote: Known exceptions are tracked in KNOWN_EXCEPTIONS set above.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Service export contracts
// ---------------------------------------------------------------------------

describe("Service export contracts", () => {
  const servicesDir = resolveFromRoot("src", "services");

  it("every file in src/services/ exports at least one symbol", () => {
    const serviceFiles = collectFiles(servicesDir, [".ts"]);
    expect(serviceFiles.length, "Expected at least one service file").toBeGreaterThan(0);

    const filesWithNoExport: string[] = [];

    for (const file of serviceFiles) {
      const source = readFile(file);
      // Match any of:
      //   export function / export async function / export const / export class / export type
      //   export { Foo } from '...'  (re-export barrel)
      //   export * from '...'  (re-export all)
      const hasExport =
        /^export\s+(async\s+function|function|const|class|type|interface|enum)\s+\w+/m.test(
          source,
        ) ||
        /^export\s+\{[^}]+\}\s+from\s+['"]/m.test(source) ||
        /^export\s+\*\s+from\s+['"]/m.test(source);

      if (!hasExport) {
        filesWithNoExport.push(path.relative(ROOT, file));
      }
    }

    expect(
      filesWithNoExport,
      `Service files with no exports:\n${filesWithNoExport.join("\n")}`,
    ).toHaveLength(0);
  });

  it("src/services/jobs.ts exports hybridSearch, listJobs, getJobById", () => {
    const jobsPath = resolveFromRoot("src", "services", "jobs.ts");
    expect(fs.existsSync(jobsPath), `${jobsPath} must exist`).toBe(true);

    const source = readFile(jobsPath);

    for (const fnName of ["hybridSearch", "listJobs", "getJobById"]) {
      expect(source, `jobs.ts must export '${fnName}'`).toMatch(
        new RegExp(`export\\s+(async\\s+)?function\\s+${fnName}\\b`),
      );
    }
  });

  it("src/services/scoring.ts exports computeMatchScore", () => {
    const scoringPath = resolveFromRoot("src", "services", "scoring.ts");
    expect(fs.existsSync(scoringPath), `${scoringPath} must exist`).toBe(true);

    const source = readFile(scoringPath);
    expect(source).toMatch(/export\s+(async\s+)?function\s+computeMatchScore\b/);
  });

  it("src/services/gdpr.ts exports at least 2 functions", () => {
    const gdprPath = resolveFromRoot("src", "services", "gdpr.ts");
    expect(fs.existsSync(gdprPath), `${gdprPath} must exist`).toBe(true);

    const source = readFile(gdprPath);
    const matches = source.match(/^export\s+(async\s+)?function\s+\w+/gm);

    expect(matches?.length ?? 0, "gdpr.ts must export at least 2 functions").toBeGreaterThanOrEqual(
      2,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Zod schema coverage
// ---------------------------------------------------------------------------

describe("Zod schema coverage", () => {
  const schemasDir = resolveFromRoot("src", "schemas");

  it("every file in src/schemas/ exports at least one Zod schema", () => {
    const schemaFiles = collectFiles(schemasDir, [".ts"]);
    expect(schemaFiles.length, "Expected at least one schema file").toBeGreaterThan(0);

    const filesWithNoSchema: string[] = [];

    for (const file of schemaFiles) {
      const source = readFile(file);

      // A Zod schema export looks like:
      //   export const fooSchema = z.object(...)
      //   export const bar = z.string()
      //   export const baz = z.array(...)
      // We also accept re-exports of z types.
      const hasZodExport =
        /export\s+const\s+\w+\s*=\s*z\.(object|string|number|boolean|array|union|enum|discriminatedUnion|intersection|record|tuple|literal|date|any|unknown|null|undefined|void|never|optional|nullable)\s*[(<(]/.test(
          source,
        ) ||
        // Simpler catch-all: any export that references z. on the right-hand side
        /export\s+const\s+\w+\s*=\s*z\./.test(source);

      if (!hasZodExport) {
        filesWithNoSchema.push(path.relative(ROOT, file));
      }
    }

    expect(
      filesWithNoSchema,
      `Schema files with no Zod schema exports:\n${filesWithNoSchema.join("\n")}`,
    ).toHaveLength(0);
  });

  it("src/schemas/ files import from zod", () => {
    const schemaFiles = collectFiles(schemasDir, [".ts"]);

    const filesWithoutZod = schemaFiles.filter((file) => {
      const source = readFile(file);
      const imports = extractImports(source);
      return !imports.some((imp) => imp === "zod" || imp.startsWith("zod/"));
    });

    expect(
      filesWithoutZod.map((f) => path.relative(ROOT, f)),
      "All schema files must import from 'zod'",
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. No hardcoded secrets
// ---------------------------------------------------------------------------

describe("No hardcoded secrets", () => {
  /**
   * Patterns that indicate hardcoded secrets.
   * We intentionally avoid false positives — we match:
   *   - Assignments to known secret variable names with a string value longer than 16 chars
   *   - Connection string prefixes (postgres://, postgresql://, mysql://, mongodb://)
   *   - OpenAI / ElevenLabs / similar key patterns
   */
  const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    {
      name: "Postgres connection string",
      pattern: /postgres(?:ql)?:\/\/[^${"'`\s]{8,}/,
    },
    {
      name: "MySQL connection string",
      pattern: /mysql:\/\/[^${"'`\s]{8,}/,
    },
    {
      name: "MongoDB connection string",
      pattern: /mongodb(?:\+srv)?:\/\/[^${"'`\s]{8,}/,
    },
    {
      name: "OpenAI API key (sk-...)",
      // Starts with sk- and is at least 20 chars — avoid matching short test strings
      pattern: /['"` ]sk-[A-Za-z0-9_-]{20,}['"` ]/,
    },
    {
      name: "Generic hardcoded password assignment",
      // password = "..." or PASSWORD = "..." with actual value (not env var reference)
      pattern: /password\s*=\s*['"][^${'"`\s]{8,}['"]/i,
    },
    {
      name: "Generic hardcoded secret/api_key assignment",
      pattern: /(secret|api_key|apikey|access_token)\s*=\s*['"][^${'"`\s]{8,}['"]/i,
    },
  ];

  const srcDir = resolveFromRoot("src");
  const srcFiles = collectFiles(srcDir, [".ts", ".tsx"]);

  for (const { name, pattern } of SECRET_PATTERNS) {
    it(`no ${name} found in src/`, () => {
      const violations: string[] = [];

      for (const file of srcFiles) {
        const source = readFile(file);
        // Strip single-line comments before scanning
        const stripped = source.replace(/\/\/[^\n]*/g, "");

        if (pattern.test(stripped)) {
          // Find which line(s) matched for a helpful error message
          const lines = stripped.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
      }

      expect(
        violations,
        `Hardcoded secret pattern "${name}" found:\n${violations.join("\n")}`,
      ).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 6. Encryption for sensitive data
// ---------------------------------------------------------------------------

describe("Encryption for sensitive data", () => {
  it("src/services/scrapers.ts imports from crypto.ts (credentials are encrypted)", () => {
    const scrapersPath = resolveFromRoot("src", "services", "scrapers.ts");
    if (!fs.existsSync(scrapersPath)) {
      // If the file doesn't exist, skip gracefully
      return;
    }

    const source = readFile(scrapersPath);
    const imports = extractImports(source);

    const importsCrypto = imports.some(
      (imp) =>
        imp.includes("crypto") &&
        (imp.includes("/lib/") || imp.startsWith("@/lib/") || imp.includes("../lib")),
    );

    expect(
      importsCrypto,
      "scrapers.ts handles credentials and must import encryption utilities from lib/crypto",
    ).toBe(true);
  });

  it("src/lib/crypto.ts exists and exports encrypt and decrypt", () => {
    const cryptoPath = resolveFromRoot("src", "lib", "crypto.ts");
    expect(fs.existsSync(cryptoPath), `${cryptoPath} must exist`).toBe(true);

    const source = readFile(cryptoPath);

    expect(source, "crypto.ts must export 'encrypt'").toMatch(
      /export\s+(async\s+)?function\s+encrypt\b|export\s+const\s+encrypt\s*=/,
    );
    expect(source, "crypto.ts must export 'decrypt'").toMatch(
      /export\s+(async\s+)?function\s+decrypt\b|export\s+const\s+decrypt\s*=/,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Dutch naming in API routes
// ---------------------------------------------------------------------------

describe("Dutch naming in API routes", () => {
  /**
   * English words that should not appear as API route segment names.
   * Each entry is a full path segment (directory name) that would indicate
   * English naming instead of the Dutch equivalents.
   *
   * Note: 'interviews' and 'matches' are internationally accepted loanwords
   * in Dutch (common in recruitment context) and are intentionally omitted.
   */
  const DISALLOWED_ENGLISH_SEGMENTS = [
    "jobs",
    "health",
    "applications",
    "messages",
    "scrapers",
    "scrape-results",
    "scraper-configurations",
    "scraper-config",
    "orders",
    "appointments",
  ];

  const apiDir = resolveFromRoot("app", "api");

  it("app/api/ directory exists", () => {
    expect(fs.existsSync(apiDir), `Expected app/api/ directory to exist at ${apiDir}`).toBe(true);
  });

  it("all app/api/ route segments use Dutch naming (no English equivalents)", () => {
    if (!fs.existsSync(apiDir)) return;

    // Collect all directory names under app/api/ recursively
    function collectDirNames(dir: string): string[] {
      const names: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Dynamic segments like [id] are fine — strip brackets for checking
          const segmentName = entry.name.replace(/^\[/, "").replace(/\]$/, "");
          names.push(segmentName);
          names.push(...collectDirNames(path.join(dir, entry.name)));
        }
      }
      return names;
    }

    const allSegments = collectDirNames(apiDir);
    const violations: string[] = [];

    for (const segment of allSegments) {
      if (DISALLOWED_ENGLISH_SEGMENTS.includes(segment.toLowerCase())) {
        violations.push(`English route segment found: '${segment}'`);
      }
    }

    expect(
      violations,
      `API routes must use Dutch naming conventions.\nViolations:\n${violations.join("\n")}\n\nExpected Dutch equivalents: opdrachten, gezondheid, sollicitaties, berichten, matches, interviews, scrapers→scraper-configuraties`,
    ).toHaveLength(0);
  });

  it("known Dutch API route directories exist", () => {
    const expectedDutchRoutes = ["opdrachten", "gezondheid"];

    const missing: string[] = [];
    for (const route of expectedDutchRoutes) {
      const routePath = path.join(apiDir, route);
      if (!fs.existsSync(routePath)) {
        missing.push(route);
      }
    }

    expect(missing, `Expected Dutch API routes to exist: ${missing.join(", ")}`).toHaveLength(0);
  });
});
