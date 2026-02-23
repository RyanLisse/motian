import { sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import { jobs } from "../db/schema";
import { unifiedJobSchema } from "../schemas/job";

export type RawScrapedListing = z.input<typeof unifiedJobSchema> & Record<string, unknown>;

export async function normalizeAndSaveJobs(
  platform: string,
  listings: RawScrapedListing[],
): Promise<{ jobsNew: number; duplicates: number; errors: string[] }> {
  let jobsNew = 0;
  let duplicates = 0;
  const errors: string[] = [];

  // Stap 1: Valideer alle listings
  const validItems: Array<{
    parsed: z.output<typeof unifiedJobSchema>;
    raw: RawScrapedListing;
  }> = [];
  for (const raw of listings) {
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
        const result = await db
          .insert(jobs)
          .values(
            batch.map((item) => ({
              ...item.parsed,
              platform,
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

  return { jobsNew, duplicates, errors };
}
