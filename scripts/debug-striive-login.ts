/**
 * Debug Striive API response format.
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
  console.log("Logged in. URL:", page.url());

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // Test different API endpoints
  for (const endpoint of [
    "/api/v2/job-requests?page=0&size=2",
    "/api/v2/job-requests?page=0&size=2&status=OPEN",
    "/api/v2/job-requests?page=0&size=2&sort=createdDate,desc",
  ]) {
    console.log(`\n--- ${endpoint} ---`);
    const res = await fetch(`https://supplier.striive.com${endpoint}`, {
      headers: { Cookie: cookieHeader, Accept: "application/json" },
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        console.log(`Array with ${data.length} items`);
        if (data[0]) {
          console.log("First item keys:", Object.keys(data[0]).sort().join(", "));
          console.log("First item sample:", JSON.stringify(data[0], null, 2).slice(0, 500));
        }
      } else {
        console.log("Response type:", typeof data);
        console.log("Keys:", Object.keys(data));
        if (data.content) {
          console.log(`content: ${data.content.length} items`);
        }
        if (data.totalElements) {
          console.log(`totalElements: ${data.totalElements}`);
        }
        // Show raw structure
        console.log("Sample:", JSON.stringify(data, null, 2).slice(0, 800));
      }
    }
  }

  // Also try a detail endpoint with known job IDs
  console.log("\n--- Trying listing page via browser to find job IDs ---");
  await page.goto("https://supplier.striive.com/jobrequests/list", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await new Promise((r) => setTimeout(r, 3000));

  // Intercept API calls from the Angular app
  const interceptedUrl: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/")) {
      interceptedUrl.push(req.url());
    }
  });

  // Reload to capture API calls
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));

  console.log("Intercepted API calls:");
  for (const u of interceptedUrl) {
    console.log(`  ${u}`);
  }

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
