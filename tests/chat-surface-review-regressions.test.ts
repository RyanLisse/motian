import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat surface review regressions", () => {
  it("disables suggestion controls instead of leaving dead buttons when no handler is present", () => {
    const source = readFile("components", "chat", "chat-messages.tsx");

    expect(source).toContain("const isInteractive = hasSuggestionHandler(onSelect);");
    expect(source).toContain("disabled={!isInteractive}");
    expect(source).toContain("aria-disabled={!isInteractive}");
    expect(source).toContain("cursor-not-allowed opacity-60");
  });

  it("keeps only the explicit CV upload path in the full-page chat composer", () => {
    const source = readFile("src", "components", "ai-elements", "chat-prompt-composer.tsx");

    expect(source).toContain("<PromptInput allowAttachments={false} onSubmit={handleSubmit}>");
    expect(source).toContain("allowAttachments={false}");
    expect(source).toContain("CV uploaden");
    expect(source).not.toContain("PromptInputActionAddAttachments");
    expect(source).not.toContain("usePromptInputAttachments");
    expect(source).not.toContain("ChatPromptAttachmentList");
  });

  it("lets prompt-input consumers disable attachment intake", () => {
    const source = readFile("src", "components", "ai-elements", "prompt-input.tsx");

    expect(source).toContain("allowAttachments?: boolean");
    expect(source).toContain("allowAttachments = true");
    expect(source).toContain("if (!allowAttachments) {");
  });

  it("disables generic attachment intake in the chat widget while keeping the explicit CV upload control", () => {
    const source = readFile("components", "chat", "chat-widget.tsx");

    expect(source).toContain("<PromptInput allowAttachments={false} onSubmit={handleSubmit}>");
    expect(source).toContain("<PromptInputTextarea");
    expect(source).toContain("allowAttachments={false}");
    expect(source).toContain('title="CV/document uploaden"');
    expect(source).toContain("fileInputRef.current?.click()");
  });
});
