import { tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { PLATFORMS } from "@/src/lib/helpers";
import {
  importJobsFromActiveScrapers,
  reviewGdprRetention,
  runCandidateScoringBatch,
} from "@/src/services/operations-console";

export const importeerOpdrachtenBatch = tool({
  description:
    "Importeer opdrachten door actieve scrapers uit te voeren. Zonder platform draait dit op alle actieve platforms.",
  inputSchema: z.object({
    platform: z.enum(PLATFORMS).optional().describe("Optioneel: run alleen voor één platform"),
  }),
  execute: async ({ platform }) => {
    const summary = await importJobsFromActiveScrapers(platform);

    revalidateTag("jobs", "default");
    revalidateTag("scrape-results", "default");
    revalidateTag("scrapers", "default");

    return summary;
  },
});

export const runKandidaatScoringBatch = tool({
  description:
    "Run kandidaat scoring in batch over actieve opdrachten. Maakt/actualiseert top matches per opdracht.",
  inputSchema: z.object({
    maxJobs: z.number().int().positive().max(500).optional().default(200),
    limitPerJob: z.number().int().positive().max(50).optional().default(10),
  }),
  execute: async ({ maxJobs, limitPerJob }) => {
    const summary = await runCandidateScoringBatch({ maxJobs, limitPerJob });

    revalidateTag("jobs", "default");
    revalidateTag("matches", "default");
    revalidateTag("candidates", "default");

    return summary;
  },
});

export const reviewGdprRetentie = tool({
  description: "Review GDPR retentie: tel verlopen kandidaten en geef de oudste retentiedatum.",
  inputSchema: z.object({}),
  execute: async () => {
    const summary = await reviewGdprRetention();
    return {
      ...summary,
      oldestRetentionDateIso: summary.oldestRetentionDate?.toISOString() ?? null,
    };
  },
});
