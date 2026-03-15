import type { z } from "zod";
import { stripHtml } from "../../packages/scrapers/src/strip-html";
import { db, jobs, sql } from "../db";
import { unifiedJobSchema } from "../schemas/job";
import { syncJobEscoSkills } from "./esco";

/** Permissive type for scraped data — Zod validates at runtime via safeParse */
export type RawScrapedListing = Record<string, unknown>;

type JobDerivedFieldSource = Pick<
  z.output<typeof unifiedJobSchema>,
  "title" | "company" | "endClient" | "location" | "province" | "description"
>;

/** Max length per dedupe column to stay within PostgreSQL B-tree row limit (2704 bytes). */
const DEDUPE_MAX_CHARS = 500;

function normalizeDedupePart(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DEDUPE_MAX_CHARS);
}

function normalizeSearchPart(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
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
  const validItems: Array<{
    parsed: z.output<typeof unifiedJobSchema>;
    raw: Record<string, unknown>;
  }> = [];
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
    const BATCH_SIZE = 50;
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      const batch = validItems.slice(i, i + BATCH_SIZE);
      try {
        const result = await db
          .insert(jobs)
          .values(
            batch.map((item) => ({
              ...item.parsed,
              ...deriveJobSearchFields(item.parsed),
              platform,
              rawPayload: item.raw,
            })),
          )
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
        const inserted = result.filter((r) => r.isNew).length;
        const updated = result.length - inserted;
        jobsNew += inserted;
        duplicates += updated;

        // Parallel ESCO sync with concurrency cap to avoid exhausting Neon connection pool
        const ESCO_CONCURRENCY = 5;
        for (let j = 0; j < result.length; j += ESCO_CONCURRENCY) {
          const chunk = result.slice(j, j + ESCO_CONCURRENCY);
          const settled = await Promise.allSettled(
            chunk.map(async (row) => {
              const item = batch.find((batchItem) => batchItem.parsed.externalId === row.externalId);
              if (!item) return;

              await syncJobEscoSkills({
                jobId: row.id,
                requirements: item.parsed.requirements,
                wishes: item.parsed.wishes,
                competences: item.parsed.competences,
              });
            }),
          );
          const failed = settled.filter((s) => s.status === "rejected").length;
          if (failed > 0) {
            console.warn(`[normalize] ${failed}/${chunk.length} ESCO syncs failed in chunk`);
          }
        }
      } catch (err) {
        errors.push(`DB batch ${i}-${i + batch.length}: ${String(err)}`);
      }
    }
  }

  return { jobsNew, duplicates, errors, jobIds: allJobIds };
}
