import {
  AI_PLATFORM_RUNTIME_ENV_FALLBACKS,
  applyRuntimeEnvFallbacks,
  loadAiPlatformRuntimeEnv,
} from "@motian/ai-platform";

export function applyVoiceAgentEnvFallbacks(env: NodeJS.ProcessEnv = process.env) {
  return applyRuntimeEnvFallbacks(AI_PLATFORM_RUNTIME_ENV_FALLBACKS, env);
}

export function loadVoiceAgentEnv(env: NodeJS.ProcessEnv = process.env) {
  return loadAiPlatformRuntimeEnv(import.meta.url, env);
}
