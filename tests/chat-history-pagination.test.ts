import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat history pagination architecture", () => {
  it("uses the paginated chat thread hook in the full-page chat", () => {
    const source = readFile("components", "chat", "chat-page-content.tsx");

    expect(source).toContain('const SESSION_KEY = "motian-chat-session"');
    expect(source).toContain("getOrCreateSessionId()");
    expect(source).toContain("useChatThread({");
    expect(source).toContain("hasOlderMessages={hasMoreHistory}");
    expect(source).toContain("onLoadOlder={handleLoadOlder}");
  });

  it("reuses the paginated chat thread hook in the global chat widget", () => {
    const source = readFile("components", "chat", "chat-widget.tsx");

    expect(source).toContain("useChatThread({");
    expect(source).toContain('const SESSION_KEY = "motian-fab-session"');
    expect(source).toContain("hasOlderMessages={hasMoreHistory}");
    expect(source).toContain("onLoadOlder={handleLoadOlder}");
  });

  it("supports cursor-based pagination on the chat session routes", () => {
    const listRoute = readFile("app", "api", "chat-sessies", "route.ts");
    const detailRoute = readFile("app", "api", "chat-sessies", "[id]", "route.ts");
    const service = readFile("src", "services", "chat-sessions.ts");

    expect(listRoute).toContain("cursor: z.string().min(1).optional()");
    expect(listRoute).toContain(
      "listSessions({ limit: params.limit, cursor: params.cursor ?? null })",
    );
    expect(detailRoute).toContain("cursor: z.string().min(1).optional()");
    expect(detailRoute).toContain("cursor: result.data.cursor ?? null,");
    expect(service).toContain("nextCursor");
  });

  it("stores chat history as append-only message rows", () => {
    const service = readFile("src", "services", "chat-sessions.ts");
    const schema = readFile("packages", "db", "src", "schema.ts");

    expect(service).toContain("chatSessionMessages");
    expect(service).toContain("await tx.insert(chatSessionMessages)");
    expect(service).toContain("encodeMessageCursor");
    expect(service).toContain("lt(chatSessionMessages.orderIndex, cursor)");

    // PostgreSQL uses pgTable
    expect(schema).toContain("export const chatSessionMessages = pgTable(");
    expect(schema).toContain('"chat_session_messages"');
  });
});
