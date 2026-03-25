import { db } from "../src/db";
import { embedJobsBatch } from "../src/services/embedding";

async function main() {
  console.log("🚀 Starting embedding backfill...");

  // Calculate remaining
  const [{ count }] = (await db.execute(
    import("drizzle-orm").then(
      (m) => m.sql`SELECT count(*) FROM jobs WHERE embedding IS NULL AND deleted_at IS NULL`,
    ),
  )) as unknown as [{ count: string }];

  console.log(`📊 Found ~${count} jobs without embeddings.`);

  const BATCH_SIZE = 500;
  let totalEmbedded = 0;
  let totalSkipped = 0;

  while (true) {
    console.log(`\n⏳ Processing next batch of ${BATCH_SIZE}...`);
    const result = await embedJobsBatch({ limit: BATCH_SIZE });

    if (result.embedded === 0 && result.skipped === 0 && result.errors.length === 0) {
      console.log("✅ No more jobs to process.");
      break;
    }

    totalEmbedded += result.embedded;
    totalSkipped += result.skipped;

    console.log(`✅ Batch complete: ${result.embedded} embedded, ${result.skipped} skipped.`);
    if (result.errors.length > 0) {
      console.error(`⚠️ ${result.errors.length} errors encountered in this batch.`);
      console.error(result.errors.slice(0, 5).join("\n"));
    }

    const progress = ((totalEmbedded + totalSkipped) / Number(count)) * 100;
    console.log(`📈 Progress: ${progress.toFixed(2)}% (${totalEmbedded} jobs embedded)`);

    // Safety break if we aren't making progress
    if (result.embedded === 0 && result.errors.length > 0) {
      console.error("🛑 Stopping early due to lack of progress and persistent errors.");
      break;
    }

    // Throttle slightly to respect API limits if needed
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n🏁 Backfill operation finished.");
  console.log(`🏆 Total Embedded: ${totalEmbedded}`);
  console.log(`⏭️ Total Skipped: ${totalSkipped}`);
}

main().catch((err) => {
  console.error("❌ Fatal error in backfill script:", err);
  process.exit(1);
});
