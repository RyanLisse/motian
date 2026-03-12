import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrowserContext, ConsoleMessage } from "playwright";
import type { AutopilotEvidence, EvidenceManifest } from "../types/evidence";
import type { JourneySpec } from "../types/journey";
import type { JourneyResult } from "../types/run";

export interface JourneyRunnerConfig {
  baseUrl: string;
  evidenceDir: string;
  viewport: { width: number; height: number };
}

export interface JourneyRunOutput {
  result: JourneyResult;
  manifest: EvidenceManifest;
}

/**
 * Execute a single JourneySpec against a running app and capture evidence.
 *
 * Expects a pre-launched browser context. The caller is responsible for
 * creating / closing the browser — this function only manages per-journey pages.
 */
export async function runJourney(
  spec: JourneySpec,
  config: JourneyRunnerConfig,
  context: BrowserContext,
  runId: string,
  gitSha: string,
): Promise<JourneyRunOutput> {
  const ts = new Date().toISOString();
  const tsFile = ts.replace(/[:.]/g, "-");
  const journeyDir = join(config.evidenceDir, runId);
  await mkdir(journeyDir, { recursive: true });

  const consoleLogs: string[] = [];
  const artifacts: AutopilotEvidence[] = [];
  let success = true;
  let errorMessage: string | undefined;

  const page = await context.newPage();
  page.setDefaultTimeout(spec.timeoutMs);

  const onConsole = (msg: ConsoleMessage) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  };
  page.on("console", onConsole);

  const start = Date.now();

  try {
    const url = `${config.baseUrl}${spec.surface}`;

    switch (spec.kind) {
      case "page-load":
      case "interactive": {
        // For MVP, interactive is treated the same as page-load
        await page.goto(url, { waitUntil: "networkidle" });
        break;
      }
      case "redirect": {
        // Navigate without waiting for networkidle on the initial URL
        await page.goto(url, { waitUntil: "commit" });
        // Wait for navigation to settle on the redirect target
        await page.waitForURL(
          (u) =>
            spec.expectedRedirectTarget ? u.pathname.startsWith(spec.expectedRedirectTarget) : true,
          { timeout: spec.timeoutMs },
        );
        // Allow the destination page to finish loading
        await page.waitForLoadState("networkidle");
        break;
      }
    }

    // Capture screenshot
    const screenshotFile = `${spec.id}-${tsFile}.png`;
    const screenshotPath = join(journeyDir, screenshotFile);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    artifacts.push({
      id: `${spec.id}-screenshot`,
      kind: "screenshot",
      path: screenshotPath,
      capturedAt: new Date().toISOString(),
    });
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    page.off("console", onConsole);
    await page.close();
  }

  const durationMs = Date.now() - start;

  // Write console logs
  const logFile = `${spec.id}-${tsFile}.console.log`;
  const logPath = join(journeyDir, logFile);
  await writeFile(logPath, consoleLogs.join("\n"), "utf-8");
  artifacts.push({
    id: `${spec.id}-console-log`,
    kind: "console-log",
    path: logPath,
    capturedAt: new Date().toISOString(),
  });

  const manifest: EvidenceManifest = {
    runId,
    journeyId: spec.id,
    surface: spec.surface,
    capturedAt: ts,
    gitSha,
    artifacts,
    success,
    failureReason: errorMessage,
  };

  const result: JourneyResult = {
    journeyId: spec.id,
    surface: spec.surface,
    success,
    durationMs,
    errorMessage,
    evidenceManifestId: `${runId}/${spec.id}`,
  };

  return { result, manifest };
}
