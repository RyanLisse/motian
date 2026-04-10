import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type HarnessConfig, loadHarnessConfig } from "@/src/harness/config";
import { executeHarnessCommand } from "@/src/harness/runtime";

type RiskTier = "high" | "medium" | "low";
type GateCheckStatus = "passed" | "failed" | "skipped" | "missing";
type GateCheckSource = "provided" | "executed" | "self";

interface FileTierResult {
  file: string;
  tier: RiskTier;
}

interface DocsDriftViolation {
  triggerFile: string;
  requiredDocs: string[];
  missingDocs: string[];
}

interface GateCheckCommand {
  args: string[];
  command: string;
  env?: Record<string, string | undefined>;
}

interface GateCheckResult {
  commandLine?: string;
  detail?: string;
  durationMs?: number;
  exitCode?: number | null;
  name: string;
  required: boolean;
  source: GateCheckSource;
  status: GateCheckStatus;
  stderrPath?: string;
  stderrTail?: string;
  stdoutPath?: string;
  stdoutTail?: string;
}

interface CliOptions {
  baseRef?: string;
  changedFiles: string[];
  checkResults: Map<string, GateCheckStatus>;
  cwd?: string;
  json: boolean;
  noExecuteChecks: boolean;
  verbose: boolean;
}

interface GateResult {
  changedFiles: string[];
  checkResults: GateCheckResult[];
  counts: Record<RiskTier, number>;
  docsDriftPass: boolean;
  docsDriftViolations: DocsDriftViolation[];
  failedRequiredChecks: string[];
  fileTiers: FileTierResult[];
  missingRequiredChecks: string[];
  passed: boolean;
  requireCodeReview: boolean;
  requiredChecks: string[];
  tier: RiskTier;
  totalFiles: number;
}

const CHECK_COMMANDS: Record<string, GateCheckCommand> = {
  "browser-evidence": {
    args: ["harness:browser-evidence"],
    command: "pnpm",
  },
  lint: {
    args: ["lint"],
    command: "pnpm",
  },
  test: {
    args: ["test"],
    command: "pnpm",
  },
  typecheck: {
    args: ["exec", "tsc", "--noEmit"],
    command: "pnpm",
  },
};

const TIER_ORDER: RiskTier[] = ["high", "medium", "low"];

function isMainModule(): boolean {
  return (
    process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])
  );
}

function slugifyCheckName(name: string): string {
  return (
    name
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "check"
  );
}

function readArgValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;

  return value;
}

function parseProvidedCheckStatus(rawStatus: string): GateCheckStatus {
  const normalized = rawStatus.trim().toLowerCase();

  if (["passed", "pass", "success", "succeeded", "ok", "true"].includes(normalized)) {
    return "passed";
  }

  if (["failed", "failure", "error", "cancelled", "canceled", "timed_out"].includes(normalized)) {
    return "failed";
  }

  if (["skipped", "skip", "neutral"].includes(normalized)) {
    return "skipped";
  }

  if (["missing", "absent"].includes(normalized)) {
    return "missing";
  }

  throw new Error(
    `[risk-policy-gate] Ongeldige checkstatus "${rawStatus}". Gebruik passed, failed, skipped of missing.`,
  );
}

function parseCheckResultArgument(value: string): [string, GateCheckStatus] {
  const [name, rawStatus] = value.split("=", 2);

  if (!name || !rawStatus) {
    throw new Error(
      `[risk-policy-gate] Ongeldige --check-result "${value}". Verwacht <naam>=<status>.`,
    );
  }

  return [name.trim(), parseProvidedCheckStatus(rawStatus)];
}

