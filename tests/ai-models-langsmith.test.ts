import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getLangSmithApiKey,
  getLangSmithProject,
  isLangSmithTracingEnabled,
} from "@/src/lib/ai-models";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("LangSmith env resolution", () => {
  it("reads official LangSmith env vars", () => {
    const env = {
      LANGSMITH_TRACING: "true",
      LANGSMITH_API_KEY: "official-key",
      LANGSMITH_PROJECT: "official-project",
    } as NodeJS.ProcessEnv;

    expect(getLangSmithApiKey(env)).toBe("official-key");
    expect(getLangSmithProject(env)).toBe("official-project");
  });

  it("ignores legacy LangChain env vars", () => {
    const env = {
      LANGCHAIN_TRACING_V2: "true",
      LANGCHAIN_API_KEY: "legacy-key",
      LANGCHAIN_PROJECT: "legacy-project",
    } as NodeJS.ProcessEnv;

    expect(getLangSmithApiKey(env)).toBeUndefined();
    expect(getLangSmithProject(env)).toBeUndefined();
    expect(isLangSmithTracingEnabled(env)).toBe(false);
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

  it("enables tracing when LANGSMITH vars are present", () => {
    expect(
      isLangSmithTracingEnabled({
        LANGSMITH_TRACING: "true",
        LANGSMITH_API_KEY: "ls-official",
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
    expect(source).not.toContain("LANGCHAIN_");
  });
});

describe("LangSmith env schema", () => {
  it("declares LANGSMITH vars without legacy LANGCHAIN fallbacks in src/env.ts", () => {
    const envSource = readFile("src", "env.ts");

    expect(envSource).toContain("LANGSMITH_TRACING:");
    expect(envSource).toContain("LANGSMITH_API_KEY:");
    expect(envSource).toContain("LANGSMITH_PROJECT:");
    expect(envSource).not.toContain("LANGCHAIN_");
  });
});
