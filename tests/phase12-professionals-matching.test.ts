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

// Phase 13 service imports removed — see tests/phase13-pipeline-communication.test.ts

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

// Phase 13 stub tests removed — services are now real DB implementations.
// See tests/phase13-pipeline-communication.test.ts for Phase 13 export tests.
