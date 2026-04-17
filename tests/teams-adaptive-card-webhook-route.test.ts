import { beforeEach, describe, expect, it, vi } from "vitest";

const { approveMatchWithEffects, rejectMatchWithEffects } = vi.hoisted(() => ({
  approveMatchWithEffects: vi.fn(),
  rejectMatchWithEffects: vi.fn(),
}));

vi.mock("@/src/services/match-effects", () => ({
  approveMatchWithEffects,
  rejectMatchWithEffects,
}));

import { POST } from "../app/api/webhooks/teams-adaptive-card/route";

describe("teams adaptive card webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keurt beoordeling goed op basis van Teams button tap", async () => {
    approveMatchWithEffects.mockResolvedValue({ id: "match-1" });

    const response = await POST(
      new Request("http://localhost/api/webhooks/teams-adaptive-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_decision",
          decision: "approved",
          reviewId: "match-1",
          aadUserId: "user-42",
        }),
      }),
    );

    expect(approveMatchWithEffects).toHaveBeenCalledWith("match-1", "aad:user-42");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      decision: "approved",
      reviewedBy: "aad:user-42",
    });
  });

  it("wijst beoordeling af op basis van Teams button tap", async () => {
    rejectMatchWithEffects.mockResolvedValue({ id: "match-2" });

    const response = await POST(
      new Request("http://localhost/api/webhooks/teams-adaptive-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_decision",
          decision: "rejected",
          reviewId: "match-2",
          aadUserId: "user-7",
        }),
      }),
    );

    expect(rejectMatchWithEffects).toHaveBeenCalledWith("match-2", "aad:user-7");
    expect(response.status).toBe(200);
  });

  it("valideert payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/teams-adaptive-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review_decision", decision: "approved" }),
      }),
    );

    expect(approveMatchWithEffects).not.toHaveBeenCalled();
    expect(rejectMatchWithEffects).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
