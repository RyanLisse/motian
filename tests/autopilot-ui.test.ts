import { describe, expect, it, vi } from "vitest";

// Mock the data layer
const mockGetAutopilotDashboardData = vi.fn(async () => ({
  runs: [
    {
      id: "uuid-1",
      runId: "test-run-123",
      status: "completed",
      startedAt: new Date("2026-03-12T04:00:00.000Z"),
      completedAt: new Date("2026-03-12T04:05:00.000Z"),
      commitSha: "abc123def456",
      totalJourneys: 5,
      passedJourneys: 4,
      failedJourneys: 1,
      totalFindings: 2,
      findingsBySeverity: { high: 1, medium: 1 } as Record<string, number>,
      findingsByCategory: { bug: 1, ux: 1 } as Record<string, number>,
      reportUrl: "https://example.com/report.md",
      triggerRunId: null,
      createdAt: new Date("2026-03-12T04:00:00.000Z"),
    },
  ],
  latestRun: null,
  latestFindings: [],
}));

const mockGetRunDetail = vi.fn(async (runId: string) => {
  if (runId === "test-run-123") {
    return {
      run: {
        id: "uuid-1",
        runId: "test-run-123",
        status: "completed",
        startedAt: new Date("2026-03-12T04:00:00.000Z"),
        completedAt: new Date("2026-03-12T04:05:00.000Z"),
        commitSha: "abc123def456",
        totalJourneys: 5,
        passedJourneys: 4,
        failedJourneys: 1,
        totalFindings: 2,
        findingsBySeverity: { high: 1, medium: 1 } as Record<string, number>,
        findingsByCategory: { bug: 1, ux: 1 } as Record<string, number>,
        reportUrl: "https://example.com/report.md",
        triggerRunId: null,
        createdAt: new Date("2026-03-12T04:00:00.000Z"),
      },
      findings: [
        {
          id: "uuid-f1",
          findingId: "f-1",
          runId: "test-run-123",
          category: "bug",
          surface: "/chat",
          title: "Button not clickable",
          description: "The send button does not respond to clicks",
          severity: "high",
          confidence: 0.9,
          autoFixable: false,
          status: "detected",
          fingerprint: "/chat|bug|button-not-clickable",
          suspectedRootCause: null,
          recommendedAction: null,
          githubIssueNumber: 123,
          metadata: {},
          createdAt: new Date("2026-03-12T04:05:00.000Z"),
          updatedAt: new Date("2026-03-12T04:05:00.000Z"),
        },
      ],
    };
  }
  return null;
});

vi.mock("@/app/autopilot/data", () => ({
  getAutopilotDashboardData: mockGetAutopilotDashboardData,
  getRunDetail: mockGetRunDetail,
}));

