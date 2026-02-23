import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { z } from "zod";
import { buildSystemPrompt, chatModel, recruitmentTools } from "@/src/ai/agent";
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
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anonymous";
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }

  const body = await req.json();
  const context = contextSchema.parse(body.context);

  const system = await buildSystemPrompt(context ?? undefined);

  const result = streamText({
    model: chatModel,
    system,
    messages: await convertToModelMessages(body.messages),
    tools: recruitmentTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
