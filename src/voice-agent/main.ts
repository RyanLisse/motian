import { fileURLToPath } from "node:url";
import {
  cli,
  defineAgent,
  type JobContext,
  type JobProcess,
  ServerOptions,
  voice,
} from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";
import * as silero from "@livekit/agents-plugin-silero";
import { loadVoiceAgentEnv } from "./env.js";

loadVoiceAgentEnv();

const { MotianAgent } = await import("./agent.js");

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        apiKey: process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        voice: "Puck",
        temperature: 0.7,
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
