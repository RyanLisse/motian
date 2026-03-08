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

    expect(source).toContain("globalDrop");
    expect(source).toContain("onError={cvUpload.handlePromptInputError}");
    expect(source).toContain("ChatCvUploadStatusBanner");
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

    expect(source).toContain("PromptInputProvider");
    expect(source).toContain("useChatCvUpload");
    expect(source).toContain("ChatCvDropOverlay");
    expect(source).toContain("globalDrop");
    expect(source).toContain("{open ? (");
    expect(source).toContain('title="CV/document uploaden"');
    expect(source).toContain("cvUpload.openFileDialog");
  });

  it("guards the shared CV upload flow against stale timers and unmounted uploads", () => {
    const source = readFile("src", "components", "ai-elements", "use-chat-cv-upload.tsx");

    expect(source).toContain("const clearResetTimer = useCallback(() => {");
    expect(source).toContain(
      "const activeUploadControllerRef = useRef<AbortController | null>(null);",
    );
    expect(source).toContain(
      "const isUploadCurrent = useCallback((uploadId: number, controller: AbortController) => {",
    );
    expect(source).toContain("activeUploadControllerRef.current?.abort();");
    expect(source).toContain("const controller = new AbortController();");
    expect(source).toContain("signal: controller.signal");
    expect(source).toContain("onSendMessageRef.current({ text: summary.text });");
  });
});
