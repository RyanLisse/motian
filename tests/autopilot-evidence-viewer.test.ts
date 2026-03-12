import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceViewer } from "@/components/autopilot/evidence-viewer";

describe("EvidenceViewer", () => {
  it("renders the available evidence tabs and journey context", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceViewer, {
        evidence: [
          {
            journeyId: "chat-rich-evidence",
            surface: "/chat",
            success: false,
            failureReason: "Expected selector not found: #result",
            artifacts: [
              {
                id: "chat-rich-evidence-video",
                kind: "video",
                path: "/tmp/chat-rich-evidence.webm",
                capturedAt: "2026-03-12T04:04:05.000Z",
                proxyPath:
                  "/api/autopilot/runs/run-123/evidence/chat-rich-evidence/chat-rich-evidence-video",
              },
              {
                id: "chat-rich-evidence-screenshot",
                kind: "screenshot",
                path: "/tmp/chat-rich-evidence.png",
                capturedAt: "2026-03-12T04:04:06.000Z",
                proxyPath:
                  "/api/autopilot/runs/run-123/evidence/chat-rich-evidence/chat-rich-evidence-screenshot",
              },
              {
                id: "chat-rich-evidence-trace",
                kind: "trace",
                path: "/tmp/chat-rich-evidence-trace.zip",
                capturedAt: "2026-03-12T04:04:07.000Z",
                proxyPath:
                  "/api/autopilot/runs/run-123/evidence/chat-rich-evidence/chat-rich-evidence-trace",
              },
              {
                id: "chat-rich-evidence-har",
                kind: "har",
                path: "/tmp/chat-rich-evidence.har",
                capturedAt: "2026-03-12T04:04:08.000Z",
                proxyPath:
                  "/api/autopilot/runs/run-123/evidence/chat-rich-evidence/chat-rich-evidence-har",
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain("chat-rich-evidence");
    expect(html).toContain("/chat");
    expect(html).toContain("Video");
    expect(html).toContain("Screenshots");
    expect(html).toContain("Trace");
    expect(html).toContain("Netwerk");
    expect(html).toContain("Mislukt");
  });

  it("shows Dutch empty states when no evidence is available", () => {
    const html = renderToStaticMarkup(createElement(EvidenceViewer, { evidence: [] }));

    expect(html).toContain("Geen bewijs beschikbaar");
    expect(html).toContain("Deze run heeft nog geen rijke bewijslast");
  });
});
