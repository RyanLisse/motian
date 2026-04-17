export type TeamsReviewDecision = "approved" | "rejected";

export type TeamsReviewCardInput = {
  dossierId: string;
  reviewId: string;
  summary: string;
  kleur: string;
  detailsUrl?: string;
  webhookUrl?: string;
};

export type AdaptiveCardEnvelope = {
  type: "message";
  attachments: Array<{
    contentType: "application/vnd.microsoft.card.adaptive";
    content: Record<string, unknown>;
  }>;
};

function createDecisionAction(
  decision: TeamsReviewDecision,
  reviewId: string,
  dossierId: string,
) {
  return {
    type: "Action.Submit",
    title: decision === "approved" ? "Goedkeuren" : "Afwijzen",
    data: {
      action: "review_decision",
      decision,
      reviewId,
      dossierId,
    },
  };
}

export function buildTeamsAdaptiveCard(input: TeamsReviewCardInput): AdaptiveCardEnvelope {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.5",
          body: [
            {
              type: "TextBlock",
              text: "Nieuwe beoordeling wacht op review",
              weight: "Bolder",
              size: "Medium",
            },
            {
              type: "TextBlock",
              text: `Dossier: ${input.dossierId}`,
              wrap: true,
              spacing: "Small",
            },
            {
              type: "TextBlock",
              text: `Kleur: ${input.kleur}`,
              wrap: true,
              spacing: "Small",
            },
            {
              type: "TextBlock",
              text: input.summary,
              wrap: true,
              spacing: "Medium",
            },
          ],
          actions: [
            createDecisionAction("approved", input.reviewId, input.dossierId),
            createDecisionAction("rejected", input.reviewId, input.dossierId),
            ...(input.detailsUrl
              ? [
                  {
                    type: "Action.OpenUrl",
                    title: "Open details",
                    url: input.detailsUrl,
                  },
                ]
              : []),
          ],
        },
      },
    ],
  };
}

export class TeamsReviewChannel {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async postAdaptiveCard(input: TeamsReviewCardInput): Promise<void> {
    const webhookUrl = input.webhookUrl ?? process.env.TEAMS_REVIEW_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error("TEAMS_REVIEW_WEBHOOK_URL ontbreekt");
    }

    const response = await this.fetchImpl(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildTeamsAdaptiveCard(input)),
    });

    if (!response.ok) {
      throw new Error(`Teams Adaptive Card kon niet verstuurd worden (${response.status})`);
    }
  }
}
