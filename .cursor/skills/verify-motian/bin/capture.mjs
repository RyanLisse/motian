#!/usr/bin/env node
/**
 * Playwright capture helper for verify-motian.
 *
 *   node bin/capture.mjs --path /kandidaten --name kandidaten-list --expect-text Kandidaten
 *
 * Writes screenshot + text dump under the current run evidence dir
 * (from state/instance.json) or --out-dir.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const instanceFile = join(skillDir, "state", "instance.json");

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const instance = (() => {
  try {
    return JSON.parse(readFileSync(instanceFile, "utf8"));
  } catch {
    return null;
  }
})();

const baseUrl = arg("--base-url") || instance?.baseUrl;
const path = arg("--path", "/overzicht");
const name = arg("--name", "capture");
const expectText = arg("--expect-text");
const fillSelector = arg("--fill-selector");
const fillValue = arg("--fill-value");
const clickSelector = arg("--click-selector");
const waitMs = Number(arg("--wait-ms", "0"));
const outDir =
  arg("--out-dir") ||
  (instance?.evidenceDir ? join(instance.evidenceDir, name) : join(skillDir, "evidence", "loose", name));

if (!baseUrl) {
  console.error("capture: no --base-url and no state/instance.json. Run bin/launch.sh first.");
  process.exit(1);
}

if (new URL(baseUrl).port === "3002") {
  console.error("capture: refusing base URL on port 3002 (user default).");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const url = new URL(path, baseUrl).toString();
const launchOptions = {
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
};
const browser = process.env.MOTIAN_VERIFY_CHROME_CHANNEL
  ? await chromium.launch({ ...launchOptions, channel: process.env.MOTIAN_VERIFY_CHROME_CHANNEL })
  : await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("h1, [data-slot='sidebar']", { timeout: 30_000 });

  if (fillSelector && fillValue != null) {
    await page.locator(fillSelector).first().fill(fillValue);
  }
  if (clickSelector) {
    await page.locator(clickSelector).first().click();
  }
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const heading = (await page.locator("h1").first().textContent().catch(() => ""))?.trim() ?? "";
  const title = await page.title();
  const bodyText = await page.locator("body").innerText();

  if (expectText && !bodyText.includes(expectText)) {
    writeFileSync(join(outDir, "body.txt"), bodyText);
    throw new Error(`expected text ${JSON.stringify(expectText)} not found on ${url}`);
  }

  const shotPath = join(outDir, `${name}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  writeFileSync(join(outDir, "body.txt"), bodyText);
  writeFileSync(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        url,
        title,
        heading,
        expectText,
        capturedAt: new Date().toISOString(),
        screenshot: shotPath,
      },
      null,
      2,
    ),
  );

  console.log(`capture: OK ${url}`);
  console.log(`  heading=${heading}`);
  console.log(`  title=${title}`);
  console.log(`  out=${outDir}`);
} finally {
  await browser.close();
}
