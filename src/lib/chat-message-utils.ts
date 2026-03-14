import type { UIMessage } from "ai";

/**
 * Extract plain text from a chat UIMessage (parts or legacy content).
 * Shared by app/api/chat/route.ts and src/services/chat-sessions.ts.
 */
export function getMessageText(message: UIMessage): string {
  const textParts = Array.isArray(message.parts)
    ? message.parts
        .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => {
          return part.type === "text" && typeof part.text === "string";
        })
        .map((part) => part.text.trim())
        .filter(Boolean)
    : [];

  if (textParts.length > 0) {
    return textParts.join("\n").trim();
  }

  const legacyContent = (message as UIMessage & { content?: unknown }).content;
  return typeof legacyContent === "string" ? legacyContent.trim() : "";
}
