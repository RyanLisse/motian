const LIVEKIT_URL_ENV_KEYS = ["LIVEKIT_URL", "NEXT_PUBLIC_LIVEKIT_URL"] as const;

export const LIVEKIT_UNCONFIGURED_ERROR = "LiveKit niet geconfigureerd";

export type LiveKitServerConfig = {
  apiKey: string;
  apiSecret: string;
  url: string;
};

type LiveKitConfigStatus =
  | {
      enabled: true;
      config: LiveKitServerConfig;
    }
  | {
      enabled: false;
      error: typeof LIVEKIT_UNCONFIGURED_ERROR;
    };

function readEnvValue(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  return value ? value : null;
}

export function getLiveKitServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): LiveKitServerConfig | null {
  const apiKey = readEnvValue(env, "LIVEKIT_API_KEY");
  const apiSecret = readEnvValue(env, "LIVEKIT_API_SECRET");
  const url = LIVEKIT_URL_ENV_KEYS.map((key) => readEnvValue(env, key)).find(Boolean) ?? null;

  if (!apiKey || !apiSecret || !url) {
    return null;
  }

  return { apiKey, apiSecret, url };
}

export function getLiveKitConfigStatus(env: NodeJS.ProcessEnv = process.env): LiveKitConfigStatus {
  const config = getLiveKitServerConfig(env);

  if (!config) {
    return {
      enabled: false,
      error: LIVEKIT_UNCONFIGURED_ERROR,
    };
  }

  return {
    enabled: true,
    config,
  };
}
