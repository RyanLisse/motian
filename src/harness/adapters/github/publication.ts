import type {
  GitHubHarnessArtifactReference,
  GitHubHarnessNormalizedResult,
  GitHubHarnessRunCommentInput,
} from "./types";

function renderArtifact(reference: GitHubHarnessArtifactReference): string {
  const target = reference.url
    ? `[${reference.kind}](${reference.url})`
    : `\`${reference.relativePath}\``;

  return `- ${target} — ${reference.description}`;
}

function renderNormalizedResult(value: GitHubHarnessNormalizedResult): string {
  return JSON.stringify(value, null, 2);
}

export function formatGitHubHarnessRunComment(input: GitHubHarnessRunCommentInput): string {
  const lines: string[] = [input.marker];

  if (input.title) {
    lines.push(`## ${input.title}`);
  }

  if (input.summary) {
    lines.push(input.summary);
  }

  lines.push(
    "| Field | Value |",
    "| --- | --- |",
    `| Run ID | \`${input.run.runId}\` |`,
    `| Dispatch | \`${input.run.dispatch}\` |`,
    `| Status | \`${input.run.status}\` |`,
    `| Created | ${input.run.createdAt} |`,
    `| Updated | ${input.run.updatedAt} |`,
  );

  if (input.run.startedAt) {
    lines.push(`| Started | ${input.run.startedAt} |`);
  }

  if (input.run.finishedAt) {
    lines.push(`| Finished | ${input.run.finishedAt} |`);
  }

  if (input.run.resumeToken) {
    lines.push(`| Resume Token | \`${input.run.resumeToken}\` |`);
  }

  if (input.run.manifestUrl) {
    lines.push(`| Manifest | [link](${input.run.manifestUrl}) |`);
  } else if (input.run.manifestPath) {
    lines.push(`| Manifest | \`${input.run.manifestPath}\` |`);
  }

  if (input.run.result) {
    lines.push(
      "",
      "### Execution",
      `- Outcome: \`${input.run.result.outcome}\``,
      `- Duration: ${input.run.result.durationMs}ms`,
      `- Exit code: ${input.run.result.exitCode ?? "n/a"}`,
      `- Timed out: ${input.run.result.timedOut ? "yes" : "no"}`,
      `- Command: \`${input.run.result.commandLine}\``,
      `- Stdout: \`${input.run.result.stdoutPath}\``,
      `- Stderr: \`${input.run.result.stderrPath}\``,
    );
  }

  if (input.run.artifacts?.length) {
    lines.push("", "### Evidence");
    for (const artifact of input.run.artifacts) {
      lines.push(renderArtifact(artifact));
    }
  }

  if (input.includeNormalizedResult && input.run.normalizedResult !== undefined) {
    lines.push(
      "",
      "### Normalized Result",
      "```json",
      renderNormalizedResult(input.run.normalizedResult),
      "```",
    );
  }

  if (input.includeExternalContext && input.run.externalContext) {
    const entries = Object.entries(input.run.externalContext).filter(
      ([, value]) => value !== undefined,
    );
    if (entries.length > 0) {
      lines.push("", "### External Context");
      for (const [key, value] of entries) {
        lines.push(`- ${key}: \`${String(value)}\``);
      }
    }
  }

  return `${lines.join("\n").trim()}\n`;
}
