/**
 * GitHub MCP Tools for Motian
 *
 * Enables the AI agent to create PRs, manage issues, and interact with
 * GitHub repositories directly from chat.
 *
 * @see https://docs.github.com/en/rest
 */

import { z } from "zod";
import { tool } from "ai";

const GITHUB_API_BASE = "https://api.github.com";

// Get GitHub token from environment
function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN or GITHUB_PAT environment variable required for GitHub operations"
    );
  }
  return token;
}

// Standard GitHub API headers
function getGitHubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${getGitHubToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORY TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const listRepos = tool({
  description: "List repositories for the authenticated user or organization",
  parameters: z.object({
    owner: z.string().optional().describe("GitHub username or organization (defaults to authenticated user)"),
    visibility: z.enum(["all", "public", "private"]).optional().default("all"),
    sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().default("updated"),
    limit: z.number().int().min(1).max(100).optional().default(30),
  }),
  execute: async ({ owner, visibility, sort, limit }) => {
    const url = owner
      ? `${GITHUB_API_BASE}/users/${owner}/repos?sort=${sort}&per_page=${limit}`
      : `${GITHUB_API_BASE}/user/repos?sort=${sort}&per_page=${limit}&visibility=${visibility}`;

    const response = await fetch(url, { headers: getGitHubHeaders() });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const repos = await response.json();
    return {
      count: repos.length,
      repositories: repos.map((r: any) => ({
        name: r.name,
        fullName: r.full_name,
        url: r.html_url,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
        updatedAt: r.updated_at,
      })),
    };
  },
});

export const getRepoInfo = tool({
  description: "Get detailed information about a GitHub repository",
  parameters: z.object({
    owner: z.string().describe("Repository owner (user or organization)"),
    repo: z.string().describe("Repository name"),
  }),
  execute: async ({ owner, repo }) => {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      url: data.html_url,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      defaultBranch: data.default_branch,
      language: data.language,
      topics: data.topics,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// PULL REQUEST TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const listPullRequests = tool({
  description: "List pull requests in a repository",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().default("open"),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),
  execute: async ({ owner, repo, state, limit }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`,
      { headers: getGitHubHeaders() }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const prs = await response.json();
    return {
      count: prs.length,
      pullRequests: prs.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        author: pr.user.login,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        draft: pr.draft,
      })),
    };
  },
});

export const getPullRequest = tool({
  description: "Get detailed information about a specific pull request",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().int().describe("Pull request number"),
  }),
  execute: async ({ owner, repo, pullNumber }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`,
      { headers: getGitHubHeaders() }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      url: data.html_url,
      state: data.state,
      author: data.user.login,
      branch: data.head.ref,
      baseBranch: data.base.ref,
      mergeable: data.mergeable,
      merged: data.merged,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
    };
  },
});

export const createPullRequest = tool({
  description: "Create a new pull request from chat",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("PR title (conventional commit style recommended)"),
    body: z.string().describe("PR description with context and changes"),
    branch: z.string().describe("Source branch (must exist on remote)"),
    baseBranch: z.string().optional().default("main").describe("Target branch"),
    draft: z.boolean().optional().default(false).describe("Create as draft PR"),
  }),
  execute: async ({ owner, repo, title, body, branch, baseBranch, draft }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: getGitHubHeaders(),
        body: JSON.stringify({
          title,
          body,
          head: branch,
          base: baseBranch,
          draft,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create PR: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      pullRequest: {
        number: data.number,
        title: data.title,
        url: data.html_url,
        branch: data.head.ref,
        baseBranch: data.base.ref,
        draft: data.draft,
      },
    };
  },
});

