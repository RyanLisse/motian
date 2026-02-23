import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskTier = "high" | "medium" | "low";

interface MergePolicyEntry {
  requiredChecks: string[];
  requireCodeReview: boolean;
}

interface HarnessConfig {
  version: string;
  riskTierRules: Record<RiskTier, string[]>;
  mergePolicy: Record<RiskTier, MergePolicyEntry>;
  docsDriftRules: {
    triggers: Record<string, string[]>;
    message: string;
  };
  evidenceRequirements?: Record<string, string>;
  harnessGap?: {
    slaHours: number;
    labelPrefix: string;
  };
}

interface FileTierResult {
  file: string;
  tier: RiskTier;
}

interface DocsDriftViolation {
  triggerFile: string;
  requiredDocs: string[];
  missingDocs: string[];
}

interface GateResult {
  overallTier: RiskTier;
  requiredChecks: string[];
  docsDriftPass: boolean;
  docsDriftViolations: DocsDriftViolation[];
  fileTiers: FileTierResult[];
  counts: Record<RiskTier, number>;
}

// ---------------------------------------------------------------------------
// Glob matching (no external deps — handles * and ** patterns)
// ---------------------------------------------------------------------------

function globMatch(pattern: string, filePath: string): boolean {
  // Escape special regex chars except * and ?
  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

  // Split on ** first, preserving the separator intent
  const segments = pattern.split("**");
  const regexParts = segments.map((seg) => {
    // Within a segment, replace * with [^/]* and ? with [^/]
    return escapeRegex(seg).replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  });

  // Join segments with .*  (** matches any path including slashes)
  const regexStr = `^${regexParts.join(".*")}$`;
  const regex = new RegExp(regexStr);
  return regex.test(filePath);
}

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

const TIER_ORDER: RiskTier[] = ["high", "medium", "low"];

function classifyFile(file: string, rules: HarnessConfig["riskTierRules"]): RiskTier {
  for (const tier of TIER_ORDER) {
    const patterns = rules[tier] ?? [];
    for (const pattern of patterns) {
      if (globMatch(pattern, file)) {
        return tier;
      }
    }
  }
  return "low";
}

function highestTier(tiers: RiskTier[]): RiskTier {
  for (const tier of TIER_ORDER) {
    if (tiers.includes(tier)) return tier;
  }
  return "low";
}

// ---------------------------------------------------------------------------
// Docs drift check
// ---------------------------------------------------------------------------

