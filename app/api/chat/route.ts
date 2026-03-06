import { convertToModelMessages, stepCountIs } from "ai";
import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { buildSystemPrompt, getRecruitmentTools } from "@/src/ai/agent";
import { db } from "@/src/db";
import { chatSessions } from "@/src/db/schema";
import { resolveChatModel, tracedStreamText as streamText } from "@/src/lib/ai-models";
import { rateLimit } from "@/src/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 20 });
const MAX_STORED_MESSAGES = 50;

/** Optioneel max tokens per sessie (env CHAT_MAX_TOKENS_PER_SESSION). Bij overschrijding: 429 + fallbackmelding. */
const CHAT_MAX_TOKENS_PER_SESSION = (() => {
  const raw = process.env.CHAT_MAX_TOKENS_PER_SESSION;
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
})();

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

  // AI-budget (Fase 4): als er een sessielimiet is en we hebben een sessionId, check tokensUsed
  if (sessionId && CHAT_MAX_TOKENS_PER_SESSION != null) {
    const [row] = await db
      .select({ tokensUsed: chatSessions.tokensUsed })
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);
    const used = row?.tokensUsed ?? 0;
    if (used >= CHAT_MAX_TOKENS_PER_SESSION) {
      return Response.json(
        {
          error:
            "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek om verder te gaan.",
        },
        { status: 429 },
      );
    }
  }

  // Persist conversation using after() — runs after response streams, guaranteed to complete
  if (sessionId) {
    const lastMessages = body.messages.slice(-MAX_STORED_MESSAGES);
    const lastUserMsg = [...body.messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    const preview =
      typeof lastUserMsg?.content === "string" ? lastUserMsg.content.slice(0, 100) : null;

    // Extract title from first user message (only set once)
    const firstUserMsg = body.messages.find((m: { role: string }) => m.role === "user");
    const title =
      typeof firstUserMsg?.content === "string" ? firstUserMsg.content.slice(0, 60) : null;

    after(async () => {
      try {
        await db
          .insert(chatSessions)
          .values({
            sessionId,
            messages: lastMessages,
            context: ctx,
            messageCount: lastMessages.length,
            title,
            lastMessagePreview: preview,
          })
          .onConflictDoUpdate({
            target: chatSessions.sessionId,
            set: {
              messages: lastMessages,
              context: ctx,
              messageCount: lastMessages.length,
              lastMessagePreview: preview,
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        console.error("[chat] Session persistence failed:", err);
      }
    });
  }

  const system = await buildSystemPrompt(ctx);
  const model = resolveChatModel(body.model);

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(body.messages),
    tools: getRecruitmentTools(ctx),
    stopWhen: stepCountIs(5),
  });

  // Na afloop van de stream: sessie-tokenbudget bijwerken (Fase 4) + AI-cost logging
  if (sessionId) {
    void Promise.resolve(result)
      .then(async (final) => {
        const usage = final?.usage as
          | { promptTokens?: number; completionTokens?: number }
          | undefined;
        if (!usage) return;
        const prompt = usage.promptTokens ?? 0;
        const completion = usage.completionTokens ?? 0;
        const delta = prompt + completion;
        if (delta <= 0) return;
        // Structured AI-cost log for baseline and Fase 4 SLO/budget
        console.log(
          JSON.stringify({
            flow: "chat",
            promptTokens: prompt,
            completionTokens: completion,
            totalTokens: delta,
            sessionId,
          }),
        );
        try {
          await db
            .update(chatSessions)
            .set({
              tokensUsed: sql`coalesce(${chatSessions.tokensUsed}, 0) + ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(chatSessions.sessionId, sessionId));
        } catch (err) {
          console.error("[chat] Token usage update failed:", err);
        }
      })
      .catch(() => {});
  }

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
  });
}