export const mergePullRequest = tool({
  description: "Merge a pull request (requires merge permission)",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().int().describe("Pull request number"),
    commitTitle: z.string().optional().describe("Custom commit title (optional)"),
    squash: z.boolean().optional().default(false).describe("Use squash merge"),
  }),
  execute: async ({ owner, repo, pullNumber, commitTitle, squash }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
      {
        method: "PUT",
        headers: getGitHubHeaders(),
        body: JSON.stringify({
          commit_title: commitTitle,
          squash: squash,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to merge PR: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message,
      commit: data.commit,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ISSUE TOOLS (for bug/feature tracking)
// ═══════════════════════════════════════════════════════════════════════════

export const listIssues = tool({
  description: "List issues in a repository",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().default("open"),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),
  execute: async ({ owner, repo, state, limit }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`,
      { headers: getGitHubHeaders() }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const issues = await response.json();
    return {
      count: issues.length,
      issues: issues.map((i: any) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        state: i.state,
        author: i.user.login,
        labels: i.labels.map((l: any) => l.name),
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
    };
  },
});

export const createIssue = tool({
  description: "Create a new issue in a repository",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().describe("Issue description"),
    labels: z.array(z.string()).optional().describe("Labels to apply"),
  }),
  execute: async ({ owner, repo, title, body, labels }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: getGitHubHeaders(),
        body: JSON.stringify({
          title,
          body,
          labels,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create issue: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      issue: {
        number: data.number,
        title: data.title,
        url: data.html_url,
        labels: data.labels.map((l: any) => l.name),
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export const getWorkflowRuns = tool({
  description: "Get recent GitHub Actions workflow runs",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),
  execute: async ({ owner, repo, limit }) => {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
      { headers: getGitHubHeaders() }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return {
      total: data.total_count,
      runs: data.workflow_runs.map((run: any) => ({
        id: run.id,
        name: run.name,
        url: run.html_url,
        status: run.status,
        conclusion: run.conclusion,
        branch: run.head_branch,
        event: run.event,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      })),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// SELF-KNOWLEDGE TOOLS (for answering recruiter questions)
// ═══════════════════════════════════════════════════════════════════════════

export const getMotianProjectStatus = tool({
  description: "Get comprehensive project status for recruitment discussions",
  parameters: z.object({
    detailed: z.boolean().optional().default(false).describe("Include code stats and tech details"),
  }),
  execute: async ({ detailed }) => {
    const owner = "RyanLisse";
    const repo = "motian";

    // Fetch repo and recent activity in parallel
    const [repoRes, prsRes, issuesRes] = await Promise.all([
      fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers: getGitHubHeaders() }),
      fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&per_page=5`,
        { headers: getGitHubHeaders() }
      ),
      fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=all&per_page=5`,
        { headers: getGitHubHeaders() }
      ),
    ]);

    if (!repoRes.ok) {
      throw new Error(`Failed to fetch repo info: ${repoRes.status}`);
    }

    const repoData = await repoRes.json();
    const prs = prsRes.ok ? await prsRes.json() : [];
    const issues = issuesRes.ok ? await issuesRes.json() : [];

    const status = {
      project: {
        name: repoData.name,
        description: repoData.description,
        url: repoData.html_url,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        language: repoData.language,
        topics: repoData.topics,
      },
      activity: {
        openPRs: prs.filter((p: any) => p.state === "open").length,
        recentPRs: prs.slice(0, 5).map((p: any) => ({
          title: p.title,
          author: p.user.login,
          state: p.state,
          url: p.html_url,
        })),
        openIssues: issues.filter((i: any) => i.state === "open" && !i.pull_request).length,
        lastPush: repoData.pushed_at,
      },
      techStack: detailed
        ? {
            primary: "TypeScript/Next.js",
            frameworks: ["Next.js 16", "React 19", "Tailwind CSS 4", "shadcn/ui"],
            database: "Neon PostgreSQL + pgvector",
            ai: ["OpenRouter", "GPT-5 Nano", "Gemini 3 Flash", "Grok 4"],
            infrastructure: ["Vercel", "Trigger.dev", "LiveKit (voice)"],
            scrapers: ["Flextender", "Striive", "Opdrachtoverheid"],
          }
        : undefined,
    };

    return status;
  },
});
