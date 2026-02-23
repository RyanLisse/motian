import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { z } from "zod";
import { buildSystemPrompt, chatModel, recruitmentTools } from "@/src/ai/agent";

const contextSchema = z
  .object({
    route: z.string().max(200).optional(),
    entityId: z.string().uuid().optional(),
    entityType: z.enum(["opdracht", "kandidaat"]).optional(),
  })
  .optional();

export async function POST(req: Request) {
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
