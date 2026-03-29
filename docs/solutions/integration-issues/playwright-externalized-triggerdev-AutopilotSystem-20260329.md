---
module: Autopilot System
date: 2026-03-29
problem_type: integration_issue
component: background_job
symptoms:
  - "Autopilot nightly cron never runs successfully in production"
  - "chromium.launch() fails at runtime in Trigger.dev container"
  - "Playwright and playwright-core listed in build.external in trigger.config.ts"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [autopilot, playwright, trigger-dev, modal, browser-automation, externalized-dependency]
---

# Troubleshooting: Playwright Externalized from Trigger.dev Build Blocks Autopilot

## Problem
The Autopilot nightly browser audit could never run in production because `trigger.config.ts` externalized Playwright (`build.external: ["playwright", "playwright-core"]`), meaning the Chromium binary was never bundled into the Trigger.dev container. Calling `chromium.launch()` at runtime failed immediately.

## Environment
- Module: Autopilot System
- Framework: Next.js 16 + Trigger.dev v4 + Playwright 1.58
- Affected Component: `src/autopilot/evidence/capture.ts`, `trigger.config.ts`
- Date: 2026-03-29

## Symptoms
- Autopilot nightly cron (`0 4 * * *`) never produced any runs in the `autopilot_runs` database table
- `chromium.launch()` in `capture.ts` would throw at runtime because Playwright binary wasn't in the Trigger.dev container
- `trigger.config.ts` had `playwright` and `playwright-core` in `build.external` array — meaning "don't bundle these"
- `execSync("git rev-parse HEAD")` also failed (no git repo in container)
- Missing env vars: `AUTOPILOT_BASE_URL`, `AUTOPILOT_GITHUB_TOKEN`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` not in `syncEnvVars`

## What Didn't Work

**Attempted Solution 1:** Using the Playwright build extension for Trigger.dev
- **Why it failed:** Playwright's Chromium binary is ~400MB, too large for Trigger.dev's serverless containers. The extension approach was considered but rejected for container size constraints.

**Attempted Solution 2:** Using Browserbase (remote browser service)
- **Why it failed:** Already had `BROWSERBASE_API_KEY` configured but the existing code used Playwright's API, not puppeteer-core. Would require rewriting journey runner logic. Also considered but Modal was chosen for full container control.

## Solution

Replaced local `chromium.launch()` with **Modal Sandbox** containers. The Trigger.dev task now spins up an ephemeral Modal container using the official Playwright Docker image (`mcr.microsoft.com/playwright:v1.52.0-noble`), runs all journeys inside it, and shuttles evidence back via base64-encoded stdout.

**Key architectural changes:**

```typescript
// Before (broken): local Playwright in Trigger.dev container
import { chromium } from "playwright";
const browser = await chromium.launch();

// After (working): Modal Sandbox with Playwright image
import { ModalClient } from "modal";
const modal = new ModalClient();
const app = await modal.apps.fromName("motian-autopilot", { createIfMissing: true });
const image = modal.images.fromRegistry("mcr.microsoft.com/playwright:v1.52.0-noble");
const sb = await modal.sandboxes.create(app, image, { timeoutMs: 600_000 });

// Execute inline runner script inside sandbox
const proc = await sb.exec(["node", "-e", runnerScript, configB64], {
  stdout: "pipe", stderr: "pipe",
});
```

**Other fixes:**
- Replaced `execSync("git rev-parse HEAD")` with `process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown"`
- Added 9 env vars to `trigger.config.ts` `syncEnvVars`
- Removed `playwright`/`playwright-core` from `build.external`
- Screenshots base64-encoded in stdout JSON manifest, decoded locally
- Added `modal@^0.6.3` as project dependency

## Why This Works

1. **Root cause:** Playwright was externalized because it has native binaries that can't be bundled by esbuild. But "externalized" means "assume it's available at runtime" — and it wasn't.
2. **Modal provides a real container** with the full Playwright image (Node.js + Chromium + Playwright). The Trigger.dev worker only needs the lightweight `modal` npm package to orchestrate.
3. **Base64 artifact shuttling** avoids needing Modal's filesystem API — binary screenshots are encoded in the JSON manifest written to stdout, then decoded locally.

## Prevention

- When adding browser automation to serverless environments, check if the runtime supports heavy native binaries
- If a dependency is in `build.external`, verify it's actually available in the target container
- For Playwright specifically: use remote browsers (Modal, Browserbase) rather than trying to bundle Chromium
- Always check `trigger.config.ts` `syncEnvVars` when adding features that need new environment variables

## Related Issues

- See also: [scraper-analytics-schedule-optimization-ScraperSystem-20260223.md](../workflow-issues/scraper-analytics-schedule-optimization-ScraperSystem-20260223.md) — similar Trigger.dev cron configuration
