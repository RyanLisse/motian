import { describe, expect, it, vi } from "vitest";
import { buildTeamsAdaptiveCard, TeamsReviewChannel } from "@/src/services/TeamsReviewChannel";

describe("TeamsReviewChannel", () => {
  it("bouwt een adaptive card met approve/reject acties", () => {
    const envelope = buildTeamsAdaptiveCard({
      dossierId: "dos-1",
      reviewId: "match-1",
      summary: "Korte samenvatting",
      kleur: "groen",
      detailsUrl: "https://example.com/reviews/match-1",
    });

    const content = envelope.attachments[0]?.content;
    const actions = (content?.actions as Array<{ title: string }>) ?? [];

    expect(envelope.type).toBe("message");
    expect(actions.map((action) => action.title)).toEqual(
      expect.arrayContaining(["Goedkeuren", "Afwijzen", "Open details"]),
    );
  });

  it("post adaptive card naar webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const channel = new TeamsReviewChannel(fetchMock as unknown as typeof fetch);

    await channel.postAdaptiveCard({
      dossierId: "dos-1",
      reviewId: "match-1",
      summary: "Korte samenvatting",
      kleur: "amber",
      webhookUrl: "https://example.com/webhook",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});
