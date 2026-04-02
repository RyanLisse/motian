import { isEscoCatalogAvailable, syncJobEscoSkills } from "@motian/esco";
import type { z } from "zod";
import { stripHtml } from "../../packages/scrapers/src/strip-html";
import { db, jobs, sql } from "../db";
import { unifiedJobSchema } from "../schemas/job";
import { upsertJobsByIds } from "./search-index/typesense-sync";

/** Permissive type for scraped data — Zod validates at runtime via safeParse */
export type RawScrapedListing = Record<string, unknown>;

type JobDerivedFieldSource = Pick<
  z.output<typeof unifiedJobSchema>,
  "title" | "company" | "endClient" | "location" | "province" | "description"
>;

export type NormalizedJobItem = {
  parsed: z.output<typeof unifiedJobSchema>;
  raw: Record<string, unknown>;
};

export type PreparedJobInsert = {
  item: NormalizedJobItem;
  row: JobInsertRow;
};

export type PreparedJobBatch = {
  items: PreparedJobInsert[];
  startIndex: number;
  endIndex: number;
};

/**
 * Max **byte** budget per dedupe column for the B-tree index.
 * Index row limit = 2704 bytes. Index has 3 text cols + scraped_at (8B) + id (16B) + ~80B tuple overhead.
 * Text budget = (2704 - 104) / 3 ≈ 866 bytes per column. We cap at 800B for safety.
 */
/**
 * 2704 byte B-tree limit - 16 (UUID) - 8 (timestamp) - 80 (tuple header + ItemIds)
 * = 2600 usable / 3 columns = 866. We use 700 for safety margin.
 */
const DEDUPE_MAX_BYTES = 700;
const MAX_INSERT_ROWS = 50;
const MAX_INSERT_BYTES = 8 * 1024 * 1024;
type JobInsertRow = typeof jobs.$inferInsert;

