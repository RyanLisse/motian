import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Daily platform status snapshots — one row per platform per day.
 * Tracks availability and optional engagement metrics (views, applications).
 * Created as a separate schema file to avoid touching the high-risk main schema.
 */
export const platformDailyStats = pgTable("platform_daily_stats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  date: date("date").notNull(),
  platform: text("platform").notNull(),
  available: boolean("available").notNull(),
  views: integer("views"),
  applications: integer("applications"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlatformDailyStat = typeof platformDailyStats.$inferSelect;
export type NewPlatformDailyStat = typeof platformDailyStats.$inferInsert;
