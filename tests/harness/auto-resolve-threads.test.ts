import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execSync: mockExecSync }));

import { classifyThreads, run } from "@/scripts/harness/auto-resolve-threads";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeThread(
  id: string,
  isResolved: boolean,
  logins: string[],
) {
  return {
    id,
    isResolved,
    comments: {
      nodes: logins.map((login) => ({ author: { login } })),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests — classifyThreads (pure logic, no I/O)
// ---------------------------------------------------------------------------

describe("classifyThreads", () => {
  it("classifies bot-only unresolved threads as botOnly", () => {
    const threads = [
      makeThread("T1", false, ["review-bot[bot]", "github-actions"]),
    ];

    const { botOnly, withHumans, alreadyResolved } = classifyThreads(threads);

    expect(botOnly).toHaveLength(1);
    expect(botOnly[0].id).toBe("T1");
    expect(withHumans).toHaveLength(0);
    expect(alreadyResolved).toHaveLength(0);
  });

  it("classifies threads with human comments as withHumans", () => {
    const threads = [
      makeThread("T2", false, ["review-bot[bot]", "human-dev"]),
    ];

    const { botOnly, withHumans } = classifyThreads(threads);

    expect(botOnly).toHaveLength(0);
    expect(withHumans).toHaveLength(1);
    expect(withHumans[0].id).toBe("T2");
  });

  it("classifies already-resolved threads separately", () => {
    const threads = [
      makeThread("T3", true, ["review-bot[bot]"]),
    ];

    const { botOnly, withHumans, alreadyResolved } = classifyThreads(threads);

    expect(botOnly).toHaveLength(0);
    expect(withHumans).toHaveLength(0);
    expect(alreadyResolved).toHaveLength(1);
    expect(alreadyResolved[0].id).toBe("T3");
  });

  it("handles PR with no threads", () => {
    const { botOnly, withHumans, alreadyResolved } = classifyThreads([]);

    expect(botOnly).toHaveLength(0);
    expect(withHumans).toHaveLength(0);
    expect(alreadyResolved).toHaveLength(0);
  });

  it("correctly handles mixed thread types", () => {
    const threads = [
      makeThread("T4", false, ["ci-bot[bot]"]),                  // bot-only
      makeThread("T5", false, ["ci-bot[bot]", "developer"]),     // has human
      makeThread("T6", true, ["ci-bot[bot]"]),                   // already resolved
      makeThread("T7", false, ["github-actions"]),               // bot-only (known bot)
    ];

    const { botOnly, withHumans, alreadyResolved } = classifyThreads(threads);

    expect(botOnly).toHaveLength(2);
    expect(withHumans).toHaveLength(1);
    expect(alreadyResolved).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — run (integration with mocked execSync)
// ---------------------------------------------------------------------------

describe("run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves bot-only unresolved threads via GraphQL", async () => {
    const threads = [
      makeThread("T10", false, ["lint-bot[bot]"]),
      makeThread("T11", false, ["lint-bot[bot]", "human-reviewer"]),
    ];

    const graphqlResponse = JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: { nodes: threads },
          },
        },
      },
    });

    mockExecSync
      .mockReturnValueOnce(graphqlResponse)  // fetch threads
      .mockReturnValueOnce("{}");            // resolve T10

    const result = await run(42, "TestOwner", "test-repo");

    expect(result).toEqual({ resolved: 1, skipped: 1 });

    // Verify fetch call uses GraphQL
    expect(mockExecSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("gh api graphql"),
      expect.any(Object),
    );

    // Verify resolve mutation was called
    expect(mockExecSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("resolveReviewThread"),
      expect.any(Object),
    );
  });

  it("does nothing when all threads are already resolved", async () => {
    const threads = [
      makeThread("T20", true, ["lint-bot[bot]"]),
    ];

    const graphqlResponse = JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: { nodes: threads },
          },
        },
      },
    });

    mockExecSync.mockReturnValueOnce(graphqlResponse);

    const result = await run(99, "Owner", "repo");

    expect(result.resolved).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockExecSync).toHaveBeenCalledTimes(1); // Only the fetch call
  });

  it("handles PR with no review threads", async () => {
    const graphqlResponse = JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] },
          },
        },
      },
    });

    mockExecSync.mockReturnValueOnce(graphqlResponse);

    const result = await run(50, "Owner", "repo");

    expect(result.resolved).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