function normalizeDedupePart(value: string | null | undefined) {
  let result = (value ?? "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  // Truncate by byte length (UTF-8) to guarantee B-tree index row fits
  const encoder = new TextEncoder();
  if (encoder.encode(result).byteLength > DEDUPE_MAX_BYTES) {
    // Binary search for max char count that fits in byte budget
    let lo = 0;
    let hi = result.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (encoder.encode(result.slice(0, mid)).byteLength <= DEDUPE_MAX_BYTES) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    result = result.slice(0, lo);
  }

  return result;
}

function normalizeSearchPart(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function prepareJobInsertRow(item: NormalizedJobItem, platform: string): JobInsertRow {
  return {
    ...item.parsed,
    ...deriveJobSearchFields(item.parsed),
    platform,
    rawPayload: item.raw,
  };
}

export function chunkJobInsertBatches(
  validItems: NormalizedJobItem[],
  platform: string,
  options?: { maxRows?: number; maxBytes?: number },
): PreparedJobBatch[] {
  const maxRows = options?.maxRows ?? MAX_INSERT_ROWS;
  const maxBytes = options?.maxBytes ?? MAX_INSERT_BYTES;
  const batches: PreparedJobBatch[] = [];

  let currentItems: PreparedJobInsert[] = [];
  let currentBytes = 0;
  let currentStartIndex = 0;
  let currentEndIndex = 0;

  for (let index = 0; index < validItems.length; index += 1) {
    const item = validItems[index];
    const row = prepareJobInsertRow(item, platform);
    const estimatedBytes = Buffer.byteLength(JSON.stringify(row), "utf8");
    const wouldExceedRowLimit = currentItems.length >= maxRows;
    const wouldExceedByteLimit =
      currentItems.length > 0 && currentBytes + estimatedBytes > maxBytes;

    if (currentItems.length > 0 && (wouldExceedRowLimit || wouldExceedByteLimit)) {
      batches.push({
        items: currentItems,
        startIndex: currentStartIndex,
        endIndex: currentEndIndex,
      });
      currentItems = [];
      currentBytes = 0;
    }

    if (currentItems.length === 0) {
      currentStartIndex = index;
    }

    currentItems.push({ item, row });
    currentBytes += estimatedBytes;
    currentEndIndex = index;
  }

  if (currentItems.length > 0) {
    batches.push({
      items: currentItems,
      startIndex: currentStartIndex,
      endIndex: currentEndIndex,
    });
  }

  return batches;
}

export function deriveJobSearchFields(job: JobDerivedFieldSource) {
  return {
    dedupeTitleNormalized: normalizeDedupePart(job.title),
    dedupeClientNormalized: normalizeDedupePart(job.endClient ?? job.company),
    dedupeLocationNormalized: normalizeDedupePart(job.province ?? job.location),
    searchText: [job.title, job.company, job.description, job.location, job.province]
      .map((value) => normalizeSearchPart(value))
      .filter(Boolean)
      .join(" "),
  };
}

export async function normalizeAndSaveJobs(
  platform: string,
  listings: Record<string, unknown>[],
): Promise<{ jobsNew: number; duplicates: number; errors: string[]; jobIds: string[] }> {
  let jobsNew = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const allJobIds: string[] = [];

  // Stap 1: Valideer alle listings
  const validItems: NormalizedJobItem[] = [];
  const HOURS_MAX = 168;
  for (const raw of listings) {
    // Voor-processing voor veiligheid VÓÓR validatie (cap uren/week op 168)
    const preProcessed = { ...raw };
    if (preProcessed.hoursPerWeek != null) {
      const n = Number(preProcessed.hoursPerWeek);
      if (Number.isFinite(n)) {
        preProcessed.hoursPerWeek = Math.min(HOURS_MAX, Math.max(1, Math.round(n)));
      }
    }
    if (preProcessed.minHoursPerWeek != null) {
      const n = Number(preProcessed.minHoursPerWeek);
      if (Number.isFinite(n)) {
        preProcessed.minHoursPerWeek = Math.min(HOURS_MAX, Math.max(1, Math.round(n)));
      }
    }

    // Null out rates that are clearly not hourly (monthly/annual salaries).
    // Platforms like NVB mix hourly and monthly/annual in the same salary field
    // without indicating the period. Hourly rates for Dutch freelance/interim are
    // typically €30-300/hour. Values >500 are almost certainly monthly (€3,500) or
    // annual (€80,000). The raw value is preserved in rawPayload for reference.
    const MAX_HOURLY_RATE = 500;
    if (typeof preProcessed.rateMax === "number" && preProcessed.rateMax > MAX_HOURLY_RATE) {
      preProcessed.rateMin = undefined;
      preProcessed.rateMax = undefined;
    }
    if (typeof preProcessed.rateMin === "number" && preProcessed.rateMin > MAX_HOURLY_RATE) {
      preProcessed.rateMin = undefined;
    }

    const parsed = unifiedJobSchema.safeParse(preProcessed);
    if (!parsed.success) {
      const externalId = (raw as { externalId?: string }).externalId ?? "?";
      console.warn(
        `[normalize] Validatiefout voor ${platform} externalId=${externalId}: ${parsed.error.message}`,
      );
      errors.push(`Validation: ${parsed.error.message}`);
    } else {
      validItems.push({
        parsed: {
          ...parsed.data,
          title: stripHtml(parsed.data.title),
          company: parsed.data.company ? stripHtml(parsed.data.company) : undefined,
          endClient: parsed.data.endClient ? stripHtml(parsed.data.endClient) : undefined,
        },
        raw,
      });
    }
  }

  // Stap 2: Batch upsert
  if (validItems.length > 0) {
    const batches = chunkJobInsertBatches(validItems, platform);
    for (const batch of batches) {
      try {
        const result = await db
          .insert(jobs)
          .values(batch.items.map(({ row }) => row))
          .onConflictDoUpdate({
            target: [jobs.platform, jobs.externalId],
            set: {
              title: sql`excluded.title`,
              company: sql`excluded.company`,
              endClient: sql`excluded.end_client`,
              contractLabel: sql`excluded.contract_label`,
              location: sql`excluded.location`,
              province: sql`excluded.province`,
              description: sql`excluded.description`,
              dedupeTitleNormalized: sql`excluded.dedupe_title_normalized`,
              dedupeClientNormalized: sql`excluded.dedupe_client_normalized`,
              dedupeLocationNormalized: sql`excluded.dedupe_location_normalized`,
              searchText: sql`excluded.search_text`,
              status: sql`excluded.status`,
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
              hoursPerWeek: sql`excluded.hours_per_week`,
              minHoursPerWeek: sql`excluded.min_hours_per_week`,
              extensionPossible: sql`excluded.extension_possible`,
              countryCode: sql`excluded.country_code`,
              remunerationType: sql`excluded.remuneration_type`,
              workExperienceYears: sql`excluded.work_experience_years`,
              numberOfViews: sql`excluded.number_of_views`,
              attachments: sql`excluded.attachments`,
              questions: sql`excluded.questions`,
              languages: sql`excluded.languages`,
              descriptionSummary: sql`excluded.description_summary`,
              faqAnswers: sql`excluded.faq_answers`,
              agentContact: sql`excluded.agent_contact`,
              recruiterContact: sql`excluded.recruiter_contact`,
              latitude: sql`excluded.latitude`,
              longitude: sql`excluded.longitude`,
              postcode: sql`excluded.postcode`,
              companyLogoUrl: sql`excluded.company_logo_url`,
              educationLevel: sql`excluded.education_level`,
              durationMonths: sql`excluded.duration_months`,
              sourceUrl: sql`excluded.source_url`,
              sourcePlatform: sql`excluded.source_platform`,
              categories: sql`excluded.categories`,
              companyAddress: sql`excluded.company_address`,
              scrapedAt: sql`now()`,
              archivedAt: sql`case
                when excluded.status = 'archived' then coalesce(${jobs.archivedAt}, ${jobs.deletedAt}, now())
                else null
              end`,
              deletedAt: sql`null`,
              rawPayload: sql`excluded.raw_payload`,
            },
          })
          .returning({
            id: jobs.id,
            externalId: jobs.externalId,
            isNew: sql<boolean>`xmax = 0`.as("is_new"),
          });

        for (const row of result) {
          allJobIds.push(row.id);
        }

        // Typesense sync is non-fatal — don't let it block ESCO processing
        upsertJobsByIds(result.map((row) => row.id)).catch((err) =>
          console.error("[Normalize] Typesense sync error:", err),
        );

        const inserted = result.filter((r) => r.isNew).length;
        const updated = result.length - inserted;
        jobsNew += inserted;
        duplicates += updated;

        const escoCatalogAvailable = await isEscoCatalogAvailable();
        if (!escoCatalogAvailable) {
          continue;
        }

        // Parallel ESCO sync with concurrency cap to avoid exhausting Neon connection pool
        const ESCO_CONCURRENCY = 5;
        for (let j = 0; j < result.length; j += ESCO_CONCURRENCY) {
          const chunk = result.slice(j, j + ESCO_CONCURRENCY);
          const settled = await Promise.allSettled(
            chunk.map(async (row) => {
              const item = batch.items.find(
                (batchItem) => batchItem.item.parsed.externalId === row.externalId,
              );
              if (!item) return;

              await syncJobEscoSkills({
                jobId: row.id,
                requirements: item.item.parsed.requirements,
                wishes: item.item.parsed.wishes,
                competences: item.item.parsed.competences,
              });
            }),
          );
          const failed = settled.filter((s) => s.status === "rejected").length;
          if (failed > 0) {
            console.warn(`[normalize] ${failed}/${chunk.length} ESCO syncs failed in chunk`);
          }
        }
      } catch (err) {
        errors.push(`DB batch ${batch.startIndex}-${batch.endIndex}: ${String(err)}`);
      }
    }
  }

  return { jobsNew, duplicates, errors, jobIds: allJobIds };
}