function checkDocsDrift(
  changedFiles: string[],
  triggers: Record<string, string[]>,
  projectRoot: string,
): DocsDriftViolation[] {
  const violations: DocsDriftViolation[] = [];
  const changedSet = new Set(changedFiles);

  for (const [triggerPattern, requiredDocs] of Object.entries(triggers)) {
    // Find changed files that match this trigger pattern
    const matchingChanged = changedFiles.filter((f) => globMatch(triggerPattern, f));
    if (matchingChanged.length === 0) continue;

    const missingDocs = requiredDocs.filter((doc) => {
      // Doc was updated in this PR — no drift
      if (changedSet.has(doc)) return false;
      // Doc doesn't exist on disk at all — truly missing
      if (!existsSync(join(projectRoot, doc))) return true;
      // Doc exists and wasn't changed — acceptable (content is current)
      return false;
    });

    if (missingDocs.length > 0) {
      // Group by trigger pattern, listing all matched trigger files
      violations.push({
        triggerFile: matchingChanged.join(", "),
        requiredDocs,
        missingDocs,
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Input: read changed files from args | stdin | git
// ---------------------------------------------------------------------------

async function resolveChangedFiles(): Promise<string[]> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  if (args.length > 0) {
    return args;
  }

  // Check if stdin has data (non-TTY)
  if (!process.stdin.isTTY) {
    const stdinData = await new Promise<string>((res) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => (buf += chunk));
      process.stdin.on("end", () => res(buf));
    });
    const lines = stdinData
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) return lines;
  }

  // Fall back to git
  try {
    const output = execSync("git diff --name-only HEAD~1", { encoding: "utf8" });
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      console.error("[risk-policy-gate] Auto-detected changed files from git diff HEAD~1");
      return lines;
    }
  } catch {
    // git might fail in shallow clones or fresh repos
    try {
      const output = execSync("git diff --name-only --cached", { encoding: "utf8" });
      const lines = output
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        console.error("[risk-policy-gate] Auto-detected changed files from git diff --cached");
        return lines;
      }
    } catch {
      // nothing to do
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// GitHub Actions output
// ---------------------------------------------------------------------------

function setGitHubOutputs(tier: RiskTier, requiredChecks: string[]): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  appendFileSync(outputFile, `risk-tier=${tier}\n`);
  appendFileSync(outputFile, `required-checks=${requiredChecks.join(",")}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const projectRoot = resolve(process.cwd());
  const configPath = join(projectRoot, "harness.config.json");

  if (!existsSync(configPath)) {
    console.error(`[risk-policy-gate] ERROR: harness.config.json not found at ${configPath}`);
    process.exit(1);
  }

  let config: HarnessConfig;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8")) as HarnessConfig;
  } catch (err) {
    console.error(`[risk-policy-gate] ERROR: Failed to parse harness.config.json: ${err}`);
    process.exit(1);
  }

  const changedFiles = await resolveChangedFiles();

  if (changedFiles.length === 0) {
    console.log("Risk Tier: low");
    console.log(`Required Checks: ${config.mergePolicy.low.requiredChecks.join(", ")}`);
    console.log("Docs Drift: PASS");
    console.log("Changed Files: 0 (0 high, 0 medium, 0 low)");
    setGitHubOutputs("low", config.mergePolicy.low.requiredChecks);
    return;
  }

  // Classify each file
  const fileTiers: FileTierResult[] = changedFiles.map((file) => ({
    file,
    tier: classifyFile(file, config.riskTierRules),
  }));

  // Compute counts and overall tier
  const counts: Record<RiskTier, number> = { high: 0, medium: 0, low: 0 };
  for (const { tier } of fileTiers) {
    counts[tier]++;
  }

  const overallTier = highestTier(fileTiers.map((f) => f.tier));
  const requiredChecks = config.mergePolicy[overallTier].requiredChecks;

  // Docs drift
  const violations = checkDocsDrift(changedFiles, config.docsDriftRules.triggers, projectRoot);
  const docsDriftPass = violations.length === 0;

  const result: GateResult = {
    overallTier,
    requiredChecks,
    docsDriftPass,
    docsDriftViolations: violations,
    fileTiers,
    counts,
  };

  // ---------------------------------------------------------------------------
  // JSON output mode (for CI workflows)
  // ---------------------------------------------------------------------------

  if (process.argv.includes("--json")) {
    const jsonOut = JSON.stringify({
      tier: result.overallTier,
      requiredChecks: result.requiredChecks,
      docsDriftPass: result.docsDriftPass,
      counts: result.counts,
      totalFiles: changedFiles.length,
    });
    console.log(jsonOut);
    setGitHubOutputs(result.overallTier, result.requiredChecks);
    if (!result.docsDriftPass) process.exit(1);
    return;
  }

  // ---------------------------------------------------------------------------
  // Plain-text output
  // ---------------------------------------------------------------------------

  console.log(`Risk Tier: ${result.overallTier}`);
  console.log(`Required Checks: ${result.requiredChecks.join(", ")}`);

  if (result.docsDriftPass) {
    console.log("Docs Drift: PASS");
  } else {
    console.log("Docs Drift: FAIL");
    for (const v of result.docsDriftViolations) {
      console.log(`  - Trigger: ${v.triggerFile}`);
      console.log(`    Missing doc updates: ${v.missingDocs.join(", ")}`);
    }
    console.log(`  Message: ${config.docsDriftRules.message}`);
  }

  console.log(
    `Changed Files: ${changedFiles.length} (${counts.high} high, ${counts.medium} medium, ${counts.low} low)`,
  );

  // Optional verbose breakdown
  if (process.argv.includes("--verbose")) {
    console.log("\nFile Breakdown:");
    for (const { file, tier } of result.fileTiers) {
      console.log(`  [${tier.padEnd(6)}] ${file}`);
    }
  }

  // GitHub Actions
  setGitHubOutputs(result.overallTier, result.requiredChecks);

  // Exit code
  if (!result.docsDriftPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[risk-policy-gate] Unhandled error: ${err}`);
  process.exit(1);
});
