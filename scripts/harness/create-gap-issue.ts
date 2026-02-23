#!/usr/bin/env tsx
/**
 * create-gap-issue.ts
 * Creates a harness gap issue in Beads (bd) when a production regression occurs.
 *
 * Usage:
 *   tsx scripts/harness/create-gap-issue.ts \
 *     --title "Login fails after deploy" \
 *     --description "Users cannot log in after the 2026-02-23 deploy" \
 *     --severity high
 */

import { spawnSync } from "node:child_process";

// ── Arg Parsing ────────────────────────────────────────────────────────────

type Severity = "high" | "medium" | "low";

interface Args {
  title: string;
  description: string;
  severity: Severity;
}

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === flag && raw[i + 1] !== undefined) return raw[i + 1];
      if (raw[i].startsWith(`${flag}=`)) return raw[i].slice(flag.length + 1);
    }
    return undefined;
  };

  const title = get("--title");
  const description = get("--description") ?? "";
  const severityRaw = get("--severity") ?? "medium";

  if (!title) {
    console.error("Error: --title is required");
    console.error(
      "Usage: tsx scripts/harness/create-gap-issue.ts --title <title> [--description <desc>] [--severity high|medium|low]",
    );
    process.exit(1);
  }

  const validSeverities: Severity[] = ["high", "medium", "low"];
  if (!validSeverities.includes(severityRaw as Severity)) {
    console.error(`Error: --severity must be one of: ${validSeverities.join(", ")}`);
    process.exit(1);
  }

  return {
    title,
    description,
    severity: severityRaw as Severity,
  };
}

// ── Priority Mapping ───────────────────────────────────────────────────────

const SEVERITY_TO_PRIORITY: Record<Severity, string> = {
  high: "urgent",
  medium: "medium",
  low: "low",
};

// ── Issue Creation ─────────────────────────────────────────────────────────

function createGapIssue(args: Args): void {
  const { title, description, severity } = args;
  const issueTitle = `[harness-gap] ${title}`;
  const priority = SEVERITY_TO_PRIORITY[severity];

  const bdArgs: string[] = [`--title=${issueTitle}`, "--type=bug", `--priority=${priority}`];

  if (description) {
    bdArgs.push(`--description=${description}`);
  }

  console.log(`Creating harness gap issue...`);
  console.log(`  Title:    ${issueTitle}`);
  console.log(`  Severity: ${severity} (priority: ${priority})`);
  if (description) {
    console.log(`  Desc:     ${description}`);
  }
  console.log();

  // Use spawnSync with args array to prevent command injection
  const result = spawnSync("bd", ["create", ...bdArgs], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    console.error("Failed to create issue via bd CLI.");
    console.error("Make sure `bd` is installed and you are authenticated.");
    if (result.stderr) {
      console.error("bd stderr:", result.stderr.trim());
    }
    process.exit(1);
  }

  const output = (result.stdout ?? "").trim();

  // Extract issue ID from bd output (expected: "Created issue ABC-123" or similar)
  const idMatch = output.match(/([A-Z]+-\d+|#\d+|\bISSUE-\d+\b)/i);
  const issueId = idMatch ? idMatch[0] : output;

  console.log(`Issue created: ${issueId}`);
  console.log(output);
}

// ── Entry Point ────────────────────────────────────────────────────────────

const args = parseArgs();
createGapIssue(args);
