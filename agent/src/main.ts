import "dotenv/config";
import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from "@livekit/agents";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { MotianAgent } from "./agent";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      stt: new inference.STT({ model: "deepgram/nova-3", language: "nl" }),
      llm: new inference.LLM({
        model: "openai/gpt-5-nano",
        provider: "openrouter",
        modelOptions: { temperature: 0.7 },
      }),
      tts: new inference.TTS({
        model: "cartesia/sonic-3",
        voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        language: "nl",
      }),
      vad: ctx.proc.userData.vad as silero.VAD,
    });

    await session.start({
      agent: new MotianAgent(),
      room: ctx.room,
    });

    await ctx.connect();

    session.generateReply({
      instructions:
        "Begroet de gebruiker kort en vriendelijk in het Nederlands. Zeg dat je Motian AI bent en vraag waarmee je kunt helpen.",
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "motian-voice-agent",
  }),
);
