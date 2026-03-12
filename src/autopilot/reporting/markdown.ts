import type { AutopilotRunSummary } from "@/src/autopilot/types/run";

/**
 * Format milliseconds into a human-readable duration string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

/**
 * Format an ISO 8601 timestamp into a readable date string.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format an ISO 8601 timestamp into a readable time string.
 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Generate a Markdown morning report from an AutopilotRunSummary.
 */
export function generateMarkdownReport(summary: AutopilotRunSummary): string {
  const { stats, journeyResults, findings, commitSha, startedAt } = summary;
  const allPassed = stats.failedJourneys === 0;
  const statusIcon = allPassed ? "✅" : "❌";
  const statusText = allPassed
    ? "All journeys passed"
    : `${stats.failedJourneys} journey(s) failed`;
  const passRate = `${stats.passedJourneys}/${stats.totalJourneys}`;

  const lines: string[] = [
    "# 🌅 Motian Autopilot — Nightly Report",
    "",
    `**Datum:** ${formatDate(startedAt)}`,
    "",
    `## Status: ${statusIcon} ${statusText} (${passRate})`,
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Total journeys | ${stats.totalJourneys} |`,
    `| Passed | ${stats.passedJourneys} |`,
    `| Failed | ${stats.failedJourneys} |`,
    `| Findings | ${stats.totalFindings} |`,
    "",
    "## Journey Results",
    "",
    "| Journey | Surface | Status | Duration | Error |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const jr of journeyResults) {
    const icon = jr.success ? "✅" : "❌";
    const duration = formatDuration(jr.durationMs);
    const error = jr.errorMessage ? jr.errorMessage.replace(/\|/g, "\\|").replace(/\n/g, " ") : "—";
    lines.push(`| ${jr.journeyId} | ${jr.surface} | ${icon} | ${duration} | ${error} |`);
  }

  if (findings.length > 0) {
    lines.push("", "## Findings", "");
    lines.push("| Title | Severity | Category | Surface |");
    lines.push("| --- | --- | --- | --- |");
    for (const f of findings) {
      lines.push(`| ${f.title} | ${f.severity} | ${f.category} | ${f.surface} |`);
    }
  }

  lines.push(
    "",
    "---",
    "",
    `**Commit:** \`${commitSha}\``,
    "",
    `*Report gegenereerd op ${formatTime(summary.completedAt ?? startedAt)}*`,
    "",
  );

  return lines.join("\n");
}
