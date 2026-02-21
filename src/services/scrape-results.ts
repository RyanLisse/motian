import { db } from "../db";
import { scrapeResults } from "../db/schema";
import { desc, eq } from "drizzle-orm";

// ========== Types ==========

export type ScrapeResult = typeof scrapeResults.$inferSelect;

export type GetHistoryOptions = {
  platform?: string;
  limit?: number;
};

// ========== Service Functions ==========

/** Scrape resultaten ophalen, optioneel gefilterd op platform en gelimiteerd */
export async function getHistory(
  opts: GetHistoryOptions = {},
): Promise<ScrapeResult[]> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const baseQuery = db.select().from(scrapeResults);
  const filtered = opts.platform
    ? baseQuery.where(eq(scrapeResults.platform, opts.platform))
    : baseQuery;

  return filtered.orderBy(desc(scrapeResults.runAt)).limit(limit);
}
