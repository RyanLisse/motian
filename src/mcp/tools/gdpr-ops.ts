import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  eraseCandidateData,
  exportCandidateData,
  exportContactData,
  scrubContactData,
} from "../../services/gdpr.js";
import {
  importJobsFromActiveScrapers,
  reviewGdprRetention,
  runCandidateScoringBatch,
} from "../../services/operations-console.js";
import { runScrapePipeline } from "../../services/scrape-pipeline.js";
import { getAllConfigs } from "../../services/scrapers.js";

// ========== Schemas ==========

const exporteerKandidaatDataSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  requestedBy: z.string().optional().describe("Naam van de aanvrager (voor audit trail)"),
});

const wisKandidaatDataSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  requestedBy: z.string().optional().describe("Naam van de aanvrager (voor audit trail)"),
  bevestig: z
    .literal(true)
    .describe("Moet 'true' zijn om de verwijdering te bevestigen. Dit is onomkeerbaar!"),
});

const scrubContactGegevensSchema = z.object({
  identifier: z.string().min(1).describe("E-mailadres of naam van het contact om te anonimiseren"),
  requestedBy: z.string().optional().describe("Naam van de aanvrager (voor audit trail)"),
});

const exporteerContactDataSchema = z.object({
  identifier: z.string().min(1).describe("E-mailadres of naam van het contact"),
  requestedBy: z.string().optional().describe("Naam van de aanvrager (voor audit trail)"),
});

const importeerVacaturesBatchSchema = z.object({
  platform: z
    .string()
    .optional()
    .describe("Specifiek platform om te scrapen (optioneel, standaard alle actieve platforms)"),
});

const runScoringBatchSchema = z.object({});

const reviewGdprRetentieSchema = z.object({});

const triggerScraperSchema = z.object({
  platform: z
    .string()
    .min(1)
    .describe("Het platform om te scrapen (bijv. 'striive', 'flextender', 'opdrachtoverheid')"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "exporteer_kandidaat_data",
    description:
      "Exporteer alle data van een kandidaat (GDPR Art. 15 - Recht op inzage). Inclusief sollicitaties, interviews, berichten en matches.",
    inputSchema: zodToJsonSchema(exporteerKandidaatDataSchema, { $refStrategy: "none" }),
  },
  {
    name: "wis_kandidaat_data",
    description:
      "Verwijder alle data van een kandidaat permanent (GDPR Art. 17 - Recht op vergetelheid). Dit is ONOMKEERBAAR. Het veld 'bevestig' moet op true staan.",
    inputSchema: zodToJsonSchema(wisKandidaatDataSchema, { $refStrategy: "none" }),
  },
  {
    name: "scrub_contact_gegevens",
    description:
      "Anonimiseer contactgegevens (agent/recruiter) in vacatures die matchen op een e-mailadres of naam.",
    inputSchema: zodToJsonSchema(scrubContactGegevensSchema, { $refStrategy: "none" }),
  },
  {
    name: "exporteer_contact_data",
    description:
      "Exporteer alle vacatures waar een specifiek contact (agent/recruiter) aan gekoppeld is.",
    inputSchema: zodToJsonSchema(exporteerContactDataSchema, { $refStrategy: "none" }),
  },
  {
    name: "importeer_vacatures_batch",
    description:
      "Start een batch-import van vacatures vanuit alle actieve scrapers, of een specifiek platform.",
    inputSchema: zodToJsonSchema(importeerVacaturesBatchSchema, { $refStrategy: "none" }),
  },
  {
    name: "run_scoring_batch",
    description:
      "Draai de kandidaat-scoring batch: genereer matchscores voor alle actieve vacatures en kandidaten.",
    inputSchema: zodToJsonSchema(runScoringBatchSchema, { $refStrategy: "none" }),
  },
  {
    name: "review_gdpr_retentie",
    description:
      "Bekijk de GDPR-retentiestatus: hoeveel kandidaten hebben een verlopen bewaartermijn.",
    inputSchema: zodToJsonSchema(reviewGdprRetentieSchema, { $refStrategy: "none" }),
  },
  {
    name: "trigger_scraper",
    description: "Start een scraper voor een specifiek platform. Dit kan even duren (30s-2min).",
    inputSchema: zodToJsonSchema(triggerScraperSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  exporteer_kandidaat_data: async (raw) => {
    const { candidateId, requestedBy } = exporteerKandidaatDataSchema.parse(raw);
    const result = await exportCandidateData(candidateId, requestedBy);
    if (!result) return { error: "Kandidaat niet gevonden" };
    return result;
  },

  wis_kandidaat_data: async (raw) => {
    const { candidateId, requestedBy, bevestig } = wisKandidaatDataSchema.parse(raw);
    if (!bevestig) {
      return {
        error: "Bevestiging vereist: zet 'bevestig' op true om de verwijdering door te voeren.",
      };
    }
    return eraseCandidateData(candidateId, requestedBy);
  },

  scrub_contact_gegevens: async (raw) => {
    const { identifier, requestedBy } = scrubContactGegevensSchema.parse(raw);
    return scrubContactData(identifier, requestedBy);
  },

  exporteer_contact_data: async (raw) => {
    const { identifier, requestedBy } = exporteerContactDataSchema.parse(raw);
    return exportContactData(identifier, requestedBy);
  },

  importeer_vacatures_batch: async (raw) => {
    const { platform } = importeerVacaturesBatchSchema.parse(raw);
    return importJobsFromActiveScrapers(platform);
  },

  run_scoring_batch: async () => {
    return runCandidateScoringBatch();
  },

  review_gdpr_retentie: async () => {
    return reviewGdprRetention();
  },

  trigger_scraper: async (raw) => {
    const { platform } = triggerScraperSchema.parse(raw);
    const configs = await getAllConfigs();
    const config = configs.find((c) => c.platform === platform);
    if (!config) return { error: `Geen scraper configuratie gevonden voor ${platform}` };
    if (!config.isActive) return { error: `Scraper voor ${platform} is niet actief` };
    const result = await runScrapePipeline(platform, config.baseUrl);
    return {
      platform,
      jobsNew: result.jobsNew,
      duplicates: result.duplicates,
      errors: result.errors.length > 0 ? result.errors : undefined,
      status: result.errors.length === 0 ? "success" : "partial",
    };
  },
};
