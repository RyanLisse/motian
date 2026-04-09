import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getRequestOrigin, getStableChatOrigin } from "@/src/lib/chat-origin";

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

  it("prefers a request-derived origin when env config is absent", () => {
    expect(
      getRequestOrigin(
        new Headers({
          host: "localhost:3002",
          "x-forwarded-proto": "http",
          "x-forwarded-host": "localhost:3002",
        }),
      ),
    ).toBe("http://localhost:3002");

    expect(
      getStableChatOrigin("https://preview.motian.app/chat", {
        PUBLIC_API_BASE_URL: "not-a-url",
      }),
    ).toBe("https://preview.motian.app");
  });

  it("derives chat origin client-side to avoid forcing dynamic rendering via headers()", () => {
    const layoutSource = readFile("app", "layout.tsx");
    const overlaysSource = readFile("components", "route-shell-overlays.tsx");
    const pageContentSource = readFile("components", "chat", "chat-page-content.tsx");
    const widgetSource = readFile("components", "chat", "chat-widget.tsx");
    const messagesSource = readFile("components", "chat", "chat-messages.tsx");

    // Root layout must NOT call headers() — it forces every page into dynamic rendering
    expect(layoutSource).not.toContain('import { headers } from "next/headers"');
    expect(layoutSource).toContain("<RouteShellOverlays />");

    // Origin is now derived client-side
    expect(overlaysSource).toContain("window.location.origin");
    expect(pageContentSource).toContain("window.location.origin");

    // Chat components still thread currentOrigin as a prop internally
    expect(widgetSource).toContain("currentOrigin={currentOrigin}");
    expect(messagesSource).toContain("currentOrigin?: string | null;");
  });
});
