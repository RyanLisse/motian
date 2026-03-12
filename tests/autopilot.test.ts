import { describe, expect, it } from "vitest";
import { evidenceAnalysisSchema } from "@/src/autopilot/analysis/schemas";
import { ALL_JOURNEYS, EXTENDED_JOURNEYS, MVP_JOURNEYS } from "@/src/autopilot/config/journeys";
import { generateMarkdownReport } from "@/src/autopilot/reporting/markdown";
import type {
  AutopilotFinding,
  AutopilotRunSummary,
  EvidenceManifest,
  JourneyResult,
} from "@/src/autopilot/types";

// ---------------------------------------------------------------------------
// 1. Journey Registry Tests
// ---------------------------------------------------------------------------
describe("autopilot journey registry", () => {
  it("has exactly 3 MVP journeys", () => {
    expect(MVP_JOURNEYS).toHaveLength(3);
  });

  it("each journey has required fields", () => {
    for (const j of MVP_JOURNEYS) {
      expect(j).toHaveProperty("id");
      expect(j).toHaveProperty("surface");
      expect(j).toHaveProperty("kind");
      expect(j).toHaveProperty("timeoutMs");
      expect(typeof j.id).toBe("string");
      expect(typeof j.surface).toBe("string");
      expect(typeof j.kind).toBe("string");
      expect(typeof j.timeoutMs).toBe("number");
    }
  });

  it("journey IDs are unique", () => {
    const ids = MVP_JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matching journey has expectedRedirectTarget set to /professionals", () => {
    const matching = MVP_JOURNEYS.find((j) => j.id === "matching-redirect");
    expect(matching).toBeDefined();
    expect(matching?.expectedRedirectTarget).toBe("/professionals");
  });

  it("all surfaces start with /", () => {
    for (const j of MVP_JOURNEYS) {
      expect(j.surface.startsWith("/")).toBe(true);
    }
  });

  it("timeoutMs values are positive numbers", () => {
    for (const j of MVP_JOURNEYS) {
      expect(j.timeoutMs).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Type Validation Tests (structural — verify interfaces work at runtime)
// ---------------------------------------------------------------------------
describe("autopilot types", () => {
  it("can construct a valid AutopilotFinding", () => {
    const finding: AutopilotFinding = {
      id: "f-1",
      runId: "run-1",
      category: "bug",
      surface: "/chat",
      title: "Button not clickable",
      description: "The send button does not respond to clicks",
      severity: "high",
      confidence: 0.9,
      autoFixable: false,
      status: "detected",
      fingerprint: "chat:bug:button-not-clickable",
    };
    expect(finding.id).toBe("f-1");
    expect(finding.severity).toBe("high");
    expect(finding.confidence).toBeGreaterThanOrEqual(0);
    expect(finding.confidence).toBeLessThanOrEqual(1);
  });

  it("can construct a valid EvidenceManifest", () => {
    const manifest: EvidenceManifest = {
      runId: "run-1",
      journeyId: "chat-page-load",
      surface: "/chat",
      capturedAt: new Date().toISOString(),
      gitSha: "abc123",
      artifacts: [],
      success: true,
    };
    expect(manifest.runId).toBe("run-1");
    expect(manifest.artifacts).toEqual([]);
    expect(manifest.success).toBe(true);
  });

  it("can construct a valid JourneyResult", () => {
    const result: JourneyResult = {
      journeyId: "chat-page-load",
      surface: "/chat",
      success: true,
      durationMs: 1500,
    };
    expect(result.journeyId).toBe("chat-page-load");
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("can construct a valid AutopilotRunSummary", () => {
    const summary: AutopilotRunSummary = {
      runId: "run-1",
      status: "completed",
      startedAt: new Date().toISOString(),
      commitSha: "abc123def",
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
    expect(summary.status).toBe("completed");
    expect(summary.stats.totalJourneys).toBe(3);
    expect(summary.stats.failedJourneys).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Finding Fingerprint Tests
// ---------------------------------------------------------------------------
describe("autopilot finding fingerprint", () => {
  function fingerprint(surface: string, category: string, title: string) {
    return `${surface}:${category}:${title}`.toLowerCase().replace(/\s+/g, "-");
  }

  it("same surface+category+title produce same fingerprint", () => {
    const a = fingerprint("/chat", "bug", "Button broken");
    const b = fingerprint("/chat", "bug", "Button broken");
    expect(a).toBe(b);
  });

  it("different surfaces produce different fingerprints", () => {
    const a = fingerprint("/chat", "bug", "Button broken");
    const b = fingerprint("/opdrachten", "bug", "Button broken");
    expect(a).not.toBe(b);
  });

  it("fingerprint normalises whitespace", () => {
    const a = fingerprint("/chat", "ux", "Too  many   spaces");
    expect(a).toBe("/chat:ux:too-many-spaces");
  });
});

// ---------------------------------------------------------------------------
// 4. Report Generation Tests
// ---------------------------------------------------------------------------
describe("autopilot markdown report", () => {
  // Helper to create a minimal valid AutopilotRunSummary
  function makeSummary(overrides?: Partial<AutopilotRunSummary>): AutopilotRunSummary {
    return {
      runId: "test-run-123",
      status: "completed",
      startedAt: "2026-03-12T04:00:00.000Z",
      completedAt: "2026-03-12T04:02:30.000Z",
      commitSha: "abc123def456",
      journeyResults: [
        { journeyId: "chat-page-load", surface: "/chat", success: true, durationMs: 1500 },
        { journeyId: "matching-redirect", surface: "/matching", success: true, durationMs: 800 },
        {
          journeyId: "opdrachten-page-load",
          surface: "/opdrachten",
          success: false,
          durationMs: 3000,
          errorMessage: "Timeout",
        },
      ],
      findings: [],
      evidenceManifests: [],
      stats: {
        totalJourneys: 3,
        passedJourneys: 2,
        failedJourneys: 1,
        totalFindings: 0,
        findingsBySeverity: {},
        findingsByCategory: {},
      },
      ...overrides,
    };
  }

  it("returns a string", () => {
    const report = generateMarkdownReport(makeSummary());
    expect(typeof report).toBe("string");
  });

  it("contains the run status", () => {
    const report = generateMarkdownReport(makeSummary());
    expect(report).toContain("2/3");
  });

  it("contains journey results", () => {
    const report = generateMarkdownReport(makeSummary());
    expect(report).toContain("chat-page-load");
    expect(report).toContain("/chat");
    expect(report).toContain("matching-redirect");
    expect(report).toContain("opdrachten-page-load");
  });

  it("contains the commit SHA", () => {
    const report = generateMarkdownReport(makeSummary());
    expect(report).toContain("abc123def456");
  });

  it("shows success indicators for passing journeys", () => {
    const report = generateMarkdownReport(makeSummary({ status: "completed" }));
    expect(report).toContain("✅");
  });

  it("shows failure indicators for failing journeys", () => {
    const report = generateMarkdownReport(makeSummary());
    expect(report).toContain("❌");
  });

  it("includes error messages for failed journeys", () => {
    const report = generateMarkdownReport(makeSummary());
    expect(report).toContain("Timeout");
  });

  it("handles all-passing journeys", () => {
    const allPass = makeSummary({
      journeyResults: [
        { journeyId: "chat-page-load", surface: "/chat", success: true, durationMs: 1500 },
      ],
      stats: {
        totalJourneys: 1,
        passedJourneys: 1,
        failedJourneys: 0,
        totalFindings: 0,
        findingsBySeverity: {},
        findingsByCategory: {},
      },
    });
    const report = generateMarkdownReport(allPass);
    expect(report).not.toContain("❌");
  });
});

// ---------------------------------------------------------------------------
// 5. Analysis Schemas (Phase 2)
// ---------------------------------------------------------------------------
describe("autopilot analysis schemas", () => {
  it("validates a correct analysis output", () => {
    const validOutput = {
      findings: [
        {
          title: "Error message visible on page",
          category: "bug",
          severity: "high",
          confidence: 0.85,
          description: "An error banner is displayed at the top of the page",
          autoFixable: false,
        },
      ],
      overallHealthy: false,
      summary: "Page shows error state",
    };

    const result = evidenceAnalysisSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity values", () => {
    const invalidOutput = {
      findings: [
        {
          title: "Test",
          category: "bug",
          severity: "extreme", // invalid
          confidence: 0.5,
          description: "Test",
          autoFixable: false,
        },
      ],
      overallHealthy: true,
      summary: "Test",
    };

    const result = evidenceAnalysisSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0-1 range", () => {
    const invalidOutput = {
      findings: [
        {
          title: "Test",
          category: "bug",
          severity: "low",
          confidence: 1.5, // invalid
          description: "Test",
          autoFixable: false,
        },
      ],
      overallHealthy: true,
      summary: "Test",
    };

    const result = evidenceAnalysisSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it("accepts empty findings array", () => {
    const healthyOutput = {
      findings: [],
      overallHealthy: true,
      summary: "Page looks healthy",
    };

    const result = evidenceAnalysisSchema.safeParse(healthyOutput);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Extended Journey Specs (Phase 2)
// ---------------------------------------------------------------------------
describe("extended journey specs", () => {
  it("ALL_JOURNEYS includes MVP + extended journeys", () => {
    expect(ALL_JOURNEYS.length).toBe(MVP_JOURNEYS.length + EXTENDED_JOURNEYS.length);
    expect(ALL_JOURNEYS.length).toBeGreaterThan(MVP_JOURNEYS.length);
  });

  it("extended journeys have unique IDs", () => {
    const ids = ALL_JOURNEYS.map((j) => j.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("interactive journeys with interactions have valid step actions", () => {
    const validActions = ["click", "type", "wait-for-selector", "wait-for-text"];

    for (const journey of ALL_JOURNEYS) {
      if (journey.interactions) {
        for (const step of journey.interactions) {
          expect(validActions).toContain(step.action);
        }
      }
    }
  });

  it("chat-send-message journey has interaction steps", () => {
    const chatJourney = EXTENDED_JOURNEYS.find((j) => j.id === "chat-send-message");
    expect(chatJourney).toBeDefined();
    expect(chatJourney?.interactions).toBeDefined();
    expect(chatJourney?.interactions?.length).toBeGreaterThan(0);
  });

  it("InteractionStep type validation", () => {
    const step = {
      action: "type" as const,
      selector: "textarea",
      text: "test message",
      description: "Type a message",
    };
    expect(step.action).toBe("type");
    expect(step.selector).toBeDefined();
    expect(step.text).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Report with Findings (Phase 2)
// ---------------------------------------------------------------------------
describe("autopilot report with findings", () => {
  it("includes findings table when findings exist", () => {
    const summary: AutopilotRunSummary = {
      runId: "test-run",
      status: "failed",
      startedAt: "2026-03-12T04:00:00.000Z",
      completedAt: "2026-03-12T04:02:00.000Z",
      commitSha: "abc123",
      journeyResults: [
        {
          journeyId: "chat-page-load",
          surface: "/chat",
          success: false,
          durationMs: 5000,
          errorMessage: "Timeout",
        },
      ],
      findings: [
        {
          id: "f-1",
          runId: "test-run",
          category: "bug",
          surface: "/chat",
          title: "Chat input not rendering",
          description: "The chat input field is missing",
          severity: "high",
          confidence: 0.9,
          autoFixable: false,
          status: "detected",
          fingerprint: "/chat|bug|chat-input-not-rendering",
        },
      ],
      evidenceManifests: [],
      stats: {
        totalJourneys: 1,
        passedJourneys: 0,
        failedJourneys: 1,
        totalFindings: 1,
        findingsBySeverity: { high: 1 },
        findingsByCategory: { bug: 1 },
      },
    };

    const report = generateMarkdownReport(summary);
    expect(report).toContain("## Findings");
    expect(report).toContain("Chat input not rendering");
    expect(report).toContain("high");
    expect(report).toContain("bug");
  });

  it("omits findings table when no findings", () => {
    const summary: AutopilotRunSummary = {
      runId: "test-run",
      status: "completed",
      startedAt: "2026-03-12T04:00:00.000Z",
      completedAt: "2026-03-12T04:01:00.000Z",
      commitSha: "abc123",
      journeyResults: [
        { journeyId: "chat-page-load", surface: "/chat", success: true, durationMs: 1000 },
      ],
      findings: [],
      evidenceManifests: [],
      stats: {
        totalJourneys: 1,
        passedJourneys: 1,
        failedJourneys: 0,
        totalFindings: 0,
        findingsBySeverity: {},
        findingsByCategory: {},
      },
    };

    const report = generateMarkdownReport(summary);
    expect(report).not.toContain("## Findings");
  });
});

// ---------------------------------------------------------------------------
// 8. Fingerprint Consistency (Phase 2)
// ---------------------------------------------------------------------------
describe("autopilot fingerprint generation", () => {
  it("generates consistent fingerprints for same input", () => {
    const surface = "/chat";
    const category = "bug";
    const title = "Button Not Clickable";

    const fingerprint1 = `${surface}|${category}|${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}`;
    const fingerprint2 = `${surface}|${category}|${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}`;

    expect(fingerprint1).toBe(fingerprint2);
    expect(fingerprint1).toBe("/chat|bug|button-not-clickable");
  });

  it("truncates long titles in fingerprint", () => {
    const title =
      "This is a very long finding title that should be truncated to ensure fingerprints stay manageable in length";
    const normalized = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60);
    expect(normalized.length).toBeLessThanOrEqual(60);
  });
});
