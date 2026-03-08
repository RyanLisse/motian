import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getStableChatOrigin } from "@/src/lib/chat-origin";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat render origin boundaries", () => {
  it("derives a stable origin from server-side config", () => {
    expect(getStableChatOrigin({ PUBLIC_API_BASE_URL: "https://motian.local/chat" })).toBe(
      "https://motian.local",
    );
    expect(getStableChatOrigin({ NEXT_URL: "http://localhost:3001/" })).toBe(
      "http://localhost:3001",
    );
    expect(getStableChatOrigin({ PUBLIC_API_BASE_URL: "not-a-url" })).toBeNull();
  });

  it("threads the stable origin from server boundaries without render-time window access", () => {
    const layoutSource = readFile("app", "layout.tsx");
    const pageSource = readFile("app", "chat", "page.tsx");
    const pageContentSource = readFile("components", "chat", "chat-page-content.tsx");
    const widgetSource = readFile("components", "chat", "chat-widget.tsx");
    const messagesSource = readFile("components", "chat", "chat-messages.tsx");

    expect(layoutSource).toContain("const currentOrigin = getStableChatOrigin()");
    expect(layoutSource).toContain("<ChatWidget currentOrigin={currentOrigin} />");
    expect(pageSource).toContain("const currentOrigin = getStableChatOrigin()");
    expect(pageSource).toContain("<ChatPageContent currentOrigin={currentOrigin} />");
    expect(pageContentSource).toContain("currentOrigin={currentOrigin}");
    expect(widgetSource).toContain("currentOrigin={currentOrigin}");
    expect(messagesSource).toContain("currentOrigin?: string | null;");
    expect(messagesSource).not.toContain("window.location.origin");
  });
});
