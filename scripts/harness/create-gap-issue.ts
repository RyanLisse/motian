#!/usr/bin/env tsx
/**
 * create-gap-issue.ts
 * Creates a harness gap GitHub issue when a production incident reveals a
 * missing harness check.
 *
 * Usage:
 *   tsx scripts/harness/create-gap-issue.ts \
 *     --title "Login fails after deploy" \
 *     --description "Users cannot log in after the 2026-02-23 deploy" \
 *     --incident-url "https://sentry.io/..." \
 *     --severity high
 */

import { execSync } from "node:child_process";

// ── Config ─────────────────────────────────────────────────────────────────

const SLA_HOURS = 48;
const LABEL_PREFIX = "harness-gap";

// ── Types ──────────────────────────────────────────────────────────────────

type Severity = "high" | "medium" | "low";

interface Args {
  title: string;
  description: string;
  incidentUrl: string | undefined;
  severity: Severity;
}

// ── Arg Parsing ────────────────────────────────────────────────────────────

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
  const incidentUrl = get("--incident-url");
  const severityRaw = get("--severity") ?? "medium";

  if (!title) {
    console.error("Error: --title is required");
    console.error(
      "Usage: tsx scripts/harness/create-gap-issue.ts --title <title> [--description <desc>] [--incident-url <url>] [--severity high|medium|low]",
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
    incidentUrl,
    severity: severityRaw as Severity,
  };
}

// ── Issue Body ─────────────────────────────────────────────────────────────

function buildBody(args: Args): string {
  const deadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000);
  const deadlineStr = deadline.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const lines: string[] = [
    "## Harness Gap",
    "",
    args.description || "_No description provided._",
    "",
  ];

  if (args.incidentUrl) {
    lines.push("## Incident", "", `${args.incidentUrl}`, "");
  }

  lines.push(
    "## SLA",
    "",
    `This gap must be resolved within **${SLA_HOURS} hours**.`,
    `**Deadline:** ${deadlineStr}`,
    "",
    "---",
    `_Created by \`pnpm harness:gap\`_`,
  );

  return lines.join("\n");
}

// ── Issue Creation ─────────────────────────────────────────────────────────

function ensureLabels(labels: string[]): void {
  for (const label of labels) {
    try {
      execSync(`gh label create "${label}" --color "d93f0b" --force`, {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch {
      // Label already exists or gh call failed — non-fatal
    }
  }
}

function createGapIssue(args: Args): void {
  const issueTitle = `[${LABEL_PREFIX}] ${args.title}`;
  const severityLabel = `${LABEL_PREFIX}-${args.severity}`;
  const labels = [LABEL_PREFIX, severityLabel];
  const body = buildBody(args);

  console.log("Creating harness gap issue...");
  console.log(`  Title:    ${issueTitle}`);
  console.log(`  Severity: ${args.severity}`);
  console.log(`  Labels:   ${labels.join(", ")}`);
  if (args.incidentUrl) {
    console.log(`  Incident: ${args.incidentUrl}`);
  }
  console.log();

  // Ensure labels exist before creating the issue
  ensureLabels(labels);

  // Build gh issue create command args
  const ghArgs = [
    "issue",
    "create",
    "--title",
    issueTitle,
    "--body",
    body,
    "--label",
    labels.join(","),
  ];

  let output: string;
  try {
    output = execSync(`gh ${ghArgs.map((a) => JSON.stringify(a)).join(" ")}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to create GitHub issue via gh CLI.");
    console.error("Make sure `gh` is installed and authenticated (`gh auth status`).");
    console.error(msg);
    process.exit(1);
  }

  console.log(`Issue created: ${output}`);
}

// ── Entry Point ────────────────────────────────────────────────────────────

const args = parseArgs();
createGapIssue(args);
