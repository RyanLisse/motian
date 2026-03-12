import { afterEach, describe, expect, it, vi } from "vitest";
import { formatFindingAsIssue, publishFindings } from "@/src/autopilot/github";
import type { AutopilotEvidence } from "@/src/autopilot/types/evidence";
import type { AutopilotFinding } from "@/src/autopilot/types/finding";
import { GitHubApiClient } from "@/src/harness/adapters/github/client";

function makeFinding(overrides: Partial<AutopilotFinding> = {}): AutopilotFinding {
  return {
    id: "finding-1",
    runId: "run-1",
    category: "ux",
    surface: "/chat",
    title: "Chat input overflows on mobile",
    description: "The mobile chat input grows outside the card container.",
    severity: "medium",
    confidence: 0.82,
    autoFixable: false,
    status: "detected",
    fingerprint: "/chat:ux:chat-input-overflows-on-mobile",
    suspectedRootCause: "The textarea width does not clamp at narrow breakpoints.",
    recommendedAction: "Constrain the input width and retest the mobile layout.",
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<AutopilotEvidence> = {}): AutopilotEvidence {
  return {
    id: "evidence-1",
    kind: "screenshot",
    path: "/tmp/chat-mobile.png",
    url: "https://example.com/chat-mobile.png",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("autopilot GitHub issue formatting", () => {
  it("assigns autopilot, category, and priority labels", () => {
    const formatted = formatFindingAsIssue(
      makeFinding({
        category: "ux",
        severity: "medium",
      }),
      [
        makeEvidence(),
        makeEvidence({
          id: "evidence-2",
          kind: "console-log",
          path: "/tmp/chat-console.log",
          url: undefined,
        }),
      ],
      "https://example.com/autopilot/report.md",
    );

    expect(formatted.labels).toEqual(["autopilot", "ux", "priority:medium"]);
    expect(formatted.body).toContain(
      "<!-- autopilot-fingerprint:/chat:ux:chat-input-overflows-on-mobile -->",
    );
    expect(formatted.body).toContain("## Evidence");
    expect(formatted.body).toContain("[screenshot](https://example.com/chat-mobile.png)");
    expect(formatted.body).toContain("console-log: `/tmp/chat-console.log`");
    expect(formatted.body).toContain(
      "📄 [Full autopilot report](https://example.com/autopilot/report.md)",
    );
  });

  it("keeps bug findings on the bug label while marking critical severity", () => {
    const formatted = formatFindingAsIssue(
      makeFinding({
        category: "bug",
        severity: "critical",
        title: "Matching page crashes on load",
        fingerprint: "/matching:bug:matching-page-crashes-on-load",
      }),
      [],
    );

    expect(formatted.labels).toEqual(["autopilot", "bug", "priority:critical"]);
  });
});

describe("autopilot GitHub issue publishing", () => {
  it("creates a new issue with the formatted labels and body", async () => {
    const restMock = vi
      .spyOn(GitHubApiClient.prototype, "rest")
      .mockImplementation(async (path, init = {}) => {
        if (path.startsWith("/search/issues?q=")) {
          return {
            total_count: 0,
            items: [],
          };
        }

        if (path === "/repos/RyanLisse/motian/issues") {
          const payload = JSON.parse(String(init.body)) as {
            body: string;
            labels: string[];
            title: string;
          };

          expect(payload.title).toBe("[autopilot] Chat input overflows on mobile");
          expect(payload.labels).toEqual(["autopilot", "perf", "priority:high"]);
          expect(payload.body).toContain(
            "<!-- autopilot-fingerprint:/chat:perf:chat-input-overflows-on-mobile -->",
          );

          return {
            number: 59,
            html_url: "https://github.com/RyanLisse/motian/issues/59",
          };
        }

        throw new Error(`Unexpected GitHub REST path: ${path}`);
      });

    const finding = makeFinding({
      category: "perf",
      severity: "high",
      fingerprint: "/chat:perf:chat-input-overflows-on-mobile",
    });
    const published = await publishFindings(
      [finding],
      new Map([[finding.id, [makeEvidence()]]]),
      {
        owner: "RyanLisse",
        repo: "motian",
        token: "test-token",
      },
      "https://example.com/autopilot/report.md",
    );

    expect(restMock).toHaveBeenCalledTimes(2);
    expect(published).toEqual([
      {
        findingId: finding.id,
        fingerprint: finding.fingerprint,
        issueNumber: 59,
        issueUrl: "https://github.com/RyanLisse/motian/issues/59",
        created: true,
      },
    ]);
  });

  it("comments on an existing issue when the fingerprint already exists", async () => {
    const restMock = vi
      .spyOn(GitHubApiClient.prototype, "rest")
      .mockImplementation(async (path) => {
        if (path.startsWith("/search/issues?q=")) {
          return {
            total_count: 1,
            items: [
              {
                number: 61,
                html_url: "https://github.com/RyanLisse/motian/issues/61",
              },
            ],
          };
        }

        if (path === "/repos/RyanLisse/motian/issues/61/comments") {
          return {
            id: 9001,
            html_url: "https://github.com/RyanLisse/motian/issues/61#issuecomment-9001",
          };
        }

        throw new Error(`Unexpected GitHub REST path: ${path}`);
      });

    const finding = makeFinding({
      category: "ai-quality",
      severity: "low",
      fingerprint: "/chat:ai-quality:chat-input-overflows-on-mobile",
    });
    const published = await publishFindings(
      [finding],
      new Map([[finding.id, [makeEvidence()]]]),
      {
        owner: "RyanLisse",
        repo: "motian",
        token: "test-token",
      },
      "https://example.com/autopilot/report.md",
    );

    expect(restMock).toHaveBeenCalledTimes(2);
    expect(published).toEqual([
      {
        findingId: finding.id,
        fingerprint: finding.fingerprint,
        issueNumber: 61,
        issueUrl: "https://github.com/RyanLisse/motian/issues/61",
        created: false,
      },
    ]);
  });
});
