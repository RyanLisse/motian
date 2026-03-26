import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const HARDCODED_SENTRY_DSN_FRAGMENT = "f13da1ff32b7d1f499309c7040de8fae";

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("runtime config hardening regressions", () => {
  it("keeps Sentry runtime files env-driven instead of shipping a fallback DSN", () => {
    const serverSource = readFile("instrumentation.ts");
    const clientSource = readFile("instrumentation-client.ts");
    const triggerSource = readFile("trigger.config.ts");
    const mcpSource = readFile("src", "mcp", "create-server.ts");

    expect(serverSource).toContain("process.env.SENTRY_DSN");
    expect(clientSource).toContain("process.env.NEXT_PUBLIC_SENTRY_DSN");
    expect(triggerSource).toContain("process.env.SENTRY_DSN");
    expect(mcpSource).toContain("process.env.SENTRY_DSN");

    expect(serverSource).not.toContain(HARDCODED_SENTRY_DSN_FRAGMENT);
    expect(clientSource).not.toContain(HARDCODED_SENTRY_DSN_FRAGMENT);
    expect(triggerSource).not.toContain(HARDCODED_SENTRY_DSN_FRAGMENT);
    expect(mcpSource).not.toContain(HARDCODED_SENTRY_DSN_FRAGMENT);
  });

  it("documents the voice envs required by the current runtime", () => {
    const envExample = readFile(".env.example");

    expect(envExample).toContain("GOOGLE_GENERATIVE_AI_API_KEY=");
    expect(envExample).toContain("GOOGLE_API_KEY=");
    expect(envExample).toContain("NEXT_PUBLIC_LIVEKIT_URL=");
    expect(envExample).toContain("LIVEKIT_URL=");
    expect(envExample).toContain("LIVEKIT_API_KEY=");
    expect(envExample).toContain("LIVEKIT_API_SECRET=");
  });
});
