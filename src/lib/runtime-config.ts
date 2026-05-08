type EnvMap = Record<string, string | undefined>;

const LIVEKIT_ENV_VARS = [
  "NEXT_PUBLIC_LIVEKIT_URL",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
] as const;

function hasNonEmptyValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasEnv(name: string, env: EnvMap = process.env): boolean {
  return hasNonEmptyValue(env[name]);
}

export function isProductionEnvironment(env: EnvMap = process.env): boolean {
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();

  if (vercelEnv === "production") return true;
  if (vercelEnv === "preview") return false;

  return env.NODE_ENV === "production";
}

export function shouldAllowMissingApiSecret(env: EnvMap = process.env): boolean {
  return !isProductionEnvironment(env);
}

export function validateRuntimeEnv(env: EnvMap = process.env): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hasEnv("DATABASE_URL", env)) {
    errors.push("DATABASE_URL ontbreekt.");
  }

  if (isProductionEnvironment(env) && !hasEnv("API_SECRET", env)) {
    errors.push("API_SECRET is verplicht in productie om beschermde /api-routes af te schermen.");
  }

  const hasAnyLiveKitEnv = LIVEKIT_ENV_VARS.some((name) => hasEnv(name, env));
  if (hasAnyLiveKitEnv) {
    const missingLiveKitVars = LIVEKIT_ENV_VARS.filter((name) => !hasEnv(name, env));

    if (missingLiveKitVars.length > 0) {
      errors.push(`Voice-configuratie is onvolledig: ${missingLiveKitVars.join(", ")}.`);
    }
  }

  if (hasEnv("SENTRY_DSN", env) && !hasEnv("NEXT_PUBLIC_SENTRY_DSN", env)) {
    warnings.push(
      "SENTRY_DSN is gezet zonder NEXT_PUBLIC_SENTRY_DSN; browser-Sentry blijft uitgeschakeld.",
    );
  }

  if (!hasEnv("SENTRY_DSN", env) && hasEnv("NEXT_PUBLIC_SENTRY_DSN", env)) {
    warnings.push(
      "NEXT_PUBLIC_SENTRY_DSN is gezet zonder SENTRY_DSN; server/trigger Sentry blijft uitgeschakeld.",
    );
  }

  return { errors, warnings };
}
