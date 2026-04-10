import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpsertPrCommentOptions {
  prNumber: number;
  marker: string; // e.g. "<!-- harness-risk-comment -->"
  sha: string; // current HEAD SHA
  body: string; // markdown body
  owner: string;
  repo: string;
}

export interface UpsertPrCommentResult {
  action: "created" | "updated" | "skipped";
  commentId: number;
}

interface GitHubComment {
  id: number;
  body: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFinalBody(body: string, marker: string, sha: string): string {
  return `${body}\n\n${marker}\n<!-- sha:${sha} -->`;
}

function fetchComments(owner: string, repo: string, prNumber: number): GitHubComment[] {
  const raw = execSync(
    `gh api repos/${owner}/${repo}/issues/${prNumber}/comments --jq '[.[] | {id: .id, body: .body}]'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(raw.trim()) as GitHubComment[];
}

function findMarkedComment(comments: GitHubComment[], marker: string): GitHubComment | undefined {
  return comments.find((c) => c.body.includes(marker));
}

function createComment(owner: string, repo: string, prNumber: number, body: string): GitHubComment {
  const raw = execSync(
    `gh api -X POST repos/${owner}/${repo}/issues/${prNumber}/comments --field body='${escapeShellArg(body)}' --jq '{id: .id, body: .body}'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(raw.trim()) as GitHubComment;
}

function updateComment(
  owner: string,
  repo: string,
  commentId: number,
  body: string,
): GitHubComment {
  const raw = execSync(
    `gh api -X PATCH repos/${owner}/${repo}/issues/comments/${commentId} --field body='${escapeShellArg(body)}' --jq '{id: .id, body: .body}'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(raw.trim()) as GitHubComment;
}

/**
 * Minimal shell-argument escaping: replaces single quotes so the value can be
 * safely embedded in a single-quoted shell string.
 */
function escapeShellArg(value: string): string {
  // End the single-quoted string, insert a literal ', re-open the string.
  return value.replace(/'/g, "'\\''");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Upserts a PR comment identified by an HTML marker string.
 *
 * - If no existing comment contains the marker → creates a new comment.
 * - If an existing comment contains the marker AND the same SHA → skips (no-op).
 * - If an existing comment contains the marker but a different SHA → updates it.
 *
 * The final comment body is: `body + "\n\n" + marker + "\n" + "<!-- sha:<sha> -->"`.
 */
export async function upsertPrComment(
  options: UpsertPrCommentOptions,
): Promise<UpsertPrCommentResult> {
  const { prNumber, marker, sha, body, owner, repo } = options;

  const comments = fetchComments(owner, repo, prNumber);
  const existing = findMarkedComment(comments, marker);

  const shaTag = `<!-- sha:${sha} -->`;
  const finalBody = buildFinalBody(body, marker, sha);

  if (existing) {
    // Already up-to-date — nothing to do
    if (existing.body.includes(shaTag)) {
      return { action: "skipped", commentId: existing.id };
    }

    // Different SHA — update in place
    const updated = updateComment(owner, repo, existing.id, finalBody);
    return { action: "updated", commentId: updated.id };
  }

  // No existing comment — create a new one
  const created = createComment(owner, repo, prNumber, finalBody);
  return { action: "created", commentId: created.id };
}
