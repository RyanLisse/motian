import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ChatPromptComposer,
  normalizeChatPromptMessage,
} from "@/src/components/ai-elements/chat-prompt-composer";
import { buildCvSummaryMessage, validateCvUploadFile } from "@/src/lib/cv-upload";

vi.mock("@/src/components/ai-elements/prompt-input", () => ({
  PromptInput: ({ children }: { children: unknown }) => createElement("form", null, children),
  PromptInputButton: ({ children, ...props }: Record<string, unknown>) =>
    createElement("button", { type: "button", ...props }, children),
  PromptInputFooter: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
  PromptInputSelect: ({ children }: { children: unknown }) => createElement("div", null, children),
  PromptInputSelectContent: ({ children }: { children: unknown }) =>
    createElement("div", null, children),
  PromptInputSelectItem: ({ children, value }: { children: unknown; value: string }) =>
    createElement("div", { "data-value": value }, children),
  PromptInputSelectTrigger: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("button", { className, type: "button" }, children),
  PromptInputSelectValue: () => createElement("span", null, "select"),
  PromptInputSubmit: ({ children, ...props }: Record<string, unknown>) =>
    createElement("button", { type: "button", ...props }, children),
  PromptInputTextarea: ({ placeholder }: { placeholder?: string }) =>
    createElement("textarea", { placeholder }),
  PromptInputTools: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
}));

vi.mock("@/src/components/ai-elements/use-chat-cv-upload", () => ({
  ChatCvUploadStatusBanner: () => null,
}));

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

function createMockCvUpload() {
  return {
    clearFeedback: vi.fn(),
    handlePromptInputError: vi.fn(),
    isDraggingFile: false,
    openFileDialog: vi.fn(),
    uploadFileName: null,
    uploadMessage: null,
    uploadState: "idle" as const,
  };
}

describe("chat prompt composer preset", () => {
  it("keeps the chat submit contract compatible with PromptInputMessage", () => {
    expect(normalizeChatPromptMessage({ files: [], text: "  hallo wereld  " })).toEqual({
      text: "hallo wereld",
    });
    expect(normalizeChatPromptMessage({ files: [], text: "   " })).toBeNull();
  });

  it("builds the CV upload follow-up message with candidate context", () => {
    const summary = buildCvSummaryMessage({
      candidateId: "cand_123",
      duplicates: { exact: { id: "existing_1" } },
      parsed: {
        name: "Jane Doe",
        role: "Recruiter",
        skills: {
          hard: [{ name: "Boolean search" }, { name: "ATS" }],
          soft: [{ name: "Stakeholdermanagement" }],
        },
      },
    });

    expect(summary.action).toBe("bijgewerkt");
    expect(summary.text).toContain("Jane Doe");
    expect(summary.text).toContain("Kandidaat ID: cand_123");
    expect(summary.text).toContain("Boolean search, ATS, Stakeholdermanagement");
  });

  it("accepts docx by extension before legacy Word mime fallback and keeps .doc unsupported", () => {
    expect(
      validateCvUploadFile({ name: "resume.docx", size: 1024, type: "application/msword" }),
    ).toEqual({
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const legacyDoc = validateCvUploadFile({
      name: "resume.doc",
      size: 1024,
      type: "application/msword",
    });

    expect(legacyDoc).toMatchObject({
      ok: false,
      code: "unsupported_doc",
    });

    if (!legacyDoc.ok) {
      expect(legacyDoc.message).toContain("(.doc)");
      expect(legacyDoc.message).toContain("PDF");
      expect(legacyDoc.message).toContain(".docx");
    }
  });

  it("packages the local prompt-input primitives into a chat-ready wrapper", () => {
    const source = readFile("src", "components", "ai-elements", "chat-prompt-composer.tsx");

    expect(source).toContain("export function ChatPromptComposer");
    expect(source).toContain("PromptInputSubmit");
    expect(source).toContain("globalDrop");
    expect(source).toContain("onError={cvUpload.handlePromptInputError}");
    expect(source).toContain("onClick={cvUpload.openFileDialog}");
    expect(source).toContain("ChatCvUploadStatusBanner");
    expect(source).toContain("CV uploaden");
    expect(source).not.toContain("PromptInputActionAddAttachments");
    expect(source).not.toContain("usePromptInputAttachments");
    expect(source).not.toContain("ChatPromptAttachmentList");
  });

  it("lets the full-page chat swap to the wrapper without changing submit flow", () => {
    const source = readFile("components", "chat", "chat-page-content.tsx");

    expect(source).toContain('from "@/src/components/ai-elements/chat-prompt-composer"');
    expect(source).toContain("PromptInputProvider");
    expect(source).toContain("useChatCvUpload");
    expect(source).toContain("cvUpload={cvUpload}");
    expect(source).toContain("<ChatPromptComposer");
    expect(source).toContain("modelOptions={CHAT_MODELS}");
    expect(source).toContain("speedOptions={MODE_OPTIONS}");
    expect(source).toContain("onSendMessage={sendMessage}");
    expect(source).not.toContain("motian-chat-prompt-input");
  });

  it("renders plain speed options through the shared composer without relying on source-string icon checks", () => {
    const html = renderToStaticMarkup(
      createElement(ChatPromptComposer, {
        composerContextHint: "Deze chat gebruikt automatisch de huidige opdracht als context.",
        composerHint: "Enter om te verzenden · Shift+Enter voor een nieuwe regel",
        cvUpload: createMockCvUpload(),
        modelId: "gemini-3-flash",
        modelOptions: [{ id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "Google" }],
        onModelIdChange: vi.fn(),
        onSendMessage: vi.fn(),
        onSpeedModeChange: vi.fn(),
        onStop: vi.fn(),
        onToggleVoice: vi.fn(),
        placeholder: "Vraag om een samenvatting, matchanalyse of outreach voor deze opdracht",
        speedMode: "gemiddeld",
        speedOptions: [
          { id: "snel", label: "Snel" },
          { id: "gemiddeld", label: "Gemiddeld" },
          { id: "grondig", label: "Grondig" },
        ],
        status: "ready",
      }),
    );

    expect(html).toContain("Deze chat gebruikt automatisch de huidige opdracht als context.");
    expect(html).toContain("Snel");
    expect(html).toContain("Gemiddeld");
    expect(html).toContain("Grondig");
    expect(html).toContain("CV uploaden");
    expect(html).not.toContain("[object Object]");
  });

  it("wires the widget to the shared CV upload flow", () => {
    const source = readFile("components", "chat", "chat-widget.tsx");

    expect(source).toContain('type="file"');
    expect(source).toContain('accept=".pdf,.docx');
    expect(source).toContain("handleFileChange");
    expect(source).toContain("uploadState");
    expect(source).toContain("uploadResult");
    expect(source).toContain('aria-label="CV of document uploaden"');
    expect(source).toContain("{open && (");
    expect(source).toContain("fileInputRef.current?.click()");
    expect(source).toContain("handleFileUpload");
  });
});
