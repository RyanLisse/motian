import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Product boundary split — first execution slice", () => {
  it("publishes the architecture ownership map", () => {
    const docPath = join(ROOT, "docs/architecture/product-boundaries.md");
    expect(existsSync(docPath)).toBe(true);

    const content = read("docs/architecture/product-boundaries.md");

    for (const heading of [
      "# Motian product boundaries",
      "## Purpose",
      "## Decision Rules",
      "## Current-State Ownership Map",
      "## Runtime Owner / Consumer / Adapter Map",
      "## Migration Guidance",
    ]) {
      expect(content).toContain(heading);
    }

    for (const boundary of [
      "AI Platform",
      "Recruiter Operations",
      "Sourcing & Ingestion",
      "Ops & Compliance",
    ]) {
      expect(content).toContain(boundary);
    }
  });

  it("maps major repo areas and runtime entrypoints in the ownership doc", () => {
    const content = read("docs/architecture/product-boundaries.md");

    for (const area of [
      "`app/vacatures/`, `app/opdrachten/`",
      "`app/kandidaten/`",
      "`src/ai/`",
      "`src/mcp/`",
      "`src/voice-agent/`",
      "`src/autopilot/`",
      "`packages/scrapers`",
      "`packages/db`",
      "`trigger/`",
      "`agent/`",
    ]) {
      expect(content).toContain(area);
    }

    for (const runtimeEntry of [
      "`src/voice-agent/main.ts`",
      "`src/mcp/server.ts`",
      "`app/chat/`",
      "`app/vacatures/`, `app/opdrachten/`, `app/kandidaten/`, `app/interviews/`, `app/overzicht/`",
    ]) {
      expect(content).toContain(runtimeEntry);
    }
  });

  it("defines the ai-platform workspace seam", () => {
    expect(existsSync(join(ROOT, "packages/ai-platform/package.json"))).toBe(true);
    expect(existsSync(join(ROOT, "packages/ai-platform/src/index.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "packages/ai-platform/src/runtime-env.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "packages/ai-platform/src/surfaces.ts"))).toBe(true);

    expect(read("package.json")).toContain('"@motian/ai-platform": "workspace:*"');

    const tsconfigBase = read("tsconfig.base.json");
    expect(tsconfigBase).toContain('"@motian/ai-platform"');
    expect(tsconfigBase).toContain('"./packages/ai-platform/src/index.ts"');

    const packageIndex = read("packages/ai-platform/src/index.ts");
    expect(packageIndex).toContain("loadAiPlatformRuntimeEnv");
    expect(packageIndex).toContain("MOTIAN_AI_PLATFORM_SURFACES");
  });

  it("routes MCP and voice runtime env loading through the ai-platform package", () => {
    const mcpServer = read("src/mcp/server.ts");
    expect(mcpServer).toContain('from "@motian/ai-platform"');
    expect(mcpServer).toContain("loadAiPlatformRuntimeEnv(import.meta.url)");
    expect(mcpServer).not.toContain('from "dotenv"');
    expect(mcpServer).not.toContain('config({ path: ".env.local" })');

    const voiceEnv = read("src/voice-agent/env.ts");
    expect(voiceEnv).toContain('from "@motian/ai-platform"');
    expect(voiceEnv).toContain("loadAiPlatformRuntimeEnv(import.meta.url, env)");
    expect(voiceEnv).toContain("AI_PLATFORM_RUNTIME_ENV_FALLBACKS");
    expect(voiceEnv).not.toContain('from "dotenv"');
  });

  it("tracks the initial AI platform surface registry", () => {
    const surfaces = read("packages/ai-platform/src/surfaces.ts");
    for (const surfaceId of ["chat", "mcp", "voice", "autopilot"]) {
      expect(surfaces).toContain(`id: "${surfaceId}"`);
    }

    expect(surfaces).toContain('entrypoint: "src/mcp/server.ts"');
    expect(surfaces).toContain('entrypoint: "src/voice-agent/agent.ts"');
  });
});
