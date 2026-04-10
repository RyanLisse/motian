import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadComment {
  author: { login: string };
}

interface ReviewThread {
  id: string;
  isResolved: boolean;
  comments: { nodes: ThreadComment[] };
}

export interface ResolveResult {
  resolved: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_BOTS = new Set(["github-actions"]);

function isBot(login: string): boolean {
  return login.endsWith("[bot]") || KNOWN_BOTS.has(login);
}

function escapeShellArg(value: string): string {
  return value.replace(/'/g, "'\\''");
}

// ---------------------------------------------------------------------------
// GraphQL queries
// ---------------------------------------------------------------------------

const FETCH_THREADS_QUERY = `
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 50) {
            nodes {
              author { login }
            }
          }
        }
      }
    }
  }
}`;

const RESOLVE_THREAD_MUTATION = `
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}`;

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export function fetchReviewThreads(owner: string, repo: string, prNumber: number): ReviewThread[] {
  const variables = JSON.stringify({ owner, repo, pr: prNumber });
  const raw = execSync(
    `gh api graphql -f query='${escapeShellArg(FETCH_THREADS_QUERY)}' --input - <<< '${escapeShellArg(variables)}'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: "/bin/bash" },
  );

  const parsed = JSON.parse(raw.trim());
  return (parsed.data?.repository?.pullRequest?.reviewThreads?.nodes ?? []) as ReviewThread[];
}

function resolveThread(threadId: string): void {
  const variables = JSON.stringify({ threadId });
  execSync(
    `gh api graphql -f query='${escapeShellArg(RESOLVE_THREAD_MUTATION)}' --input - <<< '${escapeShellArg(variables)}'`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: "/bin/bash" },
  );
}

// ---------------------------------------------------------------------------
// Core logic (exported for testing)
// ---------------------------------------------------------------------------

export function classifyThreads(threads: ReviewThread[]): {
  botOnly: ReviewThread[];
  withHumans: ReviewThread[];
  alreadyResolved: ReviewThread[];
} {
  const botOnly: ReviewThread[] = [];
  const withHumans: ReviewThread[] = [];
  const alreadyResolved: ReviewThread[] = [];

  for (const thread of threads) {
    if (thread.isResolved) {
      alreadyResolved.push(thread);
      continue;
    }

    const allBot = thread.comments.nodes.every((c) => isBot(c.author.login));
    if (allBot) {
      botOnly.push(thread);
    } else {
      withHumans.push(thread);
    }
  }

  return { botOnly, withHumans, alreadyResolved };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(prNumber: number, owner: string, repo: string): Promise<ResolveResult> {
  const threads = fetchReviewThreads(owner, repo, prNumber);
  const { botOnly, withHumans } = classifyThreads(threads);

  for (const thread of botOnly) {
    resolveThread(thread.id);
    console.log(`[auto-resolve-threads] Resolved thread ${thread.id}`);
  }

  const skipped = withHumans.length;
  console.log(
    `[auto-resolve-threads] Resolved ${botOnly.length} bot-only threads, skipped ${skipped} threads with human comments`,
  );

  return { resolved: botOnly.length, skipped };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [prNumberStr] = process.argv.slice(2);

  if (!prNumberStr) {
    console.error("Usage: auto-resolve-threads.ts <pr-number>");
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
  await run(prNumber, owner, repo);
}

// Only run when executed directly (not when imported in tests)
const isDirectRun = process.argv[1]?.endsWith("auto-resolve-threads.ts") || process.argv[1]?.includes("auto-resolve-threads");
if (isDirectRun) {
  main().catch((err) => {
    console.error(`[auto-resolve-threads] Onverwerkte fout: ${err}`);
    process.exit(1);
  });
}
