import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCandidateById } = vi.hoisted(() => ({
  mockGetCandidateById: vi.fn(),
}));

vi.mock("../src/services/candidates", () => ({
  getCandidateById: mockGetCandidateById,
}));

import { prepareChannelOfferHandoff } from "../src/services/channel-offer-handoff";

describe("prepareChannelOfferHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when candidate missing", async () => {
    mockGetCandidateById.mockResolvedValueOnce(null);
    const r = await prepareChannelOfferHandoff({ candidateId: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("niet gevonden");
  });

  it("returns not_configured handoff when candidate exists", async () => {
    mockGetCandidateById.mockResolvedValueOnce({
      id: "c1",
      name: "A",
      role: "Dev",
      headline: "H",
    });
    const r = await prepareChannelOfferHandoff({
      candidateId: "c1",
      channelHint: "LinkedIn",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe("not_configured");
      expect(r.handoff.name).toBe("A");
      expect(r.handoff.channelHint).toBe("LinkedIn");
      expect(r.checklist.length).toBeGreaterThan(0);
    }
  });
});
