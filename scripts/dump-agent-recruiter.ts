import { config } from "dotenv";

config({ path: ".env.local" });

import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://login.striive.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));
  await page.locator("#email").fill(process.env.STRIIVE_USERNAME!);
  await new Promise((r) => setTimeout(r, 300));
  await page.locator("#password").fill(process.env.STRIIVE_PASSWORD!);
  await new Promise((r) => setTimeout(r, 300));
  await page.locator('[data-testid="login"]').click();
  await new Promise((r) => setTimeout(r, 5000));
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const listRes = await fetch(
    "https://supplier.striive.com/api/v2/job-requests?page=0&size=3&status=OPEN",
    {
      headers: { Cookie: cookieHeader, Accept: "application/json" },
    },
  );
  const jobs = await listRes.json();

  for (const job of jobs) {
    const detailRes = await fetch(`https://supplier.striive.com/api/job-requests/${job.id}`, {
      headers: { Cookie: cookieHeader, Accept: "application/json" },
    });
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    console.log(`=== ${job.title} (${job.referenceCode}) ===`);
    console.log("AGENT:", JSON.stringify(detail.agent, null, 2));
    console.log("RECRUITER:", JSON.stringify(detail.recruiter, null, 2));
    console.log("");
  }

  await browser.close();
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
