import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execSync: mockExecSync }));

import { markStaleComments, run } from "@/scripts/harness/sha-discipline";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeComment(id: number, body: string, login: string) {
  return { id, body, user: { login } };
}

function commentList(...comments: Array<{ id: number; body: string; user: { login: string } }>) {
  return JSON.stringify(comments);
}

// ---------------------------------------------------------------------------
// Tests — markStaleComments (pure logic, no I/O)
// ---------------------------------------------------------------------------

describe("markStaleComments", () => {
  const NEW_SHA = "abc1234";

  it("marks stale bot comments when SHA changes", () => {
    const comments = [makeComment(1, "Review feedback\n<!-- sha:oldsha999 -->", "some-app[bot]")];

    const { toUpdate, skipped } = markStaleComments(comments, NEW_SHA);

    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].id).toBe(1);
    expect(toUpdate[0].newBody).toContain("> **Stale**");
    expect(toUpdate[0].newBody).toContain("`oldsha999`");
    expect(toUpdate[0].newBody).toContain(`\`${NEW_SHA}\``);
    expect(skipped).toBe(0);
  });

  it("skips non-bot comments", () => {
    const comments = [makeComment(2, "Human review\n<!-- sha:oldsha999 -->", "human-reviewer")];

    const { toUpdate, skipped } = markStaleComments(comments, NEW_SHA);

    expect(toUpdate).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips comments without SHA tags", () => {
    const comments = [makeComment(3, "Just a regular comment with no SHA tag", "some-app[bot]")];

    const { toUpdate, skipped } = markStaleComments(comments, NEW_SHA);

    expect(toUpdate).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("handles empty comment list", () => {
    const { toUpdate, skipped } = markStaleComments([], NEW_SHA);

    expect(toUpdate).toHaveLength(0);
    expect(skipped).toBe(0);
  });

  it("skips bot comments whose SHA already matches the new HEAD", () => {
    const comments = [makeComment(4, `Up-to-date\n<!-- sha:${NEW_SHA} -->`, "github-actions")];

    const { toUpdate, skipped } = markStaleComments(comments, NEW_SHA);

    expect(toUpdate).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips comments that already have a staleness banner", () => {
    const comments = [
      makeComment(5, "> **Stale** — old banner\n\nReview\n<!-- sha:oldsha999 -->", "some-app[bot]"),
    ];

    const { toUpdate, skipped } = markStaleComments(comments, NEW_SHA);

    expect(toUpdate).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("recognizes github-actions as a known bot", () => {
    const comments = [makeComment(6, "CI feedback\n<!-- sha:oldsha999 -->", "github-actions")];

    const { toUpdate } = markStaleComments(comments, NEW_SHA);

    expect(toUpdate).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — run (integration with mocked execSync)
// ---------------------------------------------------------------------------

describe("run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches comments and updates stale bot comments via gh API", async () => {
    const comments = [
      makeComment(10, "Bot review\n<!-- sha:oldsha -->", "review-bot[bot]"),
      makeComment(11, "Human note\n<!-- sha:oldsha -->", "developer"),
    ];

    mockExecSync
      .mockReturnValueOnce(commentList(...comments)) // fetch
      .mockReturnValueOnce(""); // PATCH for comment 10

    const result = await run(42, "newsha123", "TestOwner", "test-repo");

    expect(result.marked).toBe(1);
    expect(result.skipped).toBe(1);

    // Verify fetch call
    expect(mockExecSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("gh api repos/TestOwner/test-repo/issues/42/comments"),
      expect.any(Object),
    );

    // Verify PATCH call for the bot comment
    expect(mockExecSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("-X PATCH repos/TestOwner/test-repo/issues/comments/10"),
      expect.any(Object),
    );
  });

  it("does nothing when all comments are up-to-date", async () => {
    const comments = [makeComment(20, "Current review\n<!-- sha:currentsha -->", "ci-bot[bot]")];

    mockExecSync.mockReturnValueOnce(JSON.stringify(comments));

    const result = await run(99, "currentsha", "Owner", "repo");

    expect(result.marked).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockExecSync).toHaveBeenCalledTimes(1); // Only the fetch call
  });
});
