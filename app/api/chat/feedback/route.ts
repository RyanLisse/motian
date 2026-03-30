import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";

const feedbackSchema = z.object({
  messageId: z.string().min(1),
  score: z.enum(["positive", "negative"]),
  comment: z.string().max(1000).optional(),
});

export const POST = withApiHandler(
  async (req: Request) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Ongeldige JSON" }, { status: 400 });
    }

    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Ongeldige feedback data" }, { status: 400 });
    }

    const { messageId, score, comment } = parsed.data;

    // Send feedback to LangSmith if configured
    const apiKey = process.env.LANGSMITH_API_KEY ?? process.env.LANGCHAIN_API_KEY;

    if (apiKey) {
      try {
        const { Client } = await import("langsmith");
        const client = new Client({ apiKey });

        await client.createFeedback(null, "user_score", {
          score: score === "positive" ? 1 : 0,
          value: score,
          comment: comment ?? undefined,
          sourceInfo: {
            messageId,
            source: "chat_ui",
            timestamp: new Date().toISOString(),
          },
          feedbackSourceType: "app",
        });
      } catch (err) {
        console.error("[chat/feedback] LangSmith feedback failed:", err);
        // Non-fatal — still return success to the user
      }
    }

    return Response.json({ ok: true, messageId, score });
  },
  {
    errorMessage: "Kan feedback niet opslaan",
    logPrefix: "POST /api/chat/feedback error",
    rateLimit: { interval: 60_000, limit: 30 },
  },
);