function parseCliOptions(argv = process.argv.slice(2)): CliOptions {
  const changedFiles: string[] = [];
  const checkResults = new Map<string, GateCheckStatus>();

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--json" || arg === "--verbose" || arg === "--no-execute-checks") {
      continue;
    }

    if (arg === "--cwd" || arg === "--base-ref" || arg === "--check-result") {
      index++;
      continue;
    }

    if (arg.startsWith("--check-result=")) {
      const [name, status] = parseCheckResultArgument(arg.slice("--check-result=".length));
      checkResults.set(name, status);
      continue;
    }

    if (!arg.startsWith("--")) {
      changedFiles.push(arg);
    }
  }

  for (let index = 0; index < argv.length; index++) {
    if (argv[index] !== "--check-result") continue;

    const value = argv[index + 1];
    if (!value) {
      throw new Error("[risk-policy-gate] --check-result vereist een waarde.");
    }

    const [name, status] = parseCheckResultArgument(value);
    checkResults.set(name, status);
  }

  return {
    baseRef: readArgValue(argv, "--base-ref") ?? process.env.HARNESS_BASE_REF,
    changedFiles,
    checkResults,
    cwd: readArgValue(argv, "--cwd"),
    json: argv.includes("--json"),
    noExecuteChecks: argv.includes("--no-execute-checks"),
    verbose: argv.includes("--verbose"),
  };
}

export function globMatch(pattern: string, filePath: string): boolean {
  const escapeRegex = (value: string) => value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const segments = pattern.split("**");
  const regexParts = segments.map((segment) =>
    escapeRegex(segment).replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"),
  );

  return new RegExp(`^${regexParts.join(".*")}$`).test(filePath);
}

