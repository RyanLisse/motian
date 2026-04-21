/**
 * candidate-flow.ts
 *
 * End-to-end test for the full production candidate pipeline, driven by Playwright.
 * Walks a real CV through the UI: upload → parse → profile preview → save →
 * auto-match → linking step → candidate detail → pipeline surface.
 *
 * Writes visual evidence (full-page screenshots), a JSON manifest, and a
 * human-readable Markdown report into `harness-evidence/candidate-flow-e2e/<run-id>/`.
 *
 * Usage:
 *   pnpm test:e2e:candidate                     # against http://localhost:3002
 *   BASE_URL=https://staging.motian.dev pnpm test:e2e:candidate
 *   E2E_CV_FIXTURE=tests/fixtures/cv/custom.pdf pnpm test:e2e:candidate
 *   E2E_HEADLESS=0 pnpm test:e2e:candidate       # see the browser
 *   E2E_KEEP_CANDIDATE=1 pnpm test:e2e:candidate # skip cleanup
 *
 * The script is designed to be resilient: each step records a pass/fail
 * outcome and captures what it can. A backend failure (e.g. missing DB
 * credentials) produces a clearly labelled failure screenshot rather than a
 * crash with no evidence.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";

/**
 * Resolve the Chromium binary to use for the run. In order of preference:
 *   1. PLAYWRIGHT_CHROMIUM_PATH env var (explicit override)
 *   2. Playwright's default managed install (let the API pick it)
 *   3. Any pre-installed Playwright chromium under /opt/pw-browsers
 *      (used in sandboxed environments where downloads are blocked)
 */
