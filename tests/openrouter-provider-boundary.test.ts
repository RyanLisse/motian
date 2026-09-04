import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

function packageJson(...segments: string[]): { dependencies?: Record<string, string> } {
  return JSON.parse(readFile(...segments, "package.json"));
}

describe("OpenRouter provider boundary", () => {
  it("routes app chat and embeddings through the OpenRouter AI SDK provider", () => {
    const source = readFile("src", "lib", "ai-models.ts");

    expect(source).toContain("@openrouter/ai-sdk-provider");
    expect(source).toContain("createOpenRouter");
    expect(source).toContain("process.env.OPENROUTER_API_KEY");
    expect(source).toContain("openrouter.textEmbeddingModel");
  });

  it("does not keep direct app-side AI provider SDK dependencies", () => {
    const deps = packageJson().dependencies ?? {};
    const directAppDeps = ["openai", "google", "xai"].map((provider) =>
      ["@ai-sdk", provider].join("/"),
    );

    expect(deps).toHaveProperty("@openrouter/ai-sdk-provider");
    for (const dep of directAppDeps) {
      expect(deps).not.toHaveProperty(dep);
    }
  });

  it("documents OpenRouter as the only app-side AI provider key", () => {
    const envExample = readFile(".env.example");
    const directProviderKeys = [
      ["OPENAI", "API", "KEY"].join("_"),
      ["ANTHROPIC", "API", "KEY"].join("_"),
      ["GOOGLE", "API", "KEY"].join("_"),
      ["GOOGLE", "GENERATIVE", "AI", "API", "KEY"].join("_"),
      ["X", "AI", "API", "KEY"].join("_"),
    ];

    expect(envExample).toContain("OPENROUTER_API_KEY=");
    for (const key of directProviderKeys) {
      expect(envExample).not.toContain(`${key}=`);
    }
  });

  it("keeps the voice-agent entrypoint off direct Google realtime keys", () => {
    const rootVoice = readFile("src", "voice-agent", "main.ts");
    const rootDeps = packageJson().dependencies ?? {};
    const directGoogleKeys = [
      ["GOOGLE", "API", "KEY"].join("_"),
      ["GOOGLE", "GENERATIVE", "AI", "API", "KEY"].join("_"),
    ];
    const googleRealtimePlugin = ["@livekit", "agents-plugin-google"].join("/");

    expect(rootVoice).toContain("new inference.LLM");
    for (const key of directGoogleKeys) {
      expect(rootVoice).not.toContain(key);
    }
    expect(rootDeps).not.toHaveProperty(googleRealtimePlugin);
  });
});
