import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execSync: mockExecSync }));

import { upsertPrComment } from "@/scripts/harness/pr-comment-writer";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_OPTIONS = {
  prNumber: 42,
  marker: "<!-- harness-risk-comment -->",
  sha: "abc1234",
  body: "## Risk Report\n\nAll checks passed.",
  owner: "RyanLisse",
  repo: "motian",
} as const;

function makeComment(id: number, body: string) {
  return JSON.stringify([{ id, body }]);
}

function makeEmptyList() {
  return JSON.stringify([]);
}

function makeSingleComment(id: number, body: string) {
  return JSON.stringify({ id, body });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("upsertPrComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new comment when no existing comment contains the marker", async () => {
    // First call: list comments → empty
    // Second call: POST → new comment
    mockExecSync
      .mockReturnValueOnce(makeEmptyList())
      .mockReturnValueOnce(makeSingleComment(101, "created body"));

    const result = await upsertPrComment(BASE_OPTIONS);

    expect(result.action).toBe("created");
    expect(result.commentId).toBe(101);

    // Verify the list call
    expect(mockExecSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        `gh api repos/${BASE_OPTIONS.owner}/${BASE_OPTIONS.repo}/issues/${BASE_OPTIONS.prNumber}/comments`,
      ),
      expect.any(Object),
    );

    // Verify the POST call
    expect(mockExecSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("-X POST"),
      expect.any(Object),
    );
  });

  it("returns skipped when the existing comment already contains the same SHA", async () => {
    const shaTag = `<!-- sha:${BASE_OPTIONS.sha} -->`;
    const existingBody = `some body\n\n${BASE_OPTIONS.marker}\n${shaTag}`;

    mockExecSync.mockReturnValueOnce(makeComment(55, existingBody));

    const result = await upsertPrComment(BASE_OPTIONS);

    expect(result.action).toBe("skipped");
    expect(result.commentId).toBe(55);

    // Only the list call should have been made — no create or update
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it("updates an existing comment that contains the marker but a different SHA", async () => {
    const differentShaBody = `old body\n\n${BASE_OPTIONS.marker}\n<!-- sha:oldsha999 -->`;

    mockExecSync
      .mockReturnValueOnce(makeComment(77, differentShaBody))
      .mockReturnValueOnce(makeSingleComment(77, "updated body"));

    const result = await upsertPrComment(BASE_OPTIONS);

    expect(result.action).toBe("updated");
    expect(result.commentId).toBe(77);

    // Verify the PATCH call references the correct comment ID
    expect(mockExecSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `-X PATCH repos/${BASE_OPTIONS.owner}/${BASE_OPTIONS.repo}/issues/comments/77`,
      ),
      expect.any(Object),
    );
  });

  it("detects the marker correctly when it appears anywhere in the comment body", async () => {
    const bodyWithMarkerInMiddle = `Introduction text\n\n${BASE_OPTIONS.marker}\n<!-- sha:differentsha -->\n\nTrailing text`;

    mockExecSync
      .mockReturnValueOnce(makeComment(88, bodyWithMarkerInMiddle))
      .mockReturnValueOnce(makeSingleComment(88, "updated body"));

    const result = await upsertPrComment(BASE_OPTIONS);

    // Should find the existing comment and update (different SHA)
    expect(result.action).toBe("updated");
    expect(result.commentId).toBe(88);
  });

  it("constructs the final body with the marker and SHA tag appended", async () => {
    mockExecSync
      .mockReturnValueOnce(makeEmptyList())
      .mockReturnValueOnce(makeSingleComment(999, "body"));

    await upsertPrComment(BASE_OPTIONS);

    const postCall: string = mockExecSync.mock.calls[1][0] as string;

    // The body passed to gh should include the original body content
    expect(postCall).toContain("Risk Report");
    // ...the marker
    expect(postCall).toContain(BASE_OPTIONS.marker);
    // ...and the SHA tag
    expect(postCall).toContain(`sha:${BASE_OPTIONS.sha}`);
  });

  it("embeds the SHA tag in the format <!-- sha:<sha> -->", async () => {
    const testSha = "deadbeef42";
    const opts = { ...BASE_OPTIONS, sha: testSha };

    mockExecSync
      .mockReturnValueOnce(makeEmptyList())
      .mockReturnValueOnce(makeSingleComment(111, "body"));

    await upsertPrComment(opts);

    const postCall: string = mockExecSync.mock.calls[1][0] as string;
    expect(postCall).toContain(`<!-- sha:${testSha} -->`);
  });
});
