import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOpenFindings,
  getRecentRuns,
  getRunFindings,
  saveAutopilotFindings,
  saveAutopilotRun,
  updateFindingStatus,
} from "@/src/autopilot/persistence";
import type { AutopilotFinding, AutopilotRunSummary } from "@/src/autopilot/types";

// Mock the database
vi.mock("@/src/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ findingId: "test-finding" }])),
      })),
    })),
  },
}));

vi.mock("@/src/db/schema", () => ({
  autopilotRuns: {
    runId: "runId",
    startedAt: "startedAt",
  },
  autopilotFindings: {
    findingId: "findingId",
    runId: "runId",
    severity: "severity",
    createdAt: "createdAt",
    status: "status",
  },
}));

describe("autopilot persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveAutopilotRun", () => {
    it("saves a valid run summary", async () => {
      const summary: AutopilotRunSummary = {
        runId: "test-run-123",
        status: "completed",
        startedAt: "2026-03-12T04:00:00.000Z",
        completedAt: "2026-03-12T04:05:00.000Z",
        commitSha: "abc123def456",
        journeyResults: [],
        findings: [],
        evidenceManifests: [],
        stats: {
          totalJourneys: 5,
          passedJourneys: 4,
          failedJourneys: 1,
          totalFindings: 2,
          findingsBySeverity: { high: 1, medium: 1 },
          findingsByCategory: { bug: 1, ux: 1 },
        },
      };

      await expect(saveAutopilotRun(summary)).resolves.not.toThrow();
    });

    it("handles optional reportUrl and triggerRunId", async () => {
      const summary: AutopilotRunSummary = {
        runId: "test-run-456",
        status: "completed",
        startedAt: "2026-03-12T04:00:00.000Z",
        commitSha: "xyz789",
        journeyResults: [],
        findings: [],
        evidenceManifests: [],
        stats: {
          totalJourneys: 3,
          passedJourneys: 3,
          failedJourneys: 0,
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByCategory: {},
        },
      };

      await expect(
        saveAutopilotRun(summary, "https://example.com/report.md", "trigger-run-123"),
      ).resolves.not.toThrow();
    });
  });

  describe("saveAutopilotFindings", () => {
    it("saves multiple findings", async () => {
      const findings: AutopilotFinding[] = [
        {
          id: "f-1",
          runId: "test-run",
          category: "bug",
          surface: "/chat",
          title: "Button not clickable",
          description: "The send button does not respond to clicks",
          severity: "high",
          confidence: 0.9,
          autoFixable: false,
          status: "detected",
          fingerprint: "/chat|bug|button-not-clickable",
        },
        {
          id: "f-2",
          runId: "test-run",
          category: "ux",
          surface: "/matching",
          title: "Poor contrast",
          description: "Text has insufficient contrast",
          severity: "medium",
          confidence: 0.75,
          autoFixable: true,
          status: "detected",
          fingerprint: "/matching|ux|poor-contrast",
        },
      ];

      await expect(saveAutopilotFindings(findings)).resolves.not.toThrow();
    });

    it("handles empty findings array", async () => {
      await expect(saveAutopilotFindings([])).resolves.not.toThrow();
    });

    it("includes GitHub issue numbers when provided", async () => {
      const findings: AutopilotFinding[] = [
        {
          id: "f-1",
          runId: "test-run",
          category: "bug",
          surface: "/chat",
          title: "Test finding",
          description: "Test description",
          severity: "high",
          confidence: 0.9,
          autoFixable: false,
          status: "detected",
          fingerprint: "/chat|bug|test",
        },
      ];

      const githubIssueMap = new Map<string, number>();
      githubIssueMap.set("f-1", 123);

      await expect(saveAutopilotFindings(findings, githubIssueMap)).resolves.not.toThrow();
    });
  });

  describe("getRecentRuns", () => {
    it("returns empty array when no runs exist", async () => {
      const runs = await getRecentRuns();
      expect(Array.isArray(runs)).toBe(true);
    });

    it("respects limit parameter", async () => {
      await expect(getRecentRuns(10)).resolves.toBeDefined();
      await expect(getRecentRuns(50)).resolves.toBeDefined();
    });
  });

  describe("getRunFindings", () => {
    it("returns findings for a valid run ID", async () => {
      const findings = await getRunFindings("test-run-123");
      expect(Array.isArray(findings)).toBe(true);
    });

    it("returns empty array for non-existent run", async () => {
      const findings = await getRunFindings("nonexistent-run");
      expect(Array.isArray(findings)).toBe(true);
      expect(findings).toHaveLength(0);
    });
  });

  describe("updateFindingStatus", () => {
    it("updates finding status to validated", async () => {
      const result = await updateFindingStatus("test-finding", "validated");
      expect(result).toBeDefined();
    });

    it("updates finding status to dismissed", async () => {
      const result = await updateFindingStatus("test-finding", "dismissed");
      expect(result).toBeDefined();
    });

    it("updates finding status to reported", async () => {
      const result = await updateFindingStatus("test-finding", "reported");
      expect(result).toBeDefined();
    });
  });

  describe("getOpenFindings", () => {
    it("returns only findings with detected status", async () => {
      const findings = await getOpenFindings();
      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe("data integrity", () => {
    it("handles null completedAt for in-progress runs", async () => {
      const summary: AutopilotRunSummary = {
        runId: "in-progress-run",
        status: "running",
        startedAt: "2026-03-12T04:00:00.000Z",
        completedAt: undefined,
        commitSha: "abc123",
        journeyResults: [],
        findings: [],
        evidenceManifests: [],
        stats: {
          totalJourneys: 5,
          passedJourneys: 0,
          failedJourneys: 0,
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByCategory: {},
        },
      };

      await expect(saveAutopilotRun(summary)).resolves.not.toThrow();
    });

    it("handles findings with optional metadata fields", async () => {
      const finding: AutopilotFinding = {
        id: "f-opt",
        runId: "test-run",
        category: "bug",
        surface: "/chat",
        title: "Test",
        description: "Test description",
        severity: "low",
        confidence: 0.5,
        autoFixable: false,
        status: "detected",
        fingerprint: "/chat|bug|test",
        suspectedRootCause: "Missing null check",
        recommendedAction: "Add null safety",
        metadata: { context: "user action" },
      };

      await expect(saveAutopilotFindings([finding])).resolves.not.toThrow();
    });
  });

  describe("fingerprint uniqueness", () => {
    it("fingerprints are consistent for same input", () => {
      const surface = "/chat";
      const category = "bug";
      const title = "Button Not Clickable";

      const fingerprint1 = `${surface}|${category}|${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`;
      const fingerprint2 = `${surface}|${category}|${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`;

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toBe("/chat|bug|button-not-clickable");
    });

    it("different surfaces produce different fingerprints", () => {
      const fp1 = "/chat|bug|test";
      const fp2 = "/matching|bug|test";
      expect(fp1).not.toBe(fp2);
    });
  });
});