export function classifyFile(file: string, rules: HarnessConfig["riskTierRules"]): RiskTier {
  for (const tier of TIER_ORDER) {
    const patterns = rules[tier] ?? [];
    if (patterns.some((pattern) => globMatch(pattern, file))) {
      return tier;
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

function readLinesFromStdIn(): Promise<string[]> {
  return new Promise((resolveLines) => {
    if (process.stdin.isTTY) {
      resolveLines([]);
      return;
    }

    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => {
      resolveLines(
        buffer
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      );
    });
  });
}

function runGitDiff(projectRoot: string, diffSpec: string): string[] {
  const output = execFileSync("git", ["diff", "--name-only", diffSpec], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function resolveChangedFiles(projectRoot: string, options: CliOptions): Promise<string[]> {
  if (options.changedFiles.length > 0) {
    return options.changedFiles;
  }

  const stdinLines = await readLinesFromStdIn();
  if (stdinLines.length > 0) {
    return stdinLines;
  }

  if (options.baseRef) {
    try {
      return runGitDiff(projectRoot, options.baseRef);
    } catch {
      // Fall through to local diffs below.
    }
  }

  for (const diffSpec of ["HEAD~1", "--cached"]) {
    try {
      const lines =
        diffSpec === "--cached"
          ? execFileSync("git", ["diff", "--name-only", "--cached"], {
              cwd: projectRoot,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
            })
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : runGitDiff(projectRoot, diffSpec);

      if (lines.length > 0) {
        return lines;
      }
    } catch {
      // Continue looking for a usable diff source.
    }
  }

  return [];
}

export function checkDocsDrift(
  changedFiles: string[],
  triggers: Record<string, string[]>,
  projectRoot: string,
): DocsDriftViolation[] {
  const violations: DocsDriftViolation[] = [];
  const changedSet = new Set(changedFiles);

  for (const [triggerPattern, requiredDocs] of Object.entries(triggers)) {
    const matchingChanged = changedFiles.filter((file) => globMatch(triggerPattern, file));
    if (matchingChanged.length === 0) continue;

    const missingDocs = requiredDocs.filter((doc) => {
      if (changedSet.has(doc)) return false;
      return !existsSync(join(projectRoot, doc));
    });

    if (missingDocs.length > 0) {
      violations.push({
        triggerFile: matchingChanged.join(", "),
        requiredDocs,
        missingDocs,
      });
    }
  }

  return violations;
}

function toProvidedCheckResult(name: string, status: GateCheckStatus): GateCheckResult {
  return {
    detail: "Aangeleverd via CLI-/workflowstatus.",
    name,
    required: false,
    source: "provided",
    status,
  };
}

async function executeRequiredCheck(
  checkName: string,
  projectRoot: string,
  runRoot: string,
): Promise<GateCheckResult> {
  const command = CHECK_COMMANDS[checkName];

  if (!command) {
    return {
      detail: `Geen opdracht gedefinieerd voor vereiste controle "${checkName}".`,
      name: checkName,
      required: true,
      source: "provided",
      status: "missing",
    };
  }

  const checkSlug = slugifyCheckName(checkName);
  const stdoutPath = join(runRoot, `${checkSlug}.stdout.log`);
  const stderrPath = join(runRoot, `${checkSlug}.stderr.log`);
  const processResult = await executeHarnessCommand({
    args: command.args,
    command: command.command,
    cwd: projectRoot,
    env: command.env,
    stderrPath,
    stdoutPath,
  });

  return {
    commandLine: processResult.commandLine,
    detail:
      processResult.outcome === "succeeded"
        ? "Controle succesvol uitgevoerd."
        : "Controle mislukte tijdens uitvoering.",
    durationMs: processResult.durationMs,
    exitCode: processResult.exitCode,
    name: checkName,
    required: true,
    source: "executed",
    status: processResult.outcome === "succeeded" ? "passed" : "failed",
    stderrPath: processResult.stderrPath,
    stderrTail: processResult.stderrTail,
    stdoutPath: processResult.stdoutPath,
    stdoutTail: processResult.stdoutTail,
  };
}

function appendGitHubOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;

  appendFileSync(outputFile, `${name}=${value}\n`);
}

function appendMultilineGitHubOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;

  appendFileSync(outputFile, `${name}<<EOF\n${value}\nEOF\n`);
}

export async function evaluateRiskPolicyGate(
  options: CliOptions,
  configOverride?: HarnessConfig,
): Promise<GateResult> {
  const projectRoot = resolve(options.cwd ?? process.cwd());
  const config = configOverride ?? loadHarnessConfig({ cwd: projectRoot });
  const changedFiles = await resolveChangedFiles(projectRoot, options);
  const fileTiers = changedFiles.map((file) => ({
    file,
    tier: classifyFile(file, config.riskTierRules),
  }));

  const counts: Record<RiskTier, number> = { high: 0, low: 0, medium: 0 };
  for (const { tier } of fileTiers) {
    counts[tier]++;
  }

  const tier = highestTier(fileTiers.map((entry) => entry.tier));
  const requiredChecks = [...config.mergePolicy[tier].requiredChecks];
  const requireCodeReview = config.mergePolicy[tier].requireCodeReview;
  const docsDriftViolations = checkDocsDrift(
    changedFiles,
    config.docsDriftRules.triggers,
    projectRoot,
  );
  const docsDriftPass = docsDriftViolations.length === 0;

  const otherRequiredChecks = requiredChecks.filter(
    (checkName) => checkName !== "risk-policy-gate",
  );
  const checkResults = new Map<string, GateCheckResult>();

  for (const [checkName, status] of options.checkResults.entries()) {
    checkResults.set(checkName, toProvidedCheckResult(checkName, status));
  }

  const runRoot = mkdtempSync(join(tmpdir(), "motian-risk-policy-gate-"));

  for (const checkName of otherRequiredChecks) {
    if (checkResults.has(checkName)) continue;

    if (options.noExecuteChecks) {
      checkResults.set(checkName, {
        detail: "Geen resultaat aangeleverd en uitvoering is uitgeschakeld.",
        name: checkName,
        required: true,
        source: "provided",
        status: "missing",
      });
      continue;
    }

    checkResults.set(checkName, await executeRequiredCheck(checkName, projectRoot, runRoot));
  }

  for (const checkName of requiredChecks) {
    const existing = checkResults.get(checkName);
    if (!existing) continue;

    existing.required = true;
  }

  const missingRequiredChecks = otherRequiredChecks.filter(
    (checkName) => checkResults.get(checkName)?.status === "missing",
  );
  const failedDependencyChecks = otherRequiredChecks.filter((checkName) => {
    const status = checkResults.get(checkName)?.status;
    return status !== undefined && status !== "passed" && status !== "missing";
  });

  const dependencyChecksPassed =
    missingRequiredChecks.length === 0 && failedDependencyChecks.length === 0;
  const passed = docsDriftPass && dependencyChecksPassed;

  checkResults.set("risk-policy-gate", {
    detail: passed
      ? "Alle verplichte controles voldeden aan het mergebeleid."
      : "Het mergebeleid blokkeert deze wijziging.",
    name: "risk-policy-gate",
    required: requiredChecks.includes("risk-policy-gate"),
    source: "self",
    status: passed ? "passed" : "failed",
  });

  const failedRequiredChecks = passed
    ? []
    : Array.from(new Set([...failedDependencyChecks, "risk-policy-gate"]));

  const orderedCheckNames = Array.from(new Set([...requiredChecks, ...checkResults.keys()]));
  const orderedCheckResults = orderedCheckNames
    .map((checkName) => checkResults.get(checkName))
    .filter((result): result is GateCheckResult => result !== undefined);

  return {
    changedFiles,
    checkResults: orderedCheckResults,
    counts,
    docsDriftPass,
    docsDriftViolations,
    failedRequiredChecks,
    fileTiers,
    missingRequiredChecks,
    passed,
    requireCodeReview,
    requiredChecks,
    tier,
    totalFiles: changedFiles.length,
  };
}

function printSummary(result: GateResult, config: HarnessConfig, verbose: boolean): void {
  console.log(`Risiconiveau: ${result.tier}`);
  console.log(`Verplichte controles: ${result.requiredChecks.join(", ")}`);
  console.log(`Menselijke review vereist: ${result.requireCodeReview ? "ja" : "nee"}`);
  console.log(
    `Gewijzigde bestanden: ${result.totalFiles} (${result.counts.high} high, ${result.counts.medium} medium, ${result.counts.low} low)`,
  );

  if (result.docsDriftPass) {
    console.log("Documentatie-afwijking: OK");
  } else {
    console.log("Documentatie-afwijking: MISLUKT");
    for (const violation of result.docsDriftViolations) {
      console.log(`  - Triggerbestand: ${violation.triggerFile}`);
      console.log(`    Ontbrekende documentatie-updates: ${violation.missingDocs.join(", ")}`);
    }
    console.log(`  Bericht: ${config.docsDriftRules.message}`);
  }

  console.log("Controle-resultaten:");
  for (const check of result.checkResults) {
    const requiredFlag = check.required ? "required" : "optional";
    console.log(
      `  - ${check.name}: ${check.status} (${check.source}, ${requiredFlag})${check.detail ? ` — ${check.detail}` : ""}`,
    );
  }

  if (verbose && result.fileTiers.length > 0) {
    console.log("\nBestandsoverzicht:");
    for (const entry of result.fileTiers) {
      console.log(`  [${entry.tier.padEnd(6)}] ${entry.file}`);
    }
  }

  console.log(`Gate-resultaat: ${result.passed ? "PASS" : "FAIL"}`);
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  const projectRoot = resolve(options.cwd ?? process.cwd());
  const config = loadHarnessConfig({ cwd: projectRoot });
  const result = await evaluateRiskPolicyGate(options, config);
  const report = JSON.stringify(result);

  appendGitHubOutput("risk-tier", result.tier);
  appendGitHubOutput("required-checks", JSON.stringify(result.requiredChecks));
  appendGitHubOutput("require-code-review", result.requireCodeReview ? "true" : "false");
  appendGitHubOutput("gate-passed", result.passed ? "true" : "false");
  appendMultilineGitHubOutput("report-json", report);

  if (options.json) {
    console.log(report);
  } else {
    printSummary(result, config, options.verbose);
  }

  if (!result.passed) {
    process.exit(1);
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(
      `[risk-policy-gate] Onverwerkte fout: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
