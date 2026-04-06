import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

export type RuntimeEnvFallback = {
  source: string;
  target: string;
  bidirectional?: boolean;
};

export const AI_PLATFORM_RUNTIME_ENV_FALLBACKS: readonly RuntimeEnvFallback[] = [
  { source: "GOOGLE_GENERATIVE_AI_API_KEY", target: "GOOGLE_API_KEY" },
  { source: "NEXT_PUBLIC_LIVEKIT_URL", target: "LIVEKIT_URL", bidirectional: true },
] as const;

/**
 * Resolve the current Motian workspace root from a runtime entrypoint.
 *
 * This assumes the nearest ancestor containing both `pnpm-workspace.yaml` and
 * `package.json` is the workspace root. If runtimes later move into a nested
 * app/workspace topology, add an explicit override rather than broadening this
 * heuristic implicitly.
 */
export function findWorkspaceRoot(fromModuleUrl: string): string {
  let current = dirname(fileURLToPath(fromModuleUrl));

  while (true) {
    const hasWorkspace = existsSync(join(current, "pnpm-workspace.yaml"));
    const hasPackage = existsSync(join(current, "package.json"));
    if (hasWorkspace && hasPackage) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

export function applyRuntimeEnvFallbacks(
  fallbacks: readonly RuntimeEnvFallback[],
  env: NodeJS.ProcessEnv = process.env,
) {
  for (const fallback of fallbacks) {
    if (!env[fallback.target] && env[fallback.source]) {
      env[fallback.target] = env[fallback.source];
    }

    if (fallback.bidirectional && !env[fallback.source] && env[fallback.target]) {
      env[fallback.source] = env[fallback.target];
    }
  }

  return env;
}

export function loadRuntimeEnvFromWorkspace(
  fromModuleUrl: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const workspaceRoot = findWorkspaceRoot(fromModuleUrl);

  for (const fileName of [".env.local", ".env"]) {
    const path = join(workspaceRoot, fileName);
    if (existsSync(path)) {
      dotenvConfig({ path, override: false, processEnv: env });
    }
  }

  return env;
}

export function loadAiPlatformRuntimeEnv(
  fromModuleUrl: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  loadRuntimeEnvFromWorkspace(fromModuleUrl, env);
  return applyRuntimeEnvFallbacks(AI_PLATFORM_RUNTIME_ENV_FALLBACKS, env);
}
