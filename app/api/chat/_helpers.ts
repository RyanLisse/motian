import type { UIMessage } from "ai";
import { z } from "zod";
import { and, db, eq, isNull } from "@/src/db";
import { chatSessions } from "@/src/db/schema";
import {
  tracedGenerateObject as generateObject,
  resolveChatModel,
} from "@/src/lib/ai-models";
import { incrementSessionTokens } from "@/src/services/chat-sessions";
import { rateLimit } from "@/src/lib/rate-limit";

// ---------------------------------------------------------------------------
// Rate limiter (shared singleton)
// ---------------------------------------------------------------------------

const limiter = rateLimit({ interval: 60_000, limit: 20 });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Optioneel max tokens per sessie (env CHAT_MAX_TOKENS_PER_SESSION). Bij overschrijding: 429 + fallbackmelding. */
export const CHAT_MAX_TOKENS_PER_SESSION = (() => {
  const raw = process.env.CHAT_MAX_TOKENS_PER_SESSION;
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
})();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const contextSchema = z
  .object({
    route: z.string().max(200).nullish(),
    entityId: z.string().uuid().nullish(),
    entityType: z.enum(["opdracht", "kandidaat"]).nullish(),
    sessionId: z.string().max(100).nullish(),
  })
  .nullish();

// ---------------------------------------------------------------------------
// extractClientIp
// ---------------------------------------------------------------------------

export function extractClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous"
  );
}

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

export function checkRateLimit(ip: string): Response | null {
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// parseRequestBody
// ---------------------------------------------------------------------------

export async function parseRequestBody(
  req: Request,
): Promise<{ messages: UIMessage[]; context: z.infer<typeof contextSchema>; model: string } | Response> {
  const body = await req.json().catch(() => null);
  const requestMessages = Array.isArray(body?.messages)
    ? (body.messages as UIMessage[])
    : body?.message
      ? ([body.message] as UIMessage[])
      : [];

  if (!body || requestMessages.length === 0) {
    return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  const contextResult = contextSchema.safeParse(body.context);
  if (!contextResult.success) {
    return Response.json({ error: "Ongeldige context" }, { status: 400 });
  }

  return {
    messages: requestMessages,
    context: contextResult.data,
    model: body.model as string,
  };
}

// ---------------------------------------------------------------------------
// checkTokenBudget
// ---------------------------------------------------------------------------

type SessionSnapshot =
  | { messageCount: number; tokensUsed: number; loadFailed: false }
  | { messageCount: null; tokensUsed: null; loadFailed: true };

export function checkTokenBudget(
  sessionId: string,
  snapshot: SessionSnapshot | null,
  maxTokens: number | undefined,
): Response | null {
  if (!maxTokens) return null;

  if (snapshot?.loadFailed) {
    return Response.json(
      {
        error:
          "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek om verder te gaan.",
      },
      { status: 429 },
    );
  }
  const used = snapshot?.tokensUsed ?? 0;
  if (used >= maxTokens) {
    return Response.json(
      {
        error:
          "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek om verder te gaan.",
      },
      { status: 429 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// generateSessionTitle
// ---------------------------------------------------------------------------

export async function generateSessionTitle(
  sessionId: string,
  userText: string,
  _model?: string,
): Promise<void> {
  let title: string | null = null;

  try {
    const titleResult = await generateObject({
      model: resolveChatModel("gemini-3.1-flash-lite"),
      schema: z.object({
        title: z
          .string()
          .max(50)
          .describe("Korte titel voor dit gesprek in 3-6 woorden, Nederlands"),
      }),
      prompt: `Genereer een korte titel (3-6 woorden) voor dit gesprek. Gebruikersvraag: "${userText.slice(0, 200)}"`,
    });
    title = (titleResult.object as { title: string }).title;
  } catch (err) {
    console.error("[chat] Title generation failed:", err);
    return;
  }

  try {
    await db
      .update(chatSessions)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(and(eq(chatSessions.sessionId, sessionId), isNull(chatSessions.title)));
  } catch (err) {
    console.error("[chat] Title update failed:", err);
  }
}

// ---------------------------------------------------------------------------
// trackTokenUsage
// ---------------------------------------------------------------------------

export function trackTokenUsage(
  resultPromise: Promise<unknown>,
  sessionId: string,
): void {
  void Promise.resolve(resultPromise)
    .then(async (final) => {
      const usage = (final as { usage?: { promptTokens?: number; completionTokens?: number } })
        ?.usage;
      if (!usage) return;
      const prompt = usage.promptTokens ?? 0;
      const completion = usage.completionTokens ?? 0;
      const delta = prompt + completion;
      if (delta <= 0) return;
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
        await incrementSessionTokens(sessionId, delta);
      } catch (err) {
        console.error("[chat] Token usage update failed:", err);
      }
    })
    .catch(() => {});
}
