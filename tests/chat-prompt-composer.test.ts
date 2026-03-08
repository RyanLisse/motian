import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeChatPromptMessage } from "@/src/components/ai-elements/chat-prompt-composer";
import { buildCvSummaryMessage, validateCvUploadFile } from "@/src/lib/cv-upload";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
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

  it("accepts pdf/docx via extension fallback and keeps .doc explicitly unsupported", () => {
    expect(validateCvUploadFile({ name: "resume.docx", size: 1024, type: "" })).toEqual({
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

  it("wires the widget to the shared CV upload flow", () => {
    const source = readFile("components", "chat", "chat-widget.tsx");

    expect(source).toContain("PromptInputProvider");
    expect(source).toContain("useChatCvUpload");
    expect(source).toContain("ChatCvDropOverlay");
    expect(source).toContain("ChatCvUploadStatusBanner");
    expect(source).toContain("accept={CV_UPLOAD_ACCEPT}");
    expect(source).toContain("globalDrop");
    expect(source).toContain("onClick={cvUpload.openFileDialog}");
    expect(source).not.toContain('type="file"');
  });
});
