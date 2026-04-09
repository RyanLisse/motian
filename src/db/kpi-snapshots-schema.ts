import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Daily KPI snapshots — one row per day capturing recruitment funnel metrics.
 * Created as a separate schema file to avoid touching the high-risk main schema.
 */
export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  date: date("date").notNull(),
  openVacatures: integer("open_vacatures").notNull(),
  newCandidates: integer("new_candidates").notNull(),
  pipelineTotal: integer("pipeline_total").notNull(),
  matchesCreated: integer("matches_created").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type NewKpiSnapshot = typeof kpiSnapshots.$inferInsert;
