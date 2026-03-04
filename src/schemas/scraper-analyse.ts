import { z } from "zod";

export const scraperAnalyseQuerySchema = z.object({
  startDate: z.string().date().optional().describe("Begin datum (ISO format, e.g. 2026-02-01)"),
  endDate: z.string().date().optional().describe("Eind datum (ISO format, e.g. 2026-03-04)"),
  platform: z.string().min(1).optional().describe("Filter op platform naam"),
  groupBy: z.enum(["day", "week"]).default("day").describe("Groepering: per dag of per week"),
});

export type ScraperAnalyseQuery = z.infer<typeof scraperAnalyseQuerySchema>;
