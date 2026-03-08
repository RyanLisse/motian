export function getStableChatOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const configuredUrl = env.PUBLIC_API_BASE_URL ?? env.NEXT_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return null;
  }
}
