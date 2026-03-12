import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
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
 * Launches browser once, runs journeys sequentially, closes browser.
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

  const journeyOutputs: JourneyRunOutput[] = [];

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors: true,
    });

    for (const spec of journeys) {
      try {
        const output = await runJourney(
          spec,
          { baseUrl: config.baseUrl, evidenceDir: config.evidenceDir, viewport },
          context,
          runId,
          gitSha,
        );
        journeyOutputs.push(output);

        // Write per-journey manifest
        const manifestPath = join(runDir, `${spec.id}-manifest.json`);
        await writeFile(manifestPath, JSON.stringify(output.manifest, null, 2), "utf-8");
      } catch (err) {
        // Graceful failure: one journey failing should not stop others
        const errorMessage = err instanceof Error ? err.message : String(err);
        const failedOutput: JourneyRunOutput = {
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
        journeyOutputs.push(failedOutput);
      }
    }

    await context.close();
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
