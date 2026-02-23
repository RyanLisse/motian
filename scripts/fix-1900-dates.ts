/**
 * One-time fix: null out sentinel 1900-* dates from opdrachtoverheid API.
 *
 * Usage: npx tsx scripts/fix-1900-dates.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";

async function main() {
  // Null out startDate where it's a 1900 sentinel
  const startResult = await db
    .update(jobs)
    .set({ startDate: null })
    .where(sql`${jobs.startDate} < '2020-01-01'`);

  // Null out endDate where it's a 1900 sentinel
  const endResult = await db
    .update(jobs)
    .set({ endDate: null })
    .where(sql`${jobs.endDate} < '2020-01-01'`);

  // Null out applicationDeadline where it's a 1900 sentinel
  const deadlineResult = await db
    .update(jobs)
    .set({ applicationDeadline: null })
    .where(sql`${jobs.applicationDeadline} < '2020-01-01'`);

  console.log("Fixed 1900 sentinel dates:");
  console.log(`  startDate: ${startResult.rowCount} rows`);
  console.log(`  endDate: ${endResult.rowCount} rows`);
  console.log(`  applicationDeadline: ${deadlineResult.rowCount} rows`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
