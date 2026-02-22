import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { jobs } from "../../src/db/schema";
import { sql, eq } from "drizzle-orm";
import { unifiedJobSchema } from "../../src/schemas/job";

export const config = {
  name: "NormalizeJobs",
  description:
    "Normaliseert en slaat jobs op met deduplicatie, emits scrape result metrics",
  triggers: [
    {
      type: "queue",
      topic: "jobs.normalize",
      input: z.object({
        platform: z.string(),
        listings: z.array(z.any()),
        provider: z.string().optional(),
        costCredits: z.number().optional(),
      }),
    },
  ],
  enqueues: [{ topic: "scrape.completed" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as {
    platform: string;
    listings: any[];
    provider?: string;
    costCredits?: number;
    correlationId?: string;
  };
  const correlationId = input.correlationId ?? "unknown";
  const startTime = Date.now();
  let jobsNew = 0;
  let duplicates = 0;
  const errors: string[] = [];

  // Stap 1: Valideer alle listings
  const validItems: Array<{ parsed: any; raw: any }> = [];
  for (const raw of input.listings) {
    const parsed = unifiedJobSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Validation: ${parsed.error.message}`);
    } else {
      validItems.push({ parsed: parsed.data, raw });
    }
  }

  // Stap 2: Batch upsert
  if (validItems.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      const batch = validItems.slice(i, i + BATCH_SIZE);
      try {
        // Use xmax system column to distinguish inserts from updates
        // xmax = 0 means freshly inserted, xmax > 0 means updated (duplicate)
        const result = await db
          .insert(jobs)
          .values(
            batch.map((item) => ({
              ...item.parsed,
              platform: input.platform,
              rawPayload: item.raw,
            })),
          )
          .onConflictDoUpdate({
            target: [jobs.platform, jobs.externalId],
            set: {
              title: sql`excluded.title`,
              company: sql`excluded.company`,
              contractLabel: sql`excluded.contract_label`,
              location: sql`excluded.location`,
              province: sql`excluded.province`,
              description: sql`excluded.description`,
              clientReferenceCode: sql`excluded.client_reference_code`,
              rateMin: sql`excluded.rate_min`,
              rateMax: sql`excluded.rate_max`,
              currency: sql`excluded.currency`,
              positionsAvailable: sql`excluded.positions_available`,
              startDate: sql`excluded.start_date`,
              endDate: sql`excluded.end_date`,
              applicationDeadline: sql`excluded.application_deadline`,
              postedAt: sql`excluded.posted_at`,
              contractType: sql`excluded.contract_type`,
              workArrangement: sql`excluded.work_arrangement`,
              allowsSubcontracting: sql`excluded.allows_subcontracting`,
              requirements: sql`excluded.requirements`,
              wishes: sql`excluded.wishes`,
              competences: sql`excluded.competences`,
              conditions: sql`excluded.conditions`,
              scrapedAt: sql`now()`,
              deletedAt: sql`null`,
              rawPayload: sql`excluded.raw_payload`,
            },
          })
          .returning({
            id: jobs.id,
            isNew: sql<boolean>`xmax = 0`.as("is_new"),
          });

        const inserted = result.filter((r) => r.isNew).length;
        const updated = result.length - inserted;
        jobsNew += inserted;
        duplicates += updated;
      } catch (err) {
        errors.push(`DB batch ${i}-${i + batch.length}: ${String(err)}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const status =
    errors.length === 0 ? "success" : jobsNew > 0 ? "partial" : "failed";

  await enqueue({
    topic: "scrape.completed",
    data: {
      platform: input.platform,
      jobsFound: input.listings.length,
      jobsNew,
      duplicates,
      durationMs,
      provider: input.provider,
      costCredits: input.costCredits,
      status,
      errors,
      correlationId,
    },
  });

  logger.info(
    `Normalize klaar [${correlationId}]: ${jobsNew} nieuw, ${duplicates} dupes, ${errors.length} fouten (${durationMs}ms)`,
  );
};
