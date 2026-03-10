import { convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { after } from "next/server";
import { z } from "zod";
import { buildSystemPrompt, getRecruitmentTools } from "@/src/ai/agent";
import { db } from "@/src/db";
import { chatSessions } from "@/src/db/schema";
import {
  tracedGenerateObject as generateObject,
  resolveChatModel,
  tracedStreamText as streamText,
} from "@/src/lib/ai-models";
import { rateLimit } from "@/src/lib/rate-limit";
import {
  type ChatSessionContext,
  getRecentMessagesForContext,
  getSessionRequestSnapshot,
  incrementSessionTokens,
  persistMessages,
} from "@/src/services/chat-sessions";

const limiter = rateLimit({ interval: 60_000, limit: 20 });

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

function getMessageText(message: UIMessage): string {
  const textParts = Array.isArray(message.parts)
    ? message.parts
        .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => {
          return part.type === "text" && typeof part.text === "string";
        })
        .map((part) => part.text.trim())
        .filter(Boolean)
    : [];

  if (textParts.length > 0) {
    return textParts.join("\n").trim();
  }

  const legacyContent = (message as UIMessage & { content?: unknown }).content;
  return typeof legacyContent === "string" ? legacyContent.trim() : "";
}

async function loadSessionMessagesOrFallback(
  sessionId: string,
  limit: number | undefined,
  fallback: UIMessage[],
): Promise<UIMessage[]> {
  try {
    return await getRecentMessagesForContext(sessionId, limit);
  } catch (error) {
    console.error("[chat] Session history load failed:", error);
    return fallback;
  }
}

type SessionSnapshot =
  | { messageCount: number; tokensUsed: number; loadFailed: false }
  | { messageCount: null; tokensUsed: null; loadFailed: true };

async function loadSessionSnapshotOrFallback(sessionId: string): Promise<SessionSnapshot> {
  try {
    const result = await getSessionRequestSnapshot(sessionId);
    return { ...result, loadFailed: false };
  } catch (error) {
    console.error("[chat] Session snapshot load failed:", error);
    return { messageCount: null, tokensUsed: null, loadFailed: true };
  }
}

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

  const ctx = (contextResult.data ?? undefined) as ChatSessionContext | undefined;
  const sessionId = ctx?.sessionId;
  const latestUserMessage = [...requestMessages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserText = latestUserMessage ? getMessageText(latestUserMessage) : "";
  const sessionSnapshot = sessionId ? await loadSessionSnapshotOrFallback(sessionId) : null;

  // AI-budget (Fase 4): als er een sessielimiet is en we hebben een sessionId, check tokensUsed
  if (sessionId && CHAT_MAX_TOKENS_PER_SESSION != null) {
    if (sessionSnapshot?.loadFailed) {
      return Response.json(
        {
          error:
            "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek om verder te gaan.",
        },
        { status: 429 },
      );
    }
    const used = sessionSnapshot?.tokensUsed ?? 0;
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

  let userMessagesPersisted = true;
  if (sessionId) {
    try {
      await persistMessages({
        sessionId,
        context: ctx,
        messages: requestMessages,
      });
    } catch (error) {
      userMessagesPersisted = false;
      console.error("[chat] User message persistence failed:", error);
    }

    const shouldGenerateTitle =
      !sessionSnapshot?.loadFailed &&
      (sessionSnapshot?.messageCount ?? 0) === 0 &&
      latestUserText.length > 0 &&
      requestMessages.filter((message) => message.role === "user").length === 1;

    if (shouldGenerateTitle) {
      after(async () => {
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
            prompt: `Genereer een korte titel (3-6 woorden) voor dit gesprek. Gebruikersvraag: "${latestUserText.slice(0, 200)}"`,
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
      });
    }
  }

  const modelMessages = sessionId && userMessagesPersisted
    ? await loadSessionMessagesOrFallback(sessionId, undefined, requestMessages)
    : requestMessages;

  const system = await buildSystemPrompt(ctx);
  const model = resolveChatModel(body.model);

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(modelMessages),
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

  return result.toUIMessageStreamResponse({
    originalMessages: requestMessages,
    generateMessageId: nanoid,
    sendReasoning: true,
    sendSources: true,
    onFinish: async ({ responseMessage }) => {
      if (!sessionId || !responseMessage || !userMessagesPersisted) {
        return;
      }

      try {
        await persistMessages({
          sessionId,
          context: ctx,
          messages: [responseMessage],
        });
      } catch (err) {
        console.error("[chat] Assistant message persistence failed:", err);
      }
    },
  });
}
