/**
 * Dump full Striive detail to see all available fields.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { chromium } from "playwright";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set.`);
  }
  return value;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://login.striive.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));
  await page.locator("#email").fill(getEnvOrThrow("STRIIVE_USERNAME"));
  await new Promise((r) => setTimeout(r, 300));
  await page.locator("#password").fill(getEnvOrThrow("STRIIVE_PASSWORD"));
  await new Promise((r) => setTimeout(r, 300));
  await page.locator('[data-testid="login"]').click();
  await new Promise((r) => setTimeout(r, 5000));

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // Get a few different jobs for variety
  const listRes = await fetch("https://supplier.striive.com/api/v2/job-requests?page=0&size=3", {
    headers: { Cookie: cookieHeader, Accept: "application/json" },
  });
  const jobs = await listRes.json();

  console.log("=== LIST API FIELDS (all 3 jobs) ===");
  const allListKeys = new Set<string>();
  for (const j of jobs) {
    flatKeys(j, "", allListKeys);
  }
  console.log([...allListKeys].sort().join("\n"));

  for (const job of jobs.slice(0, 2)) {
    console.log(`\n=== DETAIL FOR ${job.referenceCode} (id: ${job.id}) ===`);
    const detailRes = await fetch(`https://supplier.striive.com/api/job-requests/${job.id}`, {
      headers: { Cookie: cookieHeader, Accept: "application/json" },
    });

    if (!detailRes.ok) {
      console.log(`Status: ${detailRes.status}`);
      continue;
    }

    const detail = await detailRes.json();

    // Print all keys with types and sample values
    const keys = Object.keys(detail).sort();
    for (const key of keys) {
      const val = detail[key];
      const type = Array.isArray(val) ? `array[${val.length}]` : typeof val;
      let sample = "";
      if (type === "string") sample = val.slice(0, 80);
      else if (type === "number" || type === "boolean") sample = String(val);
      else if (type.startsWith("array")) {
        sample = val.length > 0 ? JSON.stringify(val[0]).slice(0, 120) : "[]";
      } else if (val && typeof val === "object") {
        sample = JSON.stringify(val).slice(0, 120);
      } else {
        sample = String(val);
      }
      console.log(`  ${key}: ${type} = ${sample}`);
    }
  }

  await browser.close();
  process.exit(0);
}

function flatKeys(obj: Record<string, unknown>, prefix: string, set: Set<string>) {
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    set.add(path);
    if (val && typeof val === "object" && !Array.isArray(val)) {
      flatKeys(val, path, set);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
