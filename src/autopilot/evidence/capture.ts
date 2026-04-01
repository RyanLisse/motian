import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ModalClient } from "modal";
import type { JourneySpec } from "../types/journey";
import type { JourneyRunOutput } from "./journey-runner";

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
const MODAL_PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.58.0-noble";
const MODAL_WORKDIR = "/root/autopilot";

function shouldUseLocalPlaywright(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  } catch {
    return false;
  }
}

async function captureJourneyEvidenceLocally(
  journeys: JourneySpec[],
  config: CaptureConfig,
  runId: string,
  gitSha: string,
  viewport: { width: number; height: number },
): Promise<JourneyRunOutput[]> {
  const [{ chromium }, { runJourney }] = await Promise.all([
    import("playwright"),
    import("./journey-runner"),
  ]);
  const browser = await chromium.launch();
  const journeyOutputs: JourneyRunOutput[] = [];

  try {
    for (const journey of journeys) {
      const tsFile = new Date().toISOString().replace(/[:.]/g, "-");
      const harPath = join(config.evidenceDir, runId, `${journey.id}-${tsFile}.har`);
      const context = await browser.newContext({
        viewport,
        ignoreHTTPSErrors: true,
        recordVideo: {
          dir: join(config.evidenceDir, runId),
          size: viewport,
        },
        recordHar: {
          path: harPath,
          mode: "full",
          content: "embed",
        },
      });

      try {
        const output = await runJourney(
          journey,
          {
            baseUrl: config.baseUrl,
            evidenceDir: config.evidenceDir,
            viewport,
          },
          context,
          runId,
          gitSha,
        );

        try {
          await access(harPath);
          output.manifest.artifacts.push({
            id: `${journey.id}-har`,
            kind: "har",
            path: harPath,
            capturedAt: new Date().toISOString(),
          });
        } catch {}
        journeyOutputs.push(output);
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  return journeyOutputs;
}

/** Marker tokens used to delimit the JSON manifest in sandbox stdout. */
const MANIFEST_START = "__MANIFEST_START__";
const MANIFEST_END = "__MANIFEST_END__";

/**
 * Self-contained Node.js script executed inside the Modal Sandbox.
 *
 * The Playwright Docker image ships with Node + Chromium. We pass the full
 * journey configuration as a base64-encoded JSON CLI argument and get back
 * a JSON manifest (with base64-encoded binary artifacts) on stdout.
 */
function buildSandboxRunnerScript(): string {
  // The script is plain JS (no TS, no monorepo imports) so it can run
  // directly inside the Playwright container without a build step.
  return `
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function toHarHeaders(headers) {
  return Object.entries(headers || {}).map(([name, value]) => ({
    name,
    value: String(value),
  }));
}

function buildFallbackHar(entries) {
  return {
    log: {
      version: '1.2',
      creator: { name: 'motian-modal-runner', version: '1.0.0' },
      entries,
    },
  };
}

const config = JSON.parse(Buffer.from(process.argv[1], 'base64').toString());
const { journeys, baseUrl, evidenceDir, runId, gitSha, viewport } = config;

(async () => {
  await fs.promises.mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const spec of journeys) {
    try {
      const ts = new Date().toISOString();
      const tsFile = ts.replace(/[:.]/g, '-');
      const consoleLogs = [];
      const networkEntries = [];
      const responseCaptureTasks = [];
      const artifacts = [];
      let success = true;
      let errorMessage;
      let traceStarted = false;
      const start = Date.now();
      const tracePath = path.join(evidenceDir, spec.id + '-' + tsFile + '.trace.zip');
      const harPath = path.join(evidenceDir, spec.id + '-' + tsFile + '.har');

      const context = await browser.newContext({
        viewport,
        ignoreHTTPSErrors: true,
        recordVideo: { dir: evidenceDir, size: viewport },
        recordHar: { path: harPath, mode: 'full', content: 'embed' },
      });
      const page = await context.newPage();
      const video = page.video();
      page.setDefaultTimeout(spec.timeoutMs);
      page.on('console', (msg) => consoleLogs.push('[' + msg.type() + '] ' + msg.text()));
      page.on('response', (response) => {
        responseCaptureTasks.push((async () => {
          try {
            const request = response.request();
            const requestHeaders = toHarHeaders(request.headers());
            const responseHeaders = toHarHeaders(await response.allHeaders());
            if (requestHeaders.length === 0) {
              requestHeaders.push({ name: 'x-playwright-method', value: request.method() });
            }
            if (responseHeaders.length === 0) {
              responseHeaders.push({ name: 'x-playwright-status', value: String(response.status()) });
            }
            networkEntries.push({
              startedDateTime: new Date().toISOString(),
              time: 0,
              request: {
                method: request.method(),
                url: request.url(),
                httpVersion: 'HTTP/1.1',
                headers: requestHeaders,
                queryString: [],
                cookies: [],
                headersSize: -1,
                bodySize: -1,
              },
              response: {
                status: response.status(),
                statusText: response.statusText(),
                httpVersion: 'HTTP/1.1',
                headers: responseHeaders,
                cookies: [],
                content: {
                  size: Number(response.headers()['content-length'] || 0),
                  mimeType: response.headers()['content-type'] || 'application/octet-stream',
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1,
              },
              cache: {},
              timings: { send: 0, wait: 0, receive: 0 },
            });
          } catch {}
        })());
      });

      try {
        try {
          await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
          traceStarted = true;
        } catch {
          traceStarted = false;
        }

        const url = baseUrl + spec.surface;

        if (spec.kind === 'page-load') {
          await page.goto(url, { waitUntil: 'networkidle', timeout: spec.timeoutMs });
        } else if (spec.kind === 'interactive') {
          await page.goto(url, { waitUntil: 'networkidle', timeout: spec.timeoutMs });
          if (spec.interactions) {
            for (const step of spec.interactions) {
              const t = step.timeoutMs ?? spec.timeoutMs;
              if (step.action === 'click' && step.selector) await page.click(step.selector, { timeout: t });
              else if (step.action === 'type' && step.selector && step.text) await page.fill(step.selector, step.text, { timeout: t });
              else if (step.action === 'wait-for-selector' && step.selector) await page.waitForSelector(step.selector, { timeout: t });
              else if (step.action === 'wait-for-text' && step.waitForText) await page.waitForSelector('text=' + step.waitForText, { timeout: t });
            }
          }
        } else if (spec.kind === 'redirect') {
          await page.goto(url, { waitUntil: 'commit', timeout: spec.timeoutMs });
          if (spec.expectedRedirectTarget) {
            await page.waitForURL((u) => u.pathname.startsWith(spec.expectedRedirectTarget), { timeout: spec.timeoutMs });
          }
          await page.waitForLoadState('networkidle');
        }

        // Validate expected selectors
        if (spec.expectedSelectors) {
          for (const sel of spec.expectedSelectors) {
            try { await page.waitForSelector(sel, { timeout: 5000 }); }
            catch { success = false; errorMessage = 'Expected selector not found: ' + sel; }
          }
        }

        // Screenshot -> base64
        const ssPath = path.join(evidenceDir, spec.id + '-screenshot.png');
        await page.screenshot({ path: ssPath, fullPage: true });
        const ssB64 = (await fs.promises.readFile(ssPath)).toString('base64');
        artifacts.push({
          id: spec.id + '-screenshot',
          kind: 'screenshot',
          fileName: spec.id + '-screenshot.png',
          dataBase64: ssB64,
          capturedAt: new Date().toISOString(),
        });
      } catch (err) {
        success = false;
        errorMessage = err.message || String(err);
      } finally {
        await Promise.allSettled(responseCaptureTasks);
        await page.close();

        if (traceStarted) {
          await context.tracing.stop({ path: tracePath });
          const traceB64 = (await fs.promises.readFile(tracePath)).toString('base64');
          artifacts.push({
            id: spec.id + '-trace',
            kind: 'trace',
            fileName: path.basename(tracePath),
            dataBase64: traceB64,
            capturedAt: new Date().toISOString(),
            metadata: success ? undefined : { capturedOnError: true },
          });
        }

        await context.close();

        const videoPath = await video?.path();
        if (videoPath) {
          const videoB64 = (await fs.promises.readFile(videoPath)).toString('base64');
          artifacts.push({
            id: spec.id + '-video',
            kind: 'video',
            fileName: path.basename(videoPath),
            dataBase64: videoB64,
            capturedAt: new Date().toISOString(),
          });
        }

        if (fs.existsSync(harPath)) {
          try {
            const harJson = JSON.parse(await fs.promises.readFile(harPath, 'utf8'));
            const entries = Array.isArray(harJson?.log?.entries) ? harJson.log.entries : [];
            const filteredEntries = entries.filter((entry) => {
              const requestHeaders = Array.isArray(entry?.request?.headers) ? entry.request.headers : [];
              const responseHeaders = Array.isArray(entry?.response?.headers)
                ? entry.response.headers
                : [];
              return requestHeaders.length > 0 && responseHeaders.length > 0;
            });

            if (filteredEntries.length > 0 && harJson?.log) {
              harJson.log.entries = filteredEntries;
              await fs.promises.writeFile(harPath, JSON.stringify(harJson));
            } else if (networkEntries.length > 0) {
              await fs.promises.writeFile(harPath, JSON.stringify(buildFallbackHar(networkEntries)));
            }
          } catch {}

          const harB64 = (await fs.promises.readFile(harPath)).toString('base64');
          artifacts.push({
            id: spec.id + '-har',
            kind: 'har',
            fileName: path.basename(harPath),
            dataBase64: harB64,
            capturedAt: new Date().toISOString(),
          });
        } else if (networkEntries.length > 0) {
          await fs.promises.writeFile(harPath, JSON.stringify(buildFallbackHar(networkEntries)));
          const harB64 = (await fs.promises.readFile(harPath)).toString('base64');
          artifacts.push({
            id: spec.id + '-har',
            kind: 'har',
            fileName: path.basename(harPath),
            dataBase64: harB64,
            capturedAt: new Date().toISOString(),
          });
        }
      }

      // Console logs -> base64
      const logContent = consoleLogs.join('\\n');
      const logB64 = Buffer.from(logContent).toString('base64');
      artifacts.push({
        id: spec.id + '-console-log',
        kind: 'console-log',
        fileName: spec.id + '-console.log',
        dataBase64: logB64,
        capturedAt: new Date().toISOString(),
      });

      results.push({
        result: {
          journeyId: spec.id,
          surface: spec.surface,
          success,
          durationMs: Date.now() - start,
          errorMessage,
          evidenceManifestId: runId + '/' + spec.id,
        },
        manifest: {
          runId,
          journeyId: spec.id,
          surface: spec.surface,
          capturedAt: new Date().toISOString(),
          gitSha,
          artifacts,
          success,
          failureReason: errorMessage,
        },
      });
    } catch (journeyErr) {
      results.push({
        result: { journeyId: spec.id, surface: spec.surface, success: false, durationMs: 0, errorMessage: journeyErr.message || String(journeyErr) },
        manifest: { runId, journeyId: spec.id, surface: spec.surface, capturedAt: new Date().toISOString(), gitSha, artifacts: [], success: false, failureReason: journeyErr.message || String(journeyErr) },
      });
    }
  }

  await browser.close();

  // Delimit JSON so the orchestrator can parse it reliably from mixed stdout
  console.log('${MANIFEST_START}');
  console.log(JSON.stringify(results));
  console.log('${MANIFEST_END}');
})();
`.trim();
}

/** Artifact shape returned by the sandbox runner (includes base64 payload). */
interface SandboxArtifact {
  id: string;
  kind: string;
  fileName: string;
  dataBase64: string;
  capturedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Run all specified journeys inside a Modal Sandbox with Playwright,
 * capture evidence, and return aggregated results.
 *
 * Replaces the previous local-Playwright approach so evidence capture
 * works inside Trigger.dev containers (where Playwright is externalised).
 */
export async function captureJourneyEvidence(
  journeys: JourneySpec[],
  config: CaptureConfig,
): Promise<CaptureResult> {
  const runId = randomUUID();
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown";
  const viewport = config.viewport ?? DEFAULT_VIEWPORT;
  const startedAt = new Date().toISOString();

  const runDir = join(config.evidenceDir, runId);
  await mkdir(runDir, { recursive: true });

  let journeyOutputs: JourneyRunOutput[] = [];

  if (shouldUseLocalPlaywright(config.baseUrl)) {
    journeyOutputs = await captureJourneyEvidenceLocally(journeys, config, runId, gitSha, viewport);
  } else {
    // --- Modal Sandbox setup ---
    const modal = new ModalClient();
    const app = await modal.apps.fromName("motian-autopilot", {
      createIfMissing: true,
    });
    const image = modal.images
      .fromRegistry(MODAL_PLAYWRIGHT_IMAGE)
      .dockerfileCommands([
        `RUN mkdir -p ${MODAL_WORKDIR}`,
        `RUN cd ${MODAL_WORKDIR} && npm init -y`,
        `RUN cd ${MODAL_WORKDIR} && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright@1.58.0`,
      ]);
    const sb = await modal.sandboxes.create(app, image, {
      timeoutMs: 600_000,
      workdir: MODAL_WORKDIR,
    });

    try {
      const runnerConfig = {
        journeys,
        baseUrl: config.baseUrl,
        evidenceDir: "/tmp/evidence",
        runId,
        gitSha,
        viewport,
      };
      const configB64 = Buffer.from(JSON.stringify(runnerConfig)).toString("base64");
      const runnerScript = buildSandboxRunnerScript();

      const proc = await sb.exec(["node", "-e", runnerScript, configB64], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await proc.stdout.readText();
      const stderr = await proc.stderr.readText();
      await proc.wait();

      if (stderr) {
        console.warn("[modal-sandbox] stderr:", stderr);
      }

      const startIdx = stdout.indexOf(MANIFEST_START);
      const endIdx = stdout.indexOf(MANIFEST_END);
      if (startIdx === -1 || endIdx === -1) {
        throw new Error(
          `Sandbox runner produceerde geen geldig manifest. stdout: ${stdout.slice(0, 500)}`,
        );
      }

      const jsonStr = stdout.slice(startIdx + MANIFEST_START.length, endIdx).trim();
      const rawResults: Array<{
        result: JourneyRunOutput["result"];
        manifest: Omit<JourneyRunOutput["manifest"], "artifacts"> & {
          artifacts: SandboxArtifact[];
        };
      }> = JSON.parse(jsonStr);

      for (const entry of rawResults) {
        const localArtifacts = [];
        for (const art of entry.manifest.artifacts) {
          const localPath = join(runDir, art.fileName);
          await writeFile(localPath, Buffer.from(art.dataBase64, "base64"));
          localArtifacts.push({
            id: art.id,
            kind: art.kind as "screenshot" | "console-log" | "video" | "trace" | "har",
            path: localPath,
            capturedAt: art.capturedAt,
            metadata: art.metadata,
          });
        }

        journeyOutputs.push({
          result: entry.result,
          manifest: {
            runId: entry.manifest.runId,
            journeyId: entry.manifest.journeyId,
            surface: entry.manifest.surface,
            capturedAt: entry.manifest.capturedAt,
            gitSha: entry.manifest.gitSha,
            artifacts: localArtifacts,
            success: entry.manifest.success,
            failureReason: entry.manifest.failureReason,
          },
        });
      }
    } finally {
      await sb.terminate();
    }
  }

  for (const entry of journeyOutputs) {
    const manifestPath = join(runDir, `${entry.manifest.journeyId}-manifest.json`);
    await writeFile(manifestPath, JSON.stringify(entry.manifest, null, 2), "utf-8");
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