function resolveChromiumExecutable(): string | undefined {
  const override = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (override && existsSync(override)) return override;

  const PW_ROOT = "/opt/pw-browsers";
  if (existsSync(PW_ROOT)) {
    try {
      const entry = readdirSync(PW_ROOT)
        .filter((name) => name.startsWith("chromium-") && !name.includes("headless_shell"))
        .sort()
        .pop();
      if (entry) {
        const candidate = join(PW_ROOT, entry, "chrome-linux", "chrome");
        if (existsSync(candidate)) return candidate;
      }
    } catch {
      /* fall through */
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3002}`).replace(
  /\/$/,
  "",
);
const HEADLESS = process.env.E2E_HEADLESS !== "0";
const VIEWPORT = { width: 1440, height: 900 };
const NAV_TIMEOUT_MS = Number(process.env.E2E_NAV_TIMEOUT_MS ?? 30_000);
const PARSE_TIMEOUT_MS = Number(process.env.E2E_PARSE_TIMEOUT_MS ?? 120_000);
const SUBMIT_TIMEOUT_MS = Number(process.env.E2E_SUBMIT_TIMEOUT_MS ?? 120_000);
const KEEP_CANDIDATE = process.env.E2E_KEEP_CANDIDATE === "1";

const DEFAULT_FIXTURE = resolve(
  process.cwd(),
  process.env.E2E_CV_FIXTURE ?? "tests/fixtures/cv/pieter-vandenberg.pdf",
);

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const EVIDENCE_ROOT = resolve(process.cwd(), "harness-evidence", "candidate-flow-e2e");
const RUN_DIR = join(EVIDENCE_ROOT, RUN_ID);

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const COLOR = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(line: string): void {
  console.log(line);
}
function logInfo(line: string): void {
  console.log(`${COLOR.cyan}${line}${COLOR.reset}`);
}
function logOk(line: string): void {
  console.log(`${COLOR.green}✓ ${line}${COLOR.reset}`);
}
function logWarn(line: string): void {
  console.log(`${COLOR.yellow}! ${line}${COLOR.reset}`);
}
function logErr(line: string): void {
  console.log(`${COLOR.red}✗ ${line}${COLOR.reset}`);
}

function timestamp(): string {
  return new Date().toISOString();
}

function currentGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Step bookkeeping
// ---------------------------------------------------------------------------

type StepStatus = "pass" | "fail" | "skip";

interface StepRecord {
  index: number;
  slug: string;
  title: string;
  status: StepStatus;
  durationMs: number;
  screenshot?: string;
  details?: Record<string, unknown>;
  error?: string;
}

interface RunManifest {
  runId: string;
  gitSha: string;
  baseUrl: string;
  fixture: string;
  startedAt: string;
  finishedAt: string;
  outcome: "pass" | "fail" | "partial";
  candidateId?: string;
  candidateName?: string;
  recommendedMatchId?: string;
  steps: StepRecord[];
}

class Recorder {
  private steps: StepRecord[] = [];
  private counter = 0;

  constructor(private page: Page) {}

  get results(): readonly StepRecord[] {
    return this.steps;
  }

  private nextFilename(slug: string, ext = "png"): { file: string; path: string } {
    this.counter += 1;
    const prefix = String(this.counter).padStart(2, "0");
    const file = `${prefix}-${slug}.${ext}`;
    return { file, path: join(RUN_DIR, file) };
  }

  async record<T>(
    slug: string,
    title: string,
    action: () => Promise<{ details?: Record<string, unknown>; result?: T } | undefined>,
  ): Promise<T | undefined> {
    const { file, path } = this.nextFilename(slug);
    const started = Date.now();
    logInfo(`[${String(this.counter).padStart(2, "0")}] ${title}`);

    try {
      const outcome = (await action()) ?? {};
      await this.snapshot(path);
      const step: StepRecord = {
        index: this.counter,
        slug,
        title,
        status: "pass",
        durationMs: Date.now() - started,
        screenshot: file,
        details: outcome?.details,
      };
      this.steps.push(step);
      logOk(`${title}  (${step.durationMs}ms)  → ${file}`);
      return outcome?.result as T | undefined;
    } catch (err) {
      // Always try to take a screenshot of whatever state we're in, so we
      // have visual evidence of the failure.
      await this.snapshot(path).catch(() => undefined);
      const message = err instanceof Error ? err.message : String(err);
      const step: StepRecord = {
        index: this.counter,
        slug,
        title,
        status: "fail",
        durationMs: Date.now() - started,
        screenshot: file,
        error: message,
      };
      this.steps.push(step);
      logErr(`${title}: ${message}`);
      return undefined;
    }
  }

  skip(slug: string, title: string, reason: string): void {
    this.counter += 1;
    this.steps.push({
      index: this.counter,
      slug,
      title,
      status: "skip",
      durationMs: 0,
      error: reason,
    });
    logWarn(`${title}: SKIPPED — ${reason}`);
  }

  private async snapshot(path: string): Promise<void> {
    try {
      await this.page.screenshot({ path, fullPage: true });
    } catch (err) {
      logWarn(`screenshot failed: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Preconditions
// ---------------------------------------------------------------------------

async function waitForServer(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  // Probe a lightweight route that doesn't touch the DB, so the test can start
  // even if the full app surface is slow to compile on first hit.
  const probeUrl = `${url}/api/gezondheid`;
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      const res = await fetch(probeUrl, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      if (res.status < 600) return true;
    } catch {
      // not yet ready
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

function ensureRunDir(): void {
  if (!existsSync(RUN_DIR)) {
    mkdirSync(RUN_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function runCandidateFlow(): Promise<number> {
  ensureRunDir();

  log("");
  log(`${COLOR.bold}=== Motian Candidate Flow E2E ===${COLOR.reset}`);
  log(`Base URL  : ${BASE_URL}`);
  log(`Fixture   : ${DEFAULT_FIXTURE}`);
  log(`Run dir   : ${RUN_DIR}`);
  log(`Headless  : ${HEADLESS}`);
  log("");

  if (!existsSync(DEFAULT_FIXTURE)) {
    logErr(`CV fixture not found: ${DEFAULT_FIXTURE}`);
    return 2;
  }

  const reachable = await waitForServer(BASE_URL);
  if (!reachable) {
    logErr(`Dev server at ${BASE_URL} is not reachable. Start it with: pnpm dev`);
    return 2;
  }
  logOk(`Dev server reachable at ${BASE_URL}`);

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  const startedAt = timestamp();
  let outcome: "pass" | "fail" | "partial" = "pass";
  let candidateId: string | undefined;
  let candidateName: string | undefined;
  let recommendedMatchId: string | undefined;

  try {
    const executablePath = resolveChromiumExecutable();
    if (executablePath) {
      logInfo(`Using Chromium at ${executablePath}`);
    }
    browser = await chromium.launch({ headless: HEADLESS, executablePath });
    context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // Surface browser console errors into our manifest for debugging.
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[console.error] ${msg.text()}`);
    });

    const recorder = new Recorder(page);

    // --------------------------------------------------------------
    // Step 1 — Kandidaten list loads
    // --------------------------------------------------------------
    await recorder.record("kandidaten-list", "Navigate to /kandidaten", async () => {
      const response = await page.goto(`${BASE_URL}/kandidaten`, { waitUntil: "domcontentloaded" });
      if (!response?.ok()) {
        throw new Error(`HTTP ${response?.status() ?? "?"} for /kandidaten`);
      }
      await page.getByRole("button", { name: /Kandidaat toevoegen/ }).waitFor({ state: "visible" });
      return { details: { status: response.status(), title: await page.title() } };
    });

    // --------------------------------------------------------------
    // Step 2 — Open the intake wizard
    // --------------------------------------------------------------
    await recorder.record("wizard-open", "Open Kandidaat toevoegen wizard", async () => {
      await page.getByRole("button", { name: /Kandidaat toevoegen/ }).click();
      await page.getByRole("heading", { name: /Kandidaat intake/i }).waitFor({ state: "visible" });
    });

    // --------------------------------------------------------------
    // Step 3 — Switch to CV upload mode
    // --------------------------------------------------------------
    await recorder.record("wizard-cv-mode", "Select CV upload mode", async () => {
      // The mode selector buttons are plain <button> elements with a <p>
      // "CV upload" inside — target via text.
      await page.locator("button", { hasText: "CV upload" }).first().click();
      await page
        .getByText("CV upload als startpunt", { exact: false })
        .waitFor({ state: "visible" });
    });

    // --------------------------------------------------------------
    // Step 4 — Upload the CV and wait for AI parsing
    // --------------------------------------------------------------
    const parseDetails = await recorder.record<{
      parsedName?: string;
      parsedRole?: string;
    }>("cv-parse", "Upload CV and wait for AI parsing", async () => {
      await page.setInputFiles("#wzp-cv", DEFAULT_FIXTURE);
      // Wait for the preview card that appears after /api/cv-upload returns.
      await page
        .getByText("CV-profielpreview gereed")
        .waitFor({ state: "visible", timeout: PARSE_TIMEOUT_MS });

      const parsedName = await page
        .locator(
          'p.text-sm.font-semibold.text-foreground:right-of(:text("CV-profielpreview gereed"))',
        )
        .first()
        .textContent()
        .catch(() => null);

      // Fallbacks: read the populated form fields (they get pre-filled from parse).
      const nameFromField = await page
        .locator("#wzp-name")
        .inputValue()
        .catch(() => "");
      const roleFromField = await page
        .locator("#wzp-role")
        .inputValue()
        .catch(() => "");

      return {
        details: {
          parsedName: parsedName?.trim() || nameFromField,
          parsedRole: roleFromField,
          fixture: basename(DEFAULT_FIXTURE),
        },
        result: {
          parsedName: nameFromField || parsedName || undefined,
          parsedRole: roleFromField || undefined,
        },
      };
    });

    candidateName = parseDetails?.parsedName;

    // --------------------------------------------------------------
    // Step 5 — Submit the profile (triggers save + auto-match pipeline)
    // --------------------------------------------------------------
    const submitResult = await recorder.record<{ candidateId?: string }>(
      "profile-submit",
      "Submit profile (save + auto-match)",
      async () => {
        // Intercept the save response so we can capture the DB-assigned id,
        // which is otherwise not exposed in the wizard markup.
        const savePromise = page
          .waitForResponse(
            (resp) =>
              resp.url().includes("/api/cv-upload/save") && resp.request().method() === "POST",
            { timeout: SUBMIT_TIMEOUT_MS },
          )
          .catch(() => null);

        await page.getByRole("button", { name: /Kandidaat opslaan en topmatches tonen/i }).click();

        const saveResp = await savePromise;
        let capturedId: string | undefined;
        if (saveResp?.ok()) {
          try {
            const body = (await saveResp.json()) as Record<string, unknown>;
            const direct = typeof body.candidateId === "string" ? body.candidateId : undefined;
            const nested =
              body.candidate && typeof body.candidate === "object"
                ? ((body.candidate as Record<string, unknown>).id as string | undefined)
                : undefined;
            const dataId =
              body.data && typeof body.data === "object"
                ? ((body.data as Record<string, unknown>).id as string | undefined)
                : undefined;
            capturedId = direct ?? nested ?? dataId;
          } catch {
            /* ignore body-parse errors */
          }
        }

        // Wait for the linking-step heading.
        await page
          .getByRole("heading", { name: /Review & koppelen/i })
          .waitFor({ state: "visible", timeout: SUBMIT_TIMEOUT_MS });

        return {
          details: {
            candidateId: capturedId,
            saveStatus: saveResp?.status() ?? null,
          },
          result: { candidateId: capturedId },
        };
      },
    );

    candidateId = submitResult?.candidateId;

    // --------------------------------------------------------------
    // Step 6 — Linking step: topmatches visible
    // --------------------------------------------------------------
    await recorder.record("linking-matches", "Review top matches", async () => {
      // The linking step renders MatchSuggestionCard list (zero, one, or many).
      // We wait a short moment for any async-loaded persisted matches to render.
      await page.waitForTimeout(500);
      const matchCount = await page.locator("[data-match-id], [data-slot='match-card']").count();

      return { details: { matchCount } };
    });

    // --------------------------------------------------------------
    // Step 7 — Close wizard via "sla over" (skip) to keep the flow idempotent
    // --------------------------------------------------------------
    await recorder.record("linking-close", "Close wizard and return to list", async () => {
      const skipButton = page.getByRole("button", {
        name: /Sla over|Overslaan|Later koppelen/i,
      });
      const finishButton = page.getByRole("button", { name: /Opslaan|Klaar|Voltooien/i });
      if (await skipButton.count()) {
        await skipButton.first().click();
      } else if (await finishButton.count()) {
        await finishButton.first().click();
      } else {
        // Fall back: close the modal.
        await page.keyboard.press("Escape");
      }
      await page.waitForURL(/\/kandidaten(\?|$)/, { timeout: 10_000 }).catch(() => undefined);
      await page.getByRole("button", { name: /Kandidaat toevoegen/ }).waitFor({ state: "visible" });
    });

    // --------------------------------------------------------------
    // Step 8 — Candidate detail page
    // --------------------------------------------------------------
    if (candidateId) {
      await recorder.record("candidate-detail", "Open candidate detail page", async () => {
        const detailUrl = `${BASE_URL}/kandidaten/${candidateId}`;
        const response = await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
        if (!response?.ok()) {
          throw new Error(`HTTP ${response?.status() ?? "?"} for ${detailUrl}`);
        }
        await page.waitForLoadState("networkidle").catch(() => undefined);
        return {
          details: {
            url: detailUrl,
            status: response.status(),
            title: await page.title(),
          },
        };
      });
    } else {
      recorder.skip(
        "candidate-detail",
        "Open candidate detail page",
        "No candidateId captured from /api/cv-upload/save response",
      );
    }

    // --------------------------------------------------------------
    // Step 9 — Pipeline surface reflects the new candidate
    // --------------------------------------------------------------
    await recorder.record("pipeline", "Verify /pipeline surface renders", async () => {
      const response = await page.goto(`${BASE_URL}/pipeline`, { waitUntil: "domcontentloaded" });
      if (!response?.ok()) {
        throw new Error(`HTTP ${response?.status() ?? "?"} for /pipeline`);
      }
      await page.waitForLoadState("networkidle").catch(() => undefined);
      return { details: { title: await page.title() } };
    });

    // --------------------------------------------------------------
    // Step 10 — Vacatures surface (confirms jobs exist for matching)
    // --------------------------------------------------------------
    await recorder.record("vacatures", "Verify /vacatures surface renders", async () => {
      const response = await page.goto(`${BASE_URL}/vacatures`, { waitUntil: "domcontentloaded" });
      if (!response?.ok()) {
        throw new Error(`HTTP ${response?.status() ?? "?"} for /vacatures`);
      }
      await page.waitForLoadState("networkidle").catch(() => undefined);
      return { details: { title: await page.title() } };
    });

    // --------------------------------------------------------------
    // Step 11 — Cleanup (best effort)
    // --------------------------------------------------------------
    if (candidateId && !KEEP_CANDIDATE) {
      try {
        const res = await fetch(`${BASE_URL}/api/kandidaten/${candidateId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          logOk(`Cleaned up candidate ${candidateId} via DELETE /api/kandidaten/:id`);
        } else {
          logWarn(`Cleanup returned HTTP ${res.status} for candidate ${candidateId}`);
        }
      } catch (err) {
        logWarn(`Cleanup failed: ${(err as Error).message}`);
      }
    }

    // --------------------------------------------------------------
    // Summary
    // --------------------------------------------------------------
    const results = recorder.results;
    const failed = results.filter((r) => r.status === "fail").length;
    const skipped = results.filter((r) => r.status === "skip").length;
    if (failed > 0) outcome = "fail";
    else if (skipped > 0) outcome = "partial";

    const manifest: RunManifest = {
      runId: RUN_ID,
      gitSha: currentGitSha(),
      baseUrl: BASE_URL,
      fixture: DEFAULT_FIXTURE,
      startedAt,
      finishedAt: timestamp(),
      outcome,
      candidateId,
      candidateName,
      recommendedMatchId,
      steps: [...results],
    };

    writeFileSync(join(RUN_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    writeFileSync(
      join(RUN_DIR, "README.md"),
      renderMarkdownReport(manifest, consoleErrors),
      "utf8",
    );

    log("");
    log(`${COLOR.bold}=== Summary ===${COLOR.reset}`);
    log(`Outcome    : ${outcome === "pass" ? COLOR.green : COLOR.red}${outcome}${COLOR.reset}`);
    log(`Total steps: ${results.length}`);
    log(`Passed     : ${results.length - failed - skipped}`);
    log(`Failed     : ${failed}`);
    log(`Skipped    : ${skipped}`);
    log(`Evidence   : ${RUN_DIR}`);
    log("");

    return outcome === "pass" ? 0 : 1;
  } catch (err) {
    logErr(`Unexpected error: ${(err as Error).message}`);
    writeFileSync(
      join(RUN_DIR, "error.txt"),
      `${(err as Error).stack ?? (err as Error).message}\n`,
      "utf8",
    );
    return 1;
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

function renderMarkdownReport(manifest: RunManifest, consoleErrors: string[]): string {
  const statusIcon: Record<StepStatus, string> = {
    pass: "✅",
    fail: "❌",
    skip: "⚠️",
  };

  const rows = manifest.steps
    .map((step) => {
      const icon = statusIcon[step.status];
      return `| ${step.index} | ${icon} ${step.status.toUpperCase()} | ${step.title} | ${step.durationMs}ms | ${
        step.screenshot ? `[${step.screenshot}](./${step.screenshot})` : "—"
      } |`;
    })
    .join("\n");

  const images = manifest.steps
    .filter((step) => step.screenshot)
    .map(
      (step) =>
        `### ${step.index}. ${statusIcon[step.status]} ${step.title}\n\n` +
        (step.error ? `> Error: \`${step.error}\`\n\n` : "") +
        `![${step.slug}](./${step.screenshot})\n`,
    )
    .join("\n");

  return `# Candidate Flow E2E — ${manifest.runId}

- **Outcome**: ${manifest.outcome.toUpperCase()}
- **Git SHA**: \`${manifest.gitSha}\`
- **Base URL**: ${manifest.baseUrl}
- **Fixture**: \`${basename(manifest.fixture)}\`
- **Started**: ${manifest.startedAt}
- **Finished**: ${manifest.finishedAt}
- **Candidate ID**: ${manifest.candidateId ?? "—"}
- **Candidate Name (parsed)**: ${manifest.candidateName ?? "—"}

## Step summary

| # | Status | Step | Duration | Evidence |
|---|--------|------|----------|----------|
${rows}

## Visual evidence

${images}

${
  consoleErrors.length > 0
    ? `## Browser console errors\n\n\`\`\`\n${consoleErrors.slice(0, 50).join("\n")}\n\`\`\`\n`
    : ""
}
`;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

runCandidateFlow()
  .then((code) => process.exit(code))
  .catch((err) => {
    logErr(`Fatal: ${(err as Error).stack ?? (err as Error).message}`);
    process.exit(1);
  });
