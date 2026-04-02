import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { captureJourneyEvidence } from "@/src/autopilot/evidence";
import type { JourneySpec } from "@/src/autopilot/types/journey";

function renderHtml(body: string): string {
  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Autopilot Evidence Test</title>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === "/api/ping") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/chat") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      renderHtml(`
        <main>
          <h1>Chat testpagina</h1>
          <button id="trigger" type="button">Klik hier</button>
          <div id="status">Wachten</div>
          <script>
            document.getElementById("trigger").addEventListener("click", async () => {
              await fetch("/api/ping");
              document.getElementById("status").textContent = "Klik gelukt";
              console.log("interaction-complete");
            });
          </script>
        </main>
      `),
    );
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
}

async function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handleRequest);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Kon testserver niet starten");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const tempDirs: string[] = [];

function createEvidenceDir(): string {
  const evidenceDir = mkdtempSync(join(tmpdir(), "motian-autopilot-rich-evidence-"));
  tempDirs.push(evidenceDir);
  return evidenceDir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("autopilot rich evidence capture", () => {
  it("records a video artifact for an interactive journey", async () => {
    const server = await startTestServer();
    const evidenceDir = createEvidenceDir();
    const journey: JourneySpec = {
      id: "chat-rich-video",
      surface: "/chat",
      kind: "interactive",
      description: "Capture video for an interaction flow",
      timeoutMs: 10_000,
      interactions: [
        {
          action: "click",
          selector: "#trigger",
        },
        {
          action: "wait-for-text",
          waitForText: "Klik gelukt",
        },
      ],
      expectedSelectors: ["#status"],
    };

    try {
      const result = await captureJourneyEvidence([journey], {
        baseUrl: server.baseUrl,
        evidenceDir,
      });

      const artifacts = result.journeyOutputs[0]?.manifest.artifacts ?? [];
      const videoArtifact = artifacts.find((artifact) => artifact.kind === "video");

      expect(videoArtifact).toBeDefined();
      expect(videoArtifact?.path).toMatch(/\.webm$/);
      expect(videoArtifact?.path ? statSync(videoArtifact.path).size : 0).toBeGreaterThan(0);
      expect(
        videoArtifact?.path ? statSync(videoArtifact.path).size : Number.POSITIVE_INFINITY,
      ).toBeLessThan(20 * 1024 * 1024);
    } finally {
      await server.close();
    }
  }, 45_000);

  it("captures a trace artifact for a successful journey", async () => {
    const server = await startTestServer();
    const evidenceDir = createEvidenceDir();
    const journey: JourneySpec = {
      id: "chat-rich-trace",
      surface: "/chat",
      kind: "page-load",
      description: "Capture trace for a page load flow",
      timeoutMs: 10_000,
      expectedSelectors: ["#trigger"],
    };

    try {
      const result = await captureJourneyEvidence([journey], {
        baseUrl: server.baseUrl,
        evidenceDir,
      });

      const artifacts = result.journeyOutputs[0]?.manifest.artifacts ?? [];
      const traceArtifact = artifacts.find((artifact) => artifact.kind === "trace");

      expect(traceArtifact).toBeDefined();
      expect(traceArtifact?.path).toMatch(/\.zip$/);
      expect(traceArtifact?.path ? statSync(traceArtifact.path).size : 0).toBeGreaterThan(0);
      expect(
        traceArtifact?.path ? statSync(traceArtifact.path).size : Number.POSITIVE_INFINITY,
      ).toBeLessThan(50 * 1024 * 1024);
    } finally {
      await server.close();
    }
  }, 45_000);

  it("marks trace artifacts captured from failed journeys", async () => {
    const server = await startTestServer();
    const evidenceDir = createEvidenceDir();
    const journey: JourneySpec = {
      id: "chat-rich-trace-failure",
      surface: "/chat",
      kind: "page-load",
      description: "Capture trace even when validation fails",
      timeoutMs: 10_000,
      expectedSelectors: ["#bestaat-niet"],
    };

    try {
      const result = await captureJourneyEvidence([journey], {
        baseUrl: server.baseUrl,
        evidenceDir,
      });

      expect(result.journeyOutputs[0]?.manifest.success).toBe(false);

      const artifacts = result.journeyOutputs[0]?.manifest.artifacts ?? [];
      const traceArtifact = artifacts.find((artifact) => artifact.kind === "trace");

      expect(traceArtifact).toBeDefined();
      expect(traceArtifact?.metadata).toMatchObject({ capturedOnError: true });
    } finally {
      await server.close();
    }
  }, 90_000);

  it("captures a HAR artifact with recorded network traffic", async () => {
    const server = await startTestServer();
    const evidenceDir = createEvidenceDir();
    const journey: JourneySpec = {
      id: "chat-rich-har",
      surface: "/chat",
      kind: "interactive",
      description: "Capture network evidence for an interaction flow",
      timeoutMs: 10_000,
      interactions: [
        {
          action: "click",
          selector: "#trigger",
        },
        {
          action: "wait-for-text",
          waitForText: "Klik gelukt",
        },
      ],
      expectedSelectors: ["#status"],
    };

    try {
      const result = await captureJourneyEvidence([journey], {
        baseUrl: server.baseUrl,
        evidenceDir,
      });

      const artifacts = result.journeyOutputs[0]?.manifest.artifacts ?? [];
      const harArtifact = artifacts.find((artifact) => artifact.kind === "har");

      expect(harArtifact).toBeDefined();
      expect(harArtifact?.path).toMatch(/\.har$/);
      expect(
        harArtifact?.path ? statSync(harArtifact.path).size : Number.POSITIVE_INFINITY,
      ).toBeLessThan(30 * 1024 * 1024);

      const har =
        harArtifact?.path === undefined
          ? null
          : (JSON.parse(readFileSync(harArtifact.path, "utf8")) as {
              log?: {
                entries?: Array<{
                  request?: { headers?: unknown[] };
                  response?: { headers?: unknown[] };
                }>;
              };
            });

      expect(har?.log?.entries?.length ?? 0).toBeGreaterThan(0);
      expect(har?.log?.entries?.[0]?.request?.headers?.length ?? 0).toBeGreaterThan(0);
      expect(har?.log?.entries?.[0]?.response?.headers?.length ?? 0).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  }, 90_000);
});
