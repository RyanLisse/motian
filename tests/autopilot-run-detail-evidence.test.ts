import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const orderByMock = vi.fn();
const whereMock = vi.fn(() => ({
  limit: limitMock,
  orderBy: orderByMock,
}));
const fromMock = vi.fn(() => ({
  where: whereMock,
}));
const selectMock = vi.fn(() => ({
  from: fromMock,
}));

const downloadFileMock = vi.fn();

vi.mock("@/src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    select: selectMock,
  },
}));

vi.mock("@/src/db/schema", () => ({
  autopilotRuns: {
    runId: "runId",
    startedAt: "startedAt",
  },
  autopilotFindings: {
    runId: "runId",
    severity: "severity",
  },
}));

vi.mock("@/src/lib/file-storage", () => ({
  downloadFile: downloadFileMock,
}));

describe("autopilot run detail evidence loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates evidence metadata from the uploaded summary artifact", async () => {
    const { getRunDetail } = await import("@/app/autopilot/data");

    limitMock.mockResolvedValueOnce([
      {
        id: "uuid-1",
        runId: "run-123",
        status: "failed",
        startedAt: new Date("2026-03-12T04:00:00.000Z"),
        completedAt: new Date("2026-03-12T04:05:00.000Z"),
        commitSha: "abc123def456",
        totalJourneys: 1,
        passedJourneys: 0,
        failedJourneys: 1,
        totalFindings: 1,
        findingsBySeverity: { high: 1 },
        findingsByCategory: { bug: 1 },
        reportUrl: "https://blob.vercel-storage.com/autopilot/run-123/report.md",
        triggerRunId: null,
        createdAt: new Date("2026-03-12T04:00:00.000Z"),
      },
    ]);

    orderByMock.mockResolvedValueOnce([
      {
        id: "finding-1",
        findingId: "finding-1",
        runId: "run-123",
        category: "bug",
        surface: "/chat",
        title: "Chat action failed",
        description: "The chat action failed",
        severity: "high",
        confidence: 0.9,
        autoFixable: false,
        status: "detected",
        fingerprint: "/chat|bug|chat-action-failed",
        suspectedRootCause: null,
        recommendedAction: null,
        githubIssueNumber: null,
        metadata: {},
        createdAt: new Date("2026-03-12T04:05:00.000Z"),
        updatedAt: new Date("2026-03-12T04:05:00.000Z"),
      },
    ]);

    downloadFileMock.mockResolvedValueOnce(
      Buffer.from(
        JSON.stringify({
          runId: "run-123",
          status: "failed",
          startedAt: "2026-03-12T04:00:00.000Z",
          completedAt: "2026-03-12T04:05:00.000Z",
          commitSha: "abc123def456",
          journeyResults: [
            {
              journeyId: "chat-rich-evidence",
              surface: "/chat",
              success: false,
              durationMs: 1800,
            },
          ],
          findings: [],
          evidenceManifests: [
            {
              runId: "run-123",
              journeyId: "chat-rich-evidence",
              surface: "/chat",
              capturedAt: "2026-03-12T04:04:00.000Z",
              gitSha: "abc123def456",
              success: false,
              failureReason: "Expected selector not found: #result",
              artifacts: [
                {
                  id: "chat-rich-evidence-video",
                  kind: "video",
                  path: "/tmp/autopilot/run-123/videos/chat-rich-evidence.webm",
                  capturedAt: "2026-03-12T04:04:05.000Z",
                },
                {
                  id: "chat-rich-evidence-trace",
                  kind: "trace",
                  path: "/tmp/autopilot/run-123/chat-rich-evidence-trace.zip",
                  capturedAt: "2026-03-12T04:04:06.000Z",
                  metadata: { capturedOnError: true },
                },
                {
                  id: "chat-rich-evidence-har",
                  kind: "har",
                  path: "/tmp/autopilot/run-123/chat-rich-evidence.har",
                  capturedAt: "2026-03-12T04:04:07.000Z",
                },
              ],
            },
          ],
          stats: {
            totalJourneys: 1,
            passedJourneys: 0,
            failedJourneys: 1,
            totalFindings: 1,
            findingsBySeverity: { high: 1 },
            findingsByCategory: { bug: 1 },
          },
        }),
        "utf8",
      ),
    );

    const detail = await getRunDetail("run-123");

    expect(detail?.summaryUrl).toBe(
      "https://blob.vercel-storage.com/autopilot/run-123/summary.json",
    );
    expect(detail?.evidence).toHaveLength(1);
    expect(detail?.evidence[0]).toMatchObject({
      journeyId: "chat-rich-evidence",
      surface: "/chat",
      success: false,
      failureReason: "Expected selector not found: #result",
    });
    expect(detail?.evidence[0]?.artifacts[0]?.proxyPath).toBe(
      "/api/autopilot/runs/run-123/evidence/chat-rich-evidence/chat-rich-evidence-video",
    );
  });

  it("returns an empty evidence list when no report URL exists", async () => {
    const { getRunDetail } = await import("@/app/autopilot/data");

    limitMock.mockResolvedValueOnce([
      {
        id: "uuid-2",
        runId: "run-456",
        status: "completed",
        startedAt: new Date("2026-03-12T04:00:00.000Z"),
        completedAt: new Date("2026-03-12T04:05:00.000Z"),
        commitSha: "def456",
        totalJourneys: 1,
        passedJourneys: 1,
        failedJourneys: 0,
        totalFindings: 0,
        findingsBySeverity: {},
        findingsByCategory: {},
        reportUrl: null,
        triggerRunId: null,
        createdAt: new Date("2026-03-12T04:00:00.000Z"),
      },
    ]);

    orderByMock.mockResolvedValueOnce([]);

    const detail = await getRunDetail("run-456");

    expect(detail?.summaryUrl).toBeNull();
    expect(detail?.evidence).toEqual([]);
    expect(downloadFileMock).not.toHaveBeenCalled();
  });
});