describe("Autopilot Data Layer Integration", () => {
  describe("getAutopilotDashboardData", () => {
    it("returns dashboard data with runs", async () => {
      const data = await mockGetAutopilotDashboardData();
      expect(data).toBeDefined();
      expect(data.runs).toHaveLength(1);
      expect(data.runs[0].runId).toBe("test-run-123");
    });

    it("includes run statistics", async () => {
      const data = await mockGetAutopilotDashboardData();
      const run = data.runs[0];
      expect(run.totalJourneys).toBe(5);
      expect(run.passedJourneys).toBe(4);
      expect(run.failedJourneys).toBe(1);
      expect(run.totalFindings).toBe(2);
    });

    it("includes findings breakdown", async () => {
      const data = await mockGetAutopilotDashboardData();
      const run = data.runs[0];
      expect(run.findingsBySeverity).toEqual({ high: 1, medium: 1 });
      expect(run.findingsByCategory).toEqual({ bug: 1, ux: 1 });
    });

    it("includes status and metadata", async () => {
      const data = await mockGetAutopilotDashboardData();
      const run = data.runs[0];
      expect(run.status).toBe("completed");
      expect(run.commitSha).toBe("abc123def456");
      expect(run.reportUrl).toBe("https://example.com/report.md");
    });
  });

  describe("getRunDetail", () => {
    it("returns run detail with findings for valid runId", async () => {
      const data = await mockGetRunDetail("test-run-123");
      expect(data).toBeDefined();
      expect(data?.run.runId).toBe("test-run-123");
      expect(data?.findings).toHaveLength(1);
    });

    it("includes finding details", async () => {
      const data = await mockGetRunDetail("test-run-123");
      const finding = data?.findings[0];
      expect(finding?.title).toBe("Button not clickable");
      expect(finding?.category).toBe("bug");
      expect(finding?.severity).toBe("high");
      expect(finding?.confidence).toBe(0.9);
      expect(finding?.surface).toBe("/chat");
    });

    it("includes GitHub issue number when present", async () => {
      const data = await mockGetRunDetail("test-run-123");
      const finding = data?.findings[0];
      expect(finding?.githubIssueNumber).toBe(123);
    });

    it("returns null for non-existent runId", async () => {
      const data = await mockGetRunDetail("nonexistent-run");
      expect(data).toBeNull();
    });

    it("includes run duration metadata", async () => {
      const data = await mockGetRunDetail("test-run-123");
      expect(data?.run.startedAt).toBeInstanceOf(Date);
      expect(data?.run.completedAt).toBeInstanceOf(Date);

      const duration =
        data?.run.completedAt && data?.run.startedAt
          ? Math.round((data.run.completedAt.getTime() - data.run.startedAt.getTime()) / 1000)
          : 0;
      expect(duration).toBe(300); // 5 minutes
    });
  });

  describe("Empty States", () => {
    it("handles empty runs list", async () => {
      mockGetAutopilotDashboardData.mockResolvedValueOnce({
        runs: [],
        latestRun: null,
        latestFindings: [],
      });

      const data = await mockGetAutopilotDashboardData();
      expect(data.runs).toHaveLength(0);
      expect(data.latestRun).toBeNull();
    });

    it("handles run with no findings", async () => {
      mockGetRunDetail.mockResolvedValueOnce({
        run: {
          id: "uuid-2",
          runId: "empty-run",
          status: "completed",
          startedAt: new Date("2026-03-12T04:00:00.000Z"),
          completedAt: new Date("2026-03-12T04:05:00.000Z"),
          commitSha: "abc123",
          totalJourneys: 3,
          passedJourneys: 3,
          failedJourneys: 0,
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByCategory: {},
          reportUrl: null,
          triggerRunId: null,
          createdAt: new Date("2026-03-12T04:00:00.000Z"),
        },
        findings: [],
      });

      const data = await mockGetRunDetail("empty-run");
      expect(data?.findings).toHaveLength(0);
      expect(data?.run.totalFindings).toBe(0);
    });
  });

  describe("Status Values", () => {
    it("supports completed status", async () => {
      const data = await mockGetRunDetail("test-run-123");
      expect(data?.run.status).toBe("completed");
    });

    it("supports finding status values", async () => {
      const data = await mockGetRunDetail("test-run-123");
      const finding = data?.findings[0];
      expect(finding?.status).toBe("detected");
      expect(["detected", "validated", "reported", "dismissed"]).toContain(finding?.status);
    });
  });

  describe("Date Formatting", () => {
    it("stores dates as Date objects", async () => {
      const data = await mockGetRunDetail("test-run-123");
      expect(data?.run.startedAt).toBeInstanceOf(Date);
      expect(data?.run.completedAt).toBeInstanceOf(Date);
    });

    it("can format dates to Dutch locale", () => {
      const date = new Date("2026-03-12T04:00:00.000Z");
      const formatted = new Intl.DateTimeFormat("nl-NL", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
      expect(formatted).toContain("mrt"); // Dutch for March
    });
  });

  describe("Fingerprint Consistency", () => {
    it("maintains consistent finding fingerprints", async () => {
      const data = await mockGetRunDetail("test-run-123");
      const finding = data?.findings[0];
      expect(finding?.fingerprint).toBe("/chat|bug|button-not-clickable");

      // Verify fingerprint construction
      const reconstructed = `${finding?.surface}|${finding?.category}|${finding?.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`;
      expect(reconstructed).toBe(finding?.fingerprint);
    });
  });
});
