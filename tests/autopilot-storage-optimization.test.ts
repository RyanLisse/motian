import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutopilotRunSummary } from "@/src/autopilot/types/run";

const uploadFileMock = vi.fn();
const trackAutopilotStorageUsageMock = vi.fn();

vi.mock("@/src/lib/file-storage", () => ({
  uploadFile: uploadFileMock,
}));

vi.mock("@/src/autopilot/telemetry", () => ({
  trackAutopilotStorageUsage: trackAutopilotStorageUsageMock,
}));

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "motian-autopilot-storage-"));
  tempDirs.push(dir);
  return dir;
}

function createSummary(runId: string, artifactPaths: Record<string, string>): AutopilotRunSummary {
  return {
    runId,
    status: "failed",
    startedAt: "2026-03-12T04:00:00.000Z",
    completedAt: "2026-03-12T04:05:00.000Z",
    commitSha: "abc123def456",
    journeyResults: [
      {
        journeyId: "chat-rich-evidence",
        surface: "/chat",
        success: false,
        durationMs: 1800,
      },
    ],
    findings: [],
    evidenceManifests: [
      {
        runId,
        journeyId: "chat-rich-evidence",
        surface: "/chat",
        capturedAt: "2026-03-12T04:04:00.000Z",
        gitSha: "abc123def456",
        success: false,
        artifacts: [
          {
            id: "chat-video",
            kind: "video",
            path: artifactPaths.video,
            capturedAt: "2026-03-12T04:04:01.000Z",
          },
          {
            id: "chat-trace",
            kind: "trace",
            path: artifactPaths.trace,
            capturedAt: "2026-03-12T04:04:02.000Z",
          },
          {
            id: "chat-har",
            kind: "har",
            path: artifactPaths.har,
            capturedAt: "2026-03-12T04:04:03.000Z",
          },
          {
            id: "chat-screenshot",
            kind: "screenshot",
            path: artifactPaths.screenshot,
            capturedAt: "2026-03-12T04:04:04.000Z",
          },
        ],
      },
    ],
    stats: {
      totalJourneys: 1,
      passedJourneys: 0,
      failedJourneys: 1,
      totalFindings: 0,
      findingsBySeverity: {},
      findingsByCategory: {},
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.AUTOPILOT_RICH_EVIDENCE;

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("autopilot storage optimization", () => {
  it("compresses large HAR and trace artifacts and persists 30-day cache metadata", async () => {
    const { uploadReportArtifacts } = await import("@/src/autopilot/reporting/upload");
    const evidenceDir = createTempDir();

    const videoPath = join(evidenceDir, "chat-video.webm");
    const tracePath = join(evidenceDir, "chat-trace.zip");
    const harPath = join(evidenceDir, "chat-network.har");
    const screenshotPath = join(evidenceDir, "chat-screenshot.png");

    writeFileSync(videoPath, Buffer.alloc(32_000, 1));
    writeFileSync(tracePath, Buffer.from("trace-data-".repeat(120_000), "utf8"));
    writeFileSync(
      harPath,
      Buffer.from(JSON.stringify({ log: { entries: [{ body: "x".repeat(1_400_000) }] } }), "utf8"),
    );
    writeFileSync(screenshotPath, Buffer.alloc(8_000, 2));

    uploadFileMock.mockImplementation(async (_buffer: Buffer, filename: string) => ({
      url: `https://blob.vercel-storage.com/${filename}`,
      downloadUrl: `https://blob.vercel-storage.com/${filename}?download=1`,
      pathname: filename,
      contentDisposition: "inline",
      contentType: "application/octet-stream",
      etag: "etag",
    }));

    const summary = createSummary("run-123", {
      video: videoPath,
      trace: tracePath,
      har: harPath,
      screenshot: screenshotPath,
    });

    await uploadReportArtifacts(summary, "# Rapport", evidenceDir);

    const traceUpload = uploadFileMock.mock.calls.find((call) =>
      String(call[1]).includes("chat-trace.zip.gz"),
    );
    const harUpload = uploadFileMock.mock.calls.find((call) =>
      String(call[1]).includes("chat-network.har.gz"),
    );
    const summaryUpload = uploadFileMock.mock.calls.find((call) =>
      String(call[1]).endsWith("summary.json"),
    );

    expect(traceUpload).toBeDefined();
    expect(harUpload).toBeDefined();
    expect(traceUpload?.[3]).toMatchObject({ cacheControlMaxAge: 2_592_000 });
    expect(harUpload?.[3]).toMatchObject({ cacheControlMaxAge: 2_592_000 });
    expect(summaryUpload?.[3]).toMatchObject({ cacheControlMaxAge: 2_592_000 });
    expect((traceUpload?.[0] as Buffer).byteLength).toBeLessThan(
      readFileSync(tracePath).byteLength,
    );
    expect((harUpload?.[0] as Buffer).byteLength).toBeLessThan(readFileSync(harPath).byteLength);

    const uploadedSummary = JSON.parse(
      (summaryUpload?.[0] as Buffer).toString("utf8"),
    ) as AutopilotRunSummary;
    const uploadedTrace = uploadedSummary.evidenceManifests[0]?.artifacts.find(
      (artifact) => artifact.id === "chat-trace",
    );
    const uploadedHar = uploadedSummary.evidenceManifests[0]?.artifacts.find(
      (artifact) => artifact.id === "chat-har",
    );

    expect(uploadedTrace?.url).toContain("chat-trace.zip.gz");
    expect(uploadedTrace?.metadata).toMatchObject({ contentEncoding: "gzip" });
    expect(uploadedHar?.url).toContain("chat-network.har.gz");
    expect(uploadedHar?.metadata).toMatchObject({ contentEncoding: "gzip" });
    expect(trackAutopilotStorageUsageMock).toHaveBeenCalledWith(
      "run-123",
      expect.objectContaining({
        originalBytes: expect.any(Number),
        uploadedBytes: expect.any(Number),
        traceBytes: expect.any(Number),
        harBytes: expect.any(Number),
      }),
    );
  });

  it("skips rich evidence uploads for successful journeys when configured for failures-only", async () => {
    const { uploadReportArtifacts } = await import("@/src/autopilot/reporting/upload");
    const evidenceDir = createTempDir();
    process.env.AUTOPILOT_RICH_EVIDENCE = "failures";

    const videoPath = join(evidenceDir, "chat-video.webm");
    const tracePath = join(evidenceDir, "chat-trace.zip");
    const harPath = join(evidenceDir, "chat-network.har");
    const screenshotPath = join(evidenceDir, "chat-screenshot.png");

    writeFileSync(videoPath, Buffer.alloc(16_000, 1));
    writeFileSync(tracePath, Buffer.from("trace-data-".repeat(10_000), "utf8"));
    writeFileSync(
      harPath,
      Buffer.from(JSON.stringify({ log: { entries: [{ body: "ok" }] } }), "utf8"),
    );
    writeFileSync(screenshotPath, Buffer.alloc(8_000, 2));

    uploadFileMock.mockImplementation(async (_buffer: Buffer, filename: string) => ({
      url: `https://blob.vercel-storage.com/${filename}`,
      downloadUrl: `https://blob.vercel-storage.com/${filename}?download=1`,
      pathname: filename,
      contentDisposition: "inline",
      contentType: "application/octet-stream",
      etag: "etag",
    }));

    const summary = createSummary("run-456", {
      video: videoPath,
      trace: tracePath,
      har: harPath,
      screenshot: screenshotPath,
    });
    summary.status = "completed";
    summary.journeyResults[0] = { ...summary.journeyResults[0], success: true };
    summary.evidenceManifests[0] = { ...summary.evidenceManifests[0], success: true };

    await uploadReportArtifacts(summary, "# Rapport", evidenceDir);

    const uploadedPaths = uploadFileMock.mock.calls.map((call) => String(call[1]));
    expect(uploadedPaths.some((path) => path.includes("chat-video.webm"))).toBe(false);
    expect(uploadedPaths.some((path) => path.includes("chat-trace.zip"))).toBe(false);
    expect(uploadedPaths.some((path) => path.includes("chat-network.har"))).toBe(false);
    expect(uploadedPaths.some((path) => path.includes("chat-screenshot.png"))).toBe(true);
  });
});
