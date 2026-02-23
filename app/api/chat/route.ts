import { convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { buildSystemPrompt, chatModel, recruitmentTools } from "@/src/ai/agent";
import { tracedStreamText as streamText } from "@/src/lib/ai-models";
import { rateLimit } from "@/src/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 20 });

const contextSchema = z
  .object({
    route: z.string().max(200).optional(),
    entityId: z.string().uuid().optional(),
    entityType: z.enum(["opdracht", "kandidaat"]).optional(),
  })
  .optional();

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

  const system = await buildSystemPrompt(contextResult.data ?? undefined);

  const result = streamText({
    model: chatModel,
    system,
    messages: await convertToModelMessages(body.messages),
    tools: recruitmentTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
