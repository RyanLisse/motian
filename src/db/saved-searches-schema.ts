import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Saved search filter configurations.
 *
 * This table is defined separately from the main schema.ts to avoid modifying
 * the high-risk core schema file. It should be included when generating
 * migrations via `pnpm db:generate`.
 */
export const savedSearches = pgTable("saved_searches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
