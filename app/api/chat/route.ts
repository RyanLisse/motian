import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { buildSystemPrompt, chatModel, recruitmentTools } from "@/src/ai/agent";

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const system = await buildSystemPrompt(context);

  const result = streamText({
    model: chatModel,
    system,
    messages: await convertToModelMessages(messages),
    tools: recruitmentTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
