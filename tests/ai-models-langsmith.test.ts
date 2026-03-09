import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyLangSmithEnvFallbacks,
  getLangSmithApiKey,
  getLangSmithProject,
  isLangSmithTracingEnabled,
} from "@/src/lib/ai-models";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("LangSmith env fallbacks", () => {
  it("maps legacy LangChain env vars onto official LangSmith names", () => {
    const env = {
      LANGCHAIN_TRACING_V2: "true",
      LANGCHAIN_API_KEY: "legacy-key",
      LANGCHAIN_PROJECT: "legacy-project",
    } as NodeJS.ProcessEnv;

    applyLangSmithEnvFallbacks(env);

    expect(env.LANGSMITH_TRACING).toBe("true");
    expect(env.LANGSMITH_API_KEY).toBe("legacy-key");
    expect(env.LANGSMITH_PROJECT).toBe("legacy-project");
    expect(getLangSmithApiKey(env)).toBe("legacy-key");
    expect(getLangSmithProject(env)).toBe("legacy-project");
  });

  it("does not overwrite explicitly configured official LangSmith env vars", () => {
    const env = {
      LANGSMITH_TRACING: "false",
      LANGSMITH_API_KEY: "official-key",
      LANGSMITH_PROJECT: "official-project",
      LANGCHAIN_TRACING_V2: "true",
      LANGCHAIN_API_KEY: "legacy-key",
      LANGCHAIN_PROJECT: "legacy-project",
    } as NodeJS.ProcessEnv;

    applyLangSmithEnvFallbacks(env);

    expect(env.LANGSMITH_TRACING).toBe("false");
    expect(env.LANGSMITH_API_KEY).toBe("official-key");
    expect(env.LANGSMITH_PROJECT).toBe("official-project");
  });
});

describe("LangSmith tracing enablement", () => {
  it("supports explicit disable even when an API key is present", () => {
    expect(
      isLangSmithTracingEnabled({
        LANGSMITH_TRACING: "false",
        LANGSMITH_API_KEY: "ls-disabled",
      }),
    ).toBe(false);
  });

  it("preserves compatibility by enabling tracing when only legacy env vars are present", () => {
    expect(
      isLangSmithTracingEnabled({
        LANGCHAIN_TRACING_V2: "true",
        LANGCHAIN_API_KEY: "ls-legacy",
      }),
    ).toBe(true);
  });

  it("stays disabled when tracing is requested without an API key", () => {
    expect(
      isLangSmithTracingEnabled({
        LANGSMITH_TRACING: "true",
      }),
    ).toBe(false);
  });

  it("loads the LangSmith wrapper via an ESM-safe createRequire bridge", () => {
    const source = readFile("src", "lib", "ai-models.ts");

    expect(source).toContain('import { createRequire } from "node:module";');
    expect(source).toContain("const langsmithRequire = createRequire(import.meta.url);");
    expect(source).toContain('langsmithRequire("langsmith/experimental/vercel")');
  });
});
