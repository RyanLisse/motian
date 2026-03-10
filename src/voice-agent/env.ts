import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

export function applyVoiceAgentEnvFallbacks(env: NodeJS.ProcessEnv = process.env) {
  if (!env.GOOGLE_API_KEY && env.GOOGLE_GENERATIVE_AI_API_KEY) {
    env.GOOGLE_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;
  }

  if (!env.LIVEKIT_URL && env.NEXT_PUBLIC_LIVEKIT_URL) {
    env.LIVEKIT_URL = env.NEXT_PUBLIC_LIVEKIT_URL;
  }

  if (!env.NEXT_PUBLIC_LIVEKIT_URL && env.LIVEKIT_URL) {
    env.NEXT_PUBLIC_LIVEKIT_URL = env.LIVEKIT_URL;
  }

  return env;
}

export function loadVoiceAgentEnv(env: NodeJS.ProcessEnv = process.env) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

  for (const fileName of [".env.local", ".env"]) {
    const path = join(projectRoot, fileName);
    if (existsSync(path)) {
      dotenvConfig({ path, override: false, processEnv: env });
    }
  }

  return applyVoiceAgentEnvFallbacks(env);
}
