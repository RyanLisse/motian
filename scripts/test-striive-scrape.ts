/**
 * Direct test of the local Striive scraper.
 * Run: npx tsx scripts/test-striive-scrape.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { scrapeStriive } from "../src/services/scrapers/striive";

async function main() {
  console.log("=== Testing Striive Scraper (Local Mode) ===");
  console.log("STRIIVE_USERNAME:", process.env.STRIIVE_USERNAME ? "set" : "MISSING");
  console.log("STRIIVE_PASSWORD:", process.env.STRIIVE_PASSWORD ? "set" : "MISSING");
  console.log("");

  const startTime = Date.now();
  const listings = await scrapeStriive("https://supplier.striive.com/jobrequests/list");
  const elapsed = Date.now() - startTime;

  console.log(`\n=== Results ===`);
  console.log(`Duration: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Listings found: ${listings.length}`);

  if (listings.length > 0) {
    console.log("\nFirst listing:");
    console.log(JSON.stringify(listings[0], null, 2));

    // Check data quality
    const withDesc = listings.filter((l: any) => l.description?.length > 50);
    const withReqs = listings.filter((l: any) => l.requirements?.length > 0);
    const withWishes = listings.filter((l: any) => l.wishes?.length > 0);
    const withRate = listings.filter((l: any) => l.rateMax > 0);
    console.log(`\nData quality:`);
    console.log(`  With description (>50ch): ${withDesc.length}/${listings.length}`);
    console.log(`  With requirements: ${withReqs.length}/${listings.length}`);
    console.log(`  With wishes: ${withWishes.length}/${listings.length}`);
    console.log(`  With rateMax: ${withRate.length}/${listings.length}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
