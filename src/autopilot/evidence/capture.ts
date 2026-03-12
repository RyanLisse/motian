import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import type { EvidenceManifest } from "../types/evidence";
import type { JourneySpec } from "../types/journey";
import { type JourneyRunOutput, runJourney } from "./journey-runner";

export interface CaptureConfig {
  baseUrl: string;
  evidenceDir: string;
  viewport?: { width: number; height: number };
}

export interface CaptureResult {
  runId: string;
  gitSha: string;
  startedAt: string;
  completedAt: string;
  journeyOutputs: JourneyRunOutput[];
}

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

/**
 * Run all specified journeys, capture evidence, return aggregated results.
 * Launches the browser once, then isolates each journey in its own context.
 */
export async function captureJourneyEvidence(
  journeys: JourneySpec[],
  config: CaptureConfig,
): Promise<CaptureResult> {
  const runId = crypto.randomUUID();
  const gitSha = execSync("git rev-parse HEAD").toString().trim();
  const viewport = config.viewport ?? DEFAULT_VIEWPORT;
  const startedAt = new Date().toISOString();

  const runDir = join(config.evidenceDir, runId);
  await mkdir(runDir, { recursive: true });
  const videoDir = join(runDir, "videos");
  await mkdir(videoDir, { recursive: true });

  const journeyOutputs: JourneyRunOutput[] = [];

  const browser = await chromium.launch();
  try {
    for (const spec of journeys) {
      const harPath = join(runDir, `${spec.id}.har`);
      const context = await browser.newContext({
        viewport,
        ignoreHTTPSErrors: true,
        recordVideo: {
          dir: videoDir,
          size: viewport,
        },
        recordHar: {
          path: harPath,
          mode: "minimal",
        },
      });

      let output: JourneyRunOutput | undefined;

      try {
        output = await runJourney(
          spec,
          { baseUrl: config.baseUrl, evidenceDir: config.evidenceDir, viewport },
          context,
          runId,
          gitSha,
        );
      } catch (err) {
        // Graceful failure: one journey failing should not stop others
        const errorMessage = err instanceof Error ? err.message : String(err);
        output = {
          result: {
            journeyId: spec.id,
            surface: spec.surface,
            success: false,
            durationMs: 0,
            errorMessage,
          },
          manifest: {
            runId,
            journeyId: spec.id,
            surface: spec.surface,
            capturedAt: new Date().toISOString(),
            gitSha,
            artifacts: [],
            success: false,
            failureReason: errorMessage,
          },
        };
      } finally {
        await context.close();
      }

      if (!output) {
        throw new Error(`Journey output ontbreekt voor ${spec.id}`);
      }

      await appendHarArtifact(output.manifest, spec.id, harPath);
      journeyOutputs.push(output);

      // Write per-journey manifest
      const manifestPath = join(runDir, `${spec.id}-manifest.json`);
      await writeFile(manifestPath, JSON.stringify(output.manifest, null, 2), "utf-8");
    }
  } finally {
    await browser.close();
  }

  const completedAt = new Date().toISOString();

  // Write top-level run manifest
  const runManifest = {
    runId,
    gitSha,
    startedAt,
    completedAt,
    journeyResults: journeyOutputs.map((o) => o.result),
    manifests: journeyOutputs.map((o) => o.manifest),
  };
  await writeFile(join(runDir, "run-manifest.json"), JSON.stringify(runManifest, null, 2), "utf-8");

  return { runId, gitSha, startedAt, completedAt, journeyOutputs };
}

async function appendHarArtifact(
  manifest: EvidenceManifest,
  journeyId: string,
  harPath: string,
): Promise<void> {
  try {
    const harStat = await stat(harPath);
    if (harStat.size === 0) {
      return;
    }

    manifest.artifacts.push({
      id: `${journeyId}-har`,
      kind: "har",
      path: harPath,
      capturedAt: new Date().toISOString(),
    });
  } catch {
    // HAR files are best-effort evidence and should not fail the full capture flow.
  }
}
