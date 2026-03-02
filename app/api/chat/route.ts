import { convertToModelMessages, stepCountIs } from "ai";

import { z } from "zod";
import { buildSystemPrompt, chatModel, recruitmentTools } from "@/src/ai/agent";
import { db } from "@/src/db";
import { chatSessions } from "@/src/db/schema";
import { tracedStreamText as streamText } from "@/src/lib/ai-models";
import { rateLimit } from "@/src/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 20 });
const MAX_STORED_MESSAGES = 50;

const contextSchema = z
  .object({
    route: z.string().max(200).nullish(),
    entityId: z.string().uuid().nullish(),
    entityType: z.enum(["opdracht", "kandidaat"]).nullish(),
    sessionId: z.string().max(100).nullish(),
  })
  .nullish();

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous";
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  const contextResult = contextSchema.safeParse(body.context);
  if (!contextResult.success) {
    return Response.json({ error: "Ongeldige context" }, { status: 400 });
  }

  const ctx = contextResult.data ?? undefined;
  const sessionId = ctx?.sessionId;

  // Persist conversation turn (fire-and-forget, non-blocking)
  if (sessionId) {
    const lastMessages = body.messages.slice(-MAX_STORED_MESSAGES);
    db.insert(chatSessions)
      .values({
        sessionId,
        messages: lastMessages,
        context: ctx,
        messageCount: lastMessages.length,
      })
      .onConflictDoUpdate({
        target: chatSessions.sessionId,
        set: {
          messages: lastMessages,
          context: ctx,
          messageCount: lastMessages.length,
          updatedAt: new Date(),
        },
      })
      .catch(() => {}); // Non-blocking — don't fail the chat if persistence fails
  }

  const system = await buildSystemPrompt(ctx);

  const result = streamText({
    model: chatModel,
    system,
    messages: await convertToModelMessages(body.messages),
    tools: recruitmentTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
  });
}
