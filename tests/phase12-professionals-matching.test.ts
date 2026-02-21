import { describe, it, expect } from "vitest";

// ── Service imports ──────────────────────────────────────────────
import {
  listCandidates,
  getCandidateById,
  searchCandidates,
  createCandidate,
} from "../src/services/candidates.js";

import {
  listMatches,
  getMatchById,
  updateMatchStatus,
} from "../src/services/matches.js";

import {
  listApplications,
  getApplicationById,
  createApplication,
  getApplicationStats,
} from "../src/services/applications.js";

import {
  listInterviews,
  getInterviewById,
  createInterview,
  getUpcomingInterviews,
} from "../src/services/interviews.js";

import {
  listMessages,
  getMessageById,
  createMessage,
} from "../src/services/messages.js";

// ── Schema imports ───────────────────────────────────────────────
import { candidates, jobMatches } from "../src/db/schema.js";

// ── Tests ────────────────────────────────────────────────────────

describe("Phase 12 — service imports compile", () => {
  it("candidates service exports are functions", () => {
    expect(typeof listCandidates).toBe("function");
    expect(typeof getCandidateById).toBe("function");
    expect(typeof searchCandidates).toBe("function");
    expect(typeof createCandidate).toBe("function");
  });

  it("matches service exports are functions", () => {
    expect(typeof listMatches).toBe("function");
    expect(typeof getMatchById).toBe("function");
    expect(typeof updateMatchStatus).toBe("function");
  });
});

describe("Phase 12 — schema tables exist", () => {
  it("candidates table is exported", () => {
    expect(candidates).toBeDefined();
  });

  it("jobMatches table is exported", () => {
    expect(jobMatches).toBeDefined();
  });
});

describe("Phase 13 stubs — applications", () => {
  it("listApplications returns empty array", async () => {
    const result = await listApplications({});
    expect(result).toEqual([]);
  });

  it("getApplicationById returns null", async () => {
    const result = await getApplicationById("non-existent");
    expect(result).toBeNull();
  });

  it("createApplication throws Phase 13 error", async () => {
    await expect(
      createApplication({ jobId: "j1", candidateId: "c1" }),
    ).rejects.toThrow("Phase 13");
  });

  it("getApplicationStats returns zeroed stats", async () => {
    const stats = await getApplicationStats();
    expect(stats).toEqual({ total: 0, byStage: {} });
  });
});

describe("Phase 13 stubs — interviews", () => {
  it("listInterviews returns empty array", async () => {
    const result = await listInterviews({});
    expect(result).toEqual([]);
  });

  it("getInterviewById returns null", async () => {
    const result = await getInterviewById("non-existent");
    expect(result).toBeNull();
  });

  it("createInterview throws Phase 13 error", async () => {
    await expect(
      createInterview({
        applicationId: "a1",
        scheduledAt: new Date(),
        type: "video",
        interviewer: "Jan",
      }),
    ).rejects.toThrow("Phase 13");
  });

  it("getUpcomingInterviews returns empty array", async () => {
    const result = await getUpcomingInterviews();
    expect(result).toEqual([]);
  });
});

describe("Phase 13 stubs — messages", () => {
  it("listMessages returns empty array", async () => {
    const result = await listMessages({});
    expect(result).toEqual([]);
  });

  it("getMessageById returns null", async () => {
    const result = await getMessageById("non-existent");
    expect(result).toBeNull();
  });

  it("createMessage returns null (stub)", async () => {
    const result = await createMessage({
      applicationId: "a1",
      direction: "outbound",
      channel: "email",
      body: "Hallo",
    });
    expect(result).toBeNull();
  });
});
