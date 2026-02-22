import { streamText, stepCountIs, convertToModelMessages } from "ai";
import {
  chatModel,
  recruitmentTools,
  buildSystemPrompt,
} from "@/src/ai/agent";

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const result = streamText({
    model: chatModel,
    system: buildSystemPrompt(context),
    messages: await convertToModelMessages(messages),
    tools: recruitmentTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
