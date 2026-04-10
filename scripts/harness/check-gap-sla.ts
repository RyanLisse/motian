#!/usr/bin/env tsx
/**
 * check-gap-sla.ts
 * Lists all open GitHub issues labelled `harness-gap` and checks whether any
 * have been open longer than the configured SLA (default 48 hours).
 *
 * Exit 0 — all issues within SLA
 * Exit 1 — one or more issues are overdue
 *
 * Usage:
 *   tsx scripts/harness/check-gap-sla.ts
 */

import { execSync } from "node:child_process";

// ── Config ─────────────────────────────────────────────────────────────────

const SLA_HOURS = 48;
const LABEL = "harness-gap";

// ── Types ──────────────────────────────────────────────────────────────────

interface GhIssue {
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hoursAgo(isoDate: string): number {
  const created = new Date(isoDate).getTime();
  return (Date.now() - created) / (1000 * 60 * 60);
}

function formatHours(h: number): string {
  if (h < 24) return `${Math.floor(h)}h`;
  const days = Math.floor(h / 24);
  const rem = Math.floor(h % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  console.log(`Checking harness-gap SLA (limit: ${SLA_HOURS}h)...`);
  console.log();

  let issues: GhIssue[];
  try {
    const raw = execSync(
      `gh issue list --label "${LABEL}" --state open --json number,title,url,createdAt --limit 200`,
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    );
    issues = JSON.parse(raw) as GhIssue[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to list GitHub issues via gh CLI.");
    console.error("Make sure `gh` is installed and authenticated (`gh auth status`).");
    console.error(msg);
    process.exit(1);
  }

  if (issues.length === 0) {
    console.log("No open harness-gap issues found.");
    process.exit(0);
  }

  console.log(`Found ${issues.length} open harness-gap issue(s):`);
  console.log();

  const overdue: GhIssue[] = [];

  for (const issue of issues) {
    const age = hoursAgo(issue.createdAt);
    const isOverdue = age > SLA_HOURS;
    const status = isOverdue ? "OVERDUE" : "OK";
    const ageStr = formatHours(age);

    console.log(`  #${issue.number} [${status}] open for ${ageStr} — ${issue.title}`);
    console.log(`         ${issue.url}`);

    if (isOverdue) {
      overdue.push(issue);
    }
  }

  console.log();

  if (overdue.length === 0) {
    console.log(`All ${issues.length} harness-gap issue(s) are within the ${SLA_HOURS}h SLA.`);
    process.exit(0);
  }

  console.error(`WARNING: ${overdue.length} harness-gap issue(s) exceeded the ${SLA_HOURS}h SLA:`);
  console.error();
  for (const issue of overdue) {
    const overduBy = hoursAgo(issue.createdAt) - SLA_HOURS;
    console.error(`  #${issue.number} overdue by ${formatHours(overduBy)} — ${issue.url}`);
  }
  process.exit(1);
}

main();
