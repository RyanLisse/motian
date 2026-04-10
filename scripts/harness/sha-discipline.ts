import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubComment {
  id: number;
  body: string;
  user: { login: string };
}

export interface ShaDisciplineResult {
  marked: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_BOTS = new Set(["github-actions"]);

function isBot(login: string): boolean {
  return login.endsWith("[bot]") || KNOWN_BOTS.has(login);
}

function extractShaTag(body: string): string | null {
  const match = body.match(/<!-- sha:([a-zA-Z0-9_-]+) -->/);
  return match ? match[1] : null;
}

function escapeShellArg(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function fetchComments(owner: string, repo: string, prNumber: number): GitHubComment[] {
  const raw = execSync(
    `gh api repos/${owner}/${repo}/issues/${prNumber}/comments --jq '[.[] | {id: .id, body: .body, user: {login: .user.login}}]'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(raw.trim()) as GitHubComment[];
}

function updateComment(owner: string, repo: string, commentId: number, body: string): void {
  execSync(
    `gh api -X PATCH repos/${owner}/${repo}/issues/comments/${commentId} --field body='${escapeShellArg(body)}'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

// ---------------------------------------------------------------------------
// Core logic (exported for testing)
// ---------------------------------------------------------------------------

export function markStaleComments(
  comments: GitHubComment[],
  newHeadSha: string,
): { toUpdate: Array<{ id: number; newBody: string }>; skipped: number } {
  const toUpdate: Array<{ id: number; newBody: string }> = [];
  let skipped = 0;

  for (const comment of comments) {
    const oldSha = extractShaTag(comment.body);
    if (!oldSha) {
      skipped++;
      continue;
    }

    if (oldSha === newHeadSha) {
      skipped++;
      continue;
    }

    if (!isBot(comment.user.login)) {
      skipped++;
      continue;
    }

    // Already has a staleness banner — skip
    if (comment.body.startsWith("> **Stale**")) {
      skipped++;
      continue;
    }

    const banner = `> **Stale** — this review was for commit \`${oldSha}\`, HEAD is now \`${newHeadSha}\`\n\n`;
    toUpdate.push({ id: comment.id, newBody: banner + comment.body });
  }

  return { toUpdate, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(
  prNumber: number,
  newHeadSha: string,
  owner: string,
  repo: string,
): Promise<ShaDisciplineResult> {
  const comments = fetchComments(owner, repo, prNumber);
  const { toUpdate, skipped } = markStaleComments(comments, newHeadSha);

  for (const { id, newBody } of toUpdate) {
    updateComment(owner, repo, id, newBody);
    console.log(`[sha-discipline] Marked comment ${id} as stale`);
  }

  console.log(`[sha-discipline] Done: marked ${toUpdate.length}, skipped ${skipped}`);
  return { marked: toUpdate.length, skipped };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [prNumberStr, newHeadSha] = process.argv.slice(2);

  if (!prNumberStr || !newHeadSha) {
    console.error("Usage: sha-discipline.ts <pr-number> <new-head-sha>");
    process.exit(1);
  }

  const prNumber = Number.parseInt(prNumberStr, 10);
  if (Number.isNaN(prNumber)) {
    console.error(`Invalid PR number: ${prNumberStr}`);
    process.exit(1);
  }

  const githubRepository = process.env.GITHUB_REPOSITORY;
  if (!githubRepository) {
    console.error("GITHUB_REPOSITORY environment variable is required");
    process.exit(1);
  }

  const [owner, repo] = githubRepository.split("/");
  await run(prNumber, newHeadSha, owner, repo);
}

// Only run when executed directly (not when imported in tests)
const isDirectRun =
  process.argv[1]?.endsWith("sha-discipline.ts") || process.argv[1]?.includes("sha-discipline");
if (isDirectRun) {
  main().catch((err) => {
    console.error(`[sha-discipline] Onverwerkte fout: ${err}`);
    process.exit(1);
  });
}
