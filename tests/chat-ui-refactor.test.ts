import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat UI refactor structure", () => {
  it("keeps context-aware starter and follow-up prompts in the full-page chat", () => {
    const source = readFile("components", "chat", "chat-page-content.tsx");

    expect(source).toContain("const GENERAL_STARTER_PROMPTS");
    expect(source).toContain("const JOB_STARTER_PROMPTS");
    expect(source).toContain("const CANDIDATE_STARTER_PROMPTS");
    expect(source).toContain("starterPrompts: JOB_STARTER_PROMPTS");
    expect(source).toContain("followUpPrompts: CANDIDATE_FOLLOW_UP_PROMPTS");
    expect(source).toContain("composerContextHint");
  });

  it("renders distinct empty-state and in-thread prompt surfaces with accessibility hooks", () => {
    const source = readFile("components", "chat", "chat-messages.tsx");

    expect(source).toContain("emptyStatePrompts");
    expect(source).toContain("followUpPrompts");
    expect(source).toContain("aria-label={conversationLabel}");
    expect(source).toContain("Vervolgideeën");
    expect(source).toContain("Enter om te verzenden");
  });
});
