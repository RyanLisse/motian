import type { AutopilotEvidence } from "@/src/autopilot/types/evidence";
import type { AutopilotFinding } from "@/src/autopilot/types/finding";
import { GitHubApiClient } from "@/src/harness/adapters/github/client";
import { formatFindingAsIssue } from "./issue-formatter";

export interface IssuePublisherConfig {
  owner: string;
  repo: string;
  token: string;
}

export interface PublishedIssue {
  findingId: string;
  fingerprint: string;
  issueNumber: number;
  issueUrl: string;
  created: boolean;
}

interface GitHubSearchResult {
  total_count: number;
  items: Array<{ number: number; html_url: string }>;
}

interface GitHubCreatedIssue {
  number: number;
  html_url: string;
}

interface GitHubCreatedComment {
  id: number;
  html_url: string;
}

function buildUpdateCommentBody(
  finding: AutopilotFinding,
  evidence: AutopilotEvidence[],
  reportUrl?: string,
): string {
  const lines: string[] = [];
  lines.push(`### Re-detected: ${finding.title}`);
  lines.push("");
  lines.push(
    `**Severity:** \`${finding.severity}\` | **Confidence:** ${(finding.confidence * 100).toFixed(0)}% | **Surface:** \`${finding.surface}\``,
  );
  lines.push("");

  if (evidence.length > 0) {
    lines.push("**Evidence:**");
    for (const e of evidence) {
      const link = e.url ? `[${e.kind}](${e.url})` : `${e.kind}: \`${e.path}\``;
      lines.push(`- ${link}`);
    }
    lines.push("");
  }

  if (reportUrl) {
    lines.push(`📄 [Full autopilot report](${reportUrl})`);
    lines.push("");
  }

  lines.push(`_Re-detected at ${new Date().toISOString()}_`);
  return lines.join("\n");
}

export async function publishFindings(
  findings: AutopilotFinding[],
  evidenceByFinding: Map<string, AutopilotEvidence[]>,
  config: IssuePublisherConfig,
  reportUrl?: string,
): Promise<PublishedIssue[]> {
  const client = new GitHubApiClient({
    token: config.token,
    userAgent: "motian-autopilot-issue-publisher",
  });

  const results: PublishedIssue[] = [];

  for (const finding of findings) {
    try {
      const evidence = evidenceByFinding.get(finding.id) ?? [];
      const published = await publishSingleFinding(client, finding, evidence, config, reportUrl);
      results.push(published);
    } catch (error) {
      console.error(
        `[autopilot] Failed to publish finding "${finding.title}" (${finding.id}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return results;
}

async function publishSingleFinding(
  client: GitHubApiClient,
  finding: AutopilotFinding,
  evidence: AutopilotEvidence[],
  config: IssuePublisherConfig,
  reportUrl?: string,
): Promise<PublishedIssue> {
  // Search for an existing open issue with the same fingerprint
  const query = encodeURIComponent(
    `repo:${config.owner}/${config.repo} is:issue is:open "autopilot-fingerprint:${finding.fingerprint}" in:body`,
  );
  const searchResult = await client.rest<GitHubSearchResult>(`/search/issues?q=${query}`);

  if (searchResult.total_count > 0 && searchResult.items.length > 0) {
    // Update existing issue with a comment
    const existing = searchResult.items[0];
    const commentBody = buildUpdateCommentBody(finding, evidence, reportUrl);

    await client.rest<GitHubCreatedComment>(
      `/repos/${config.owner}/${config.repo}/issues/${existing.number}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body: commentBody }),
      },
    );

    return {
      findingId: finding.id,
      fingerprint: finding.fingerprint,
      issueNumber: existing.number,
      issueUrl: existing.html_url,
      created: false,
    };
  }

  // Create a new issue
  const formatted = formatFindingAsIssue(finding, evidence, reportUrl);
  const created = await client.rest<GitHubCreatedIssue>(
    `/repos/${config.owner}/${config.repo}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title: formatted.title,
        body: formatted.body,
        labels: formatted.labels,
      }),
    },
  );

  return {
    findingId: finding.id,
    fingerprint: finding.fingerprint,
    issueNumber: created.number,
    issueUrl: created.html_url,
    created: true,
  };
}
