import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { jobs } from "../db/schema";

// ========== Schema ==========

const CATEGORY_OPTIONS = [
  "ICT",
  "Finance",
  "Juridisch",
  "HR",
  "Marketing",
  "Inkoop",
  "Logistiek",
  "Techniek",
  "Bouw",
  "Zorg",
  "Onderwijs",
  "Overheid",
  "Consultancy",
  "Data & Analytics",
  "Projectmanagement",
  "Communicatie",
] as const;

const enrichmentOutputSchema = z.object({
  educationLevel: z.string().nullable().describe("Opleidingsniveau: HBO, WO, MBO, of null"),
  workExperienceYears: z.number().int().nullable().describe("Jaren werkervaring, of null"),
  workArrangement: z
    .enum(["hybride", "remote", "op_locatie"])
    .nullable()
    .describe("Werklocatie: hybride, remote, op_locatie, of null"),
  languages: z.array(z.string()).describe("Talen als ISO-codes: NL, EN, DE, FR"),
  durationMonths: z.number().int().nullable().describe("Looptijd in maanden, of null"),
  extensionPossible: z.boolean().nullable().describe("Verlenging mogelijk: true/false/null"),
  descriptionSummary: z.object({
    nl: z.string().describe("Samenvatting in het Nederlands, max 2 zinnen"),
    en: z.string().describe("Summary in English, max 2 sentences"),
  }),
  categories: z.array(z.string()).describe("Relevante categorieën uit de lijst"),
});

export type EnrichmentOutput = z.infer<typeof enrichmentOutputSchema>;

// ========== Retry Helper ==========

async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 1000 }: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isLast = attempt === maxAttempts;
      const status =
        err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      const isRetryable = status === 429 || status === 500 || status === 503 || status === 0;

      if (isLast || !isRetryable) throw err;

      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 500;
      console.log(
        `[AI Enrichment] Retry ${attempt}/${maxAttempts} after ${Math.round(delay)}ms (status: ${status})`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

// ========== Single Job Enrichment ==========

const SYSTEM_PROMPT = `Je bent een Nederlandse recruitment data-extractie assistent.
Analyseer de opdrachtomschrijving en extraheer gestructureerde data.

Regels:
- Geef null als informatie NIET in de tekst staat. Gok NIET.
- Opleidingsniveau: gebruik "MBO", "HBO", "WO", of null.
- Talen: gebruik ISO-codes (NL, EN, DE, FR, etc.). Als de tekst in het Nederlands is, neem minimaal "NL" op.
- Werklocatie: "hybride", "remote", of "op_locatie". Alleen als expliciet vermeld.
- Categorieën: kies uit ${CATEGORY_OPTIONS.join(", ")}.
- Samenvatting: bondig, max 2 zinnen per taal. Focus op de kern van de opdracht.`;

export async function enrichJobWithAI(job: {
  title: string;
  description: string | null;
  conditions?: unknown;
  requirements?: unknown;
}): Promise<EnrichmentOutput | null> {
  if (!job.description || job.description.length < 50) return null;

  const contextParts = [`Titel: ${job.title}`, `Omschrijving:\n${job.description}`];

  if (job.conditions && Array.isArray(job.conditions) && job.conditions.length > 0) {
    contextParts.push(`Voorwaarden: ${JSON.stringify(job.conditions)}`);
  }
  if (job.requirements && Array.isArray(job.requirements) && job.requirements.length > 0) {
    contextParts.push(`Eisen: ${JSON.stringify(job.requirements)}`);
  }

  const { object } = await withRetry(() =>
    generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: enrichmentOutputSchema,
      system: SYSTEM_PROMPT,
      prompt: contextParts.join("\n\n"),
      providerOptions: { google: { structuredOutputs: true } },
    }),
  );

  return object;
}

// ========== Batch Enrichment ==========

type EnrichmentUpdate = {
  educationLevel?: string;
  workExperienceYears?: number;
  workArrangement?: string;
  languages?: string[];
  durationMonths?: number;
  extensionPossible?: boolean;
  descriptionSummary?: { nl: string; en: string };
  categories?: string[];
};

export async function enrichJobsBatch(opts: {
  platform?: string;
  limit?: number;
}): Promise<{ enriched: number; skipped: number; errors: string[] }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  let enriched = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Query jobs not yet enriched (descriptionSummary IS NULL as proxy)
  const conditions = [isNull(jobs.deletedAt), isNull(jobs.descriptionSummary)];
  if (opts.platform) conditions.push(eq(jobs.platform, opts.platform));

  const unenriched = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      conditions: jobs.conditions,
      requirements: jobs.requirements,
      educationLevel: jobs.educationLevel,
      workExperienceYears: jobs.workExperienceYears,
      workArrangement: jobs.workArrangement,
      languages: jobs.languages,
      durationMonths: jobs.durationMonths,
      extensionPossible: jobs.extensionPossible,
      categories: jobs.categories,
    })
    .from(jobs)
    .where(and(...conditions))
    .limit(limit);

  console.log(`[AI Enrichment] Found ${unenriched.length} jobs to enrich`);

  for (const job of unenriched) {
    try {
      const result = await enrichJobWithAI({
        title: job.title,
        description: job.description,
        conditions: job.conditions,
        requirements: job.requirements,
      });

      if (!result) {
        skipped++;
        continue;
      }

      // Only write fields that are currently NULL in DB (never overwrite scraper data)
      const updates: EnrichmentUpdate = {};

      if (job.educationLevel == null && result.educationLevel != null) {
        updates.educationLevel = result.educationLevel;
      }
      if (job.workExperienceYears == null && result.workExperienceYears != null) {
        updates.workExperienceYears = result.workExperienceYears;
      }
      if (job.workArrangement == null && result.workArrangement != null) {
        updates.workArrangement = result.workArrangement;
      }
      if (
        (!job.languages || (Array.isArray(job.languages) && job.languages.length === 0)) &&
        result.languages.length > 0
      ) {
        updates.languages = result.languages;
      }
      if (job.durationMonths == null && result.durationMonths != null) {
        updates.durationMonths = result.durationMonths;
      }
      if (job.extensionPossible == null && result.extensionPossible != null) {
        updates.extensionPossible = result.extensionPossible;
      }
      if (
        (!job.categories || (Array.isArray(job.categories) && job.categories.length === 0)) &&
        result.categories.length > 0
      ) {
        updates.categories = result.categories;
      }

      // Always write descriptionSummary (it's our "enriched" marker)
      updates.descriptionSummary = result.descriptionSummary;

      if (Object.keys(updates).length > 0) {
        await db.update(jobs).set(updates).where(eq(jobs.id, job.id));
        enriched++;

        // Generate embedding after enrichment (non-fatal)
        try {
          const { embedJob } = await import("./embedding");
          await withRetry(() => embedJob(job.id), { maxAttempts: 2 });
        } catch (embErr) {
          console.error(`[AI Enrichment] Embedding error for ${job.id}:`, embErr);
        }
      } else {
        skipped++;
      }

      // Rate limit: 100ms between calls
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Job ${job.id}: ${msg}`);
      console.error(`[AI Enrichment] Error enriching ${job.id}:`, msg);
    }
  }

  console.log(
    `[AI Enrichment] Done: ${enriched} enriched, ${skipped} skipped, ${errors.length} errors`,
  );
  return { enriched, skipped, errors };
}
