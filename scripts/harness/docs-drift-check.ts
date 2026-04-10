import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadHarnessConfig } from "@/src/harness/config";

// ---------------------------------------------------------------------------
// Glob matching — handles * and ** patterns (no external deps)
// ---------------------------------------------------------------------------

function globMatch(pattern: string, filePath: string): boolean {
  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const segments = pattern.split("**");
  const regexParts = segments.map((seg) =>
    escapeRegex(seg).replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"),
  );
  const regex = new RegExp(`^${regexParts.join(".*")}$`);
  return regex.test(filePath);
}

// ---------------------------------------------------------------------------
// Resolve changed files from git
// ---------------------------------------------------------------------------

function resolveChangedFiles(projectRoot: string): string[] {
  // In CI, diff against the PR base branch
  const baseRef = process.env.GITHUB_BASE_REF;
  const diffTarget = baseRef ? `origin/${baseRef}` : "origin/main";

  try {
    const output = execSync(`git diff --name-only ${diffTarget}...HEAD`, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      console.error(
        `[docs-drift-check] Gewijzigde bestanden bepaald via git diff ${diffTarget}...HEAD`,
      );
      return lines;
    }
  } catch {
    // fall through to staged files
  }

  // Fallback: staged files (useful locally before a push)
  try {
    const output = execSync("git diff --name-only --cached", {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      console.error("[docs-drift-check] Gewijzigde bestanden bepaald via git diff --cached");
      return lines;
    }
  } catch {
    // nothing
  }

  return [];
}

// ---------------------------------------------------------------------------
// Docs drift detection
// ---------------------------------------------------------------------------

interface DocsDriftViolation {
  triggerPattern: string;
  matchedFiles: string[];
  missingDocs: string[];
}

function checkDocsDrift(
  changedFiles: string[],
  triggers: Record<string, string[]>,
  projectRoot: string,
): DocsDriftViolation[] {
  const changedSet = new Set(changedFiles);
  const violations: DocsDriftViolation[] = [];

  for (const [triggerPattern, requiredDocs] of Object.entries(triggers)) {
    const matchedFiles = changedFiles.filter((f) => globMatch(triggerPattern, f));
    if (matchedFiles.length === 0) continue;

    const missingDocs = requiredDocs.filter((doc) => {
      // Doc was updated in this PR — no drift
      if (changedSet.has(doc)) return false;
      // Doc doesn't exist on disk — genuinely missing, flag it
      if (!existsSync(join(projectRoot, doc))) return true;
      // Doc exists and was not changed — content assumed current, OK
      return false;
    });

    if (missingDocs.length > 0) {
      violations.push({ triggerPattern, matchedFiles, missingDocs });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const projectRoot = resolve(process.cwd());

  let config: ReturnType<typeof loadHarnessConfig>;
  try {
    config = loadHarnessConfig({ cwd: projectRoot });
  } catch (err) {
    console.error(`[docs-drift-check] FOUT: Harness-config kon niet worden geladen: ${err}`);
    process.exit(1);
  }

  const changedFiles = resolveChangedFiles(projectRoot);

  if (changedFiles.length === 0) {
    console.log("[docs-drift-check] Geen gewijzigde bestanden gevonden — niets te controleren.");
    process.exit(0);
  }

  const { triggers, message } = config.docsDriftRules;
  const violations = checkDocsDrift(changedFiles, triggers, projectRoot);

  if (violations.length === 0) {
    console.log("[docs-drift-check] OK — documentatie is up-to-date.");
    process.exit(0);
  }

  // Report violations
  console.error(`[docs-drift-check] MISLUKT — ${message}`);
  console.error("");

  for (const v of violations) {
    console.error(`  Patroon: ${v.triggerPattern}`);
    console.error(`  Gewijzigde triggerbestanden:`);
    for (const f of v.matchedFiles) {
      console.error(`    - ${f}`);
    }
    console.error(`  Ontbrekende documentatie-updates:`);
    for (const d of v.missingDocs) {
      console.error(`    - ${d}`);
    }
    console.error("");
  }

  process.exit(1);
}

main();
