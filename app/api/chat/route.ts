import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  type UIMessage,
} from "ai";
import { nanoid } from "nanoid";
import { after } from "next/server";
import { buildSystemPrompt, getRecruitmentTools } from "@/src/ai/agent";
import { resolveChatModel, tracedStreamText as streamText } from "@/src/lib/ai-models";
import {
  type ChatSessionContext,
  getRecentMessagesForContext,
  getSessionRequestSnapshot,
  persistMessages,
} from "@/src/services/chat-sessions";
import {
  CHAT_MAX_TOKENS_PER_SESSION,
  checkRateLimit,
  checkTokenBudget,
  extractClientIp,
  generateSessionTitle,
  parseRequestBody,
  trackTokenUsage,
} from "./_helpers";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Rate limiting
  const ip = extractClientIp(req);
  const rateLimitResponse = checkRateLimit(ip);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Body parsing & validation
  const parsed = await parseRequestBody(req);
  if (parsed instanceof Response) return parsed;
  const { messages: requestMessages, context: contextData, model: requestModel } = parsed;

  // 2b. Slash command: /help or /hulp
  const firstMessage = requestMessages.at(-1);
  const firstMessageText = firstMessage?.role === "user" ? getMessageText(firstMessage) : "";
  if (/^\/(?:help|hulp)\b/i.test(firstMessageText)) {
    const helpText = `## Motian AI – Overzicht van mogelijkheden

**Vacatures**
Zoek vacatures voor Java developer · Analyseer tarief trends · Maak of bewerk een vacature

**Kandidaten**
Voeg kandidaat toe · Upload CV en match automatisch · Bekijk skills en beschikbaarheid

**Pipeline**
Toon pipeline overzicht · Plan interview · Werk sollicitatiefases bij

**Data & beheer**
Start scraper · Toon GDPR retentie status · Exporteer kandidaat- of contactdata

---
Typ een concrete vraag of kies een suggestie hieronder om te starten.`;

    const textId = nanoid();
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: helpText });
        writer.write({ type: "text-end", id: textId });
      },
      generateId: nanoid,
    });
    return createUIMessageStreamResponse({ stream });
  }

  // 3. Session context extraction
  const ctx = (contextData ?? undefined) as ChatSessionContext | undefined;
  const sessionId = ctx?.sessionId;
  const latestUserMessage = [...requestMessages]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserText = latestUserMessage ? getMessageText(latestUserMessage) : "";
  const sessionSnapshot = sessionId ? await loadSessionSnapshotOrFallback(sessionId) : null;

  // 4. Token budget checking
  if (sessionId) {
    const budgetResponse = checkTokenBudget(sessionSnapshot, CHAT_MAX_TOKENS_PER_SESSION);
    if (budgetResponse) return budgetResponse;
  }

  // 5. User message persistence & title generation
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
      after(() => generateSessionTitle(sessionId, latestUserText));
    }
  }

  // 6. Session message loading
  const modelMessages =
    sessionId && userMessagesPersisted
      ? await loadSessionMessagesOrFallback(sessionId, undefined, requestMessages)
      : requestMessages;

  // 7. Stream setup & response
  const system = await buildSystemPrompt(ctx ? { ...ctx, turnCount: requestMessages.length } : ctx);
  const model = resolveChatModel(requestModel);

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(modelMessages),
    tools: getRecruitmentTools(ctx),
    stopWhen: stepCountIs(5),
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        sessionId: sessionId ?? "anonymous",
        ...(ctx?.entityType ? { entityType: ctx.entityType } : {}),
        ...(ctx?.entityId ? { entityId: ctx.entityId } : {}),
      },
    },
  });

  // Track token usage after stream completes (result.usage is a Promise-like
  // that resolves only when the stream finishes — must be awaited before reading)
  if (sessionId) {
    trackTokenUsage(
      Promise.resolve(result.usage).then((usage) => ({ usage })),
      sessionId,
    );
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
