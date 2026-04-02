import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus";
import {
  createApplication,
  getApplicationByJobAndCandidate,
  updateApplicationStage,
} from "../../services/applications";
import { autoMatchCandidateToJobs } from "../../services/auto-matching";

// ========== Schemas ==========

const batchMaakSollicitatiesSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).describe("Lijst van kandidaat-UUIDs"),
  jobIds: z.array(z.string().uuid()).min(1).describe("Lijst van vacature-UUIDs"),
  source: z.string().optional().describe("Bron van de sollicitaties (standaard 'batch_api')"),
  stage: z.enum(["new", "screening"]).optional().describe("Initiële fase (standaard 'new')"),
});

const batchMatchKandidatenSchema = z.object({
  jobId: z.string().uuid().describe("UUID van de vacature om tegen te matchen"),
  candidateIds: z
    .array(z.string().uuid())
    .min(1)
    .describe("Lijst van kandidaat-UUIDs om te matchen"),
  topN: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Maximum aantal matches per kandidaat (standaard 3)"),
});

const batchUpdateFaseSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).describe("Lijst van sollicitatie-UUIDs"),
  stage: z
    .enum(["new", "screening", "interview", "offer", "hired", "rejected"])
    .describe("Nieuwe fase voor alle sollicitaties"),
  notes: z.string().optional().describe("Notitie bij alle fase-wijzigingen"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "batch_maak_sollicitaties",
    description:
      "Maak meerdere sollicitaties tegelijk aan. Voor elk (kandidaat, vacature) paar wordt een sollicitatie aangemaakt. Duplicaten worden automatisch overgeslagen.",
    inputSchema: zodToJsonSchema(batchMaakSollicitatiesSchema, { $refStrategy: "none" }),
  },
  {
    name: "batch_match_kandidaten",
    description:
      "Match meerdere kandidaten tegen een vacature via auto-matching. Voert de volledige matching-pipeline uit (embedding, scoring, deep match) voor elke kandidaat.",
    inputSchema: zodToJsonSchema(batchMatchKandidatenSchema, { $refStrategy: "none" }),
  },
  {
    name: "batch_update_fase",
    description:
      "Werk de fase van meerdere sollicitaties tegelijk bij. Handig voor bulk-verwerking van kandidaten in de pipeline.",
    inputSchema: zodToJsonSchema(batchUpdateFaseSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  batch_maak_sollicitaties: async (raw) => {
    const { candidateIds, jobIds, source, stage } = batchMaakSollicitatiesSchema.parse(raw);
    const effectiveSource = source ?? "batch_api";
    const effectiveStage = stage ?? "new";

    let created = 0;
    let skipped = 0;
    const errors: Array<{ candidateId: string; jobId: string; error: string }> = [];

    for (const candidateId of candidateIds) {
      for (const jobId of jobIds) {
        try {
          const existing = await getApplicationByJobAndCandidate(jobId, candidateId);
          if (existing) {
            skipped++;
            continue;
          }

          const application = await createApplication({
            jobId,
            candidateId,
            source: effectiveSource,
            stage: effectiveStage,
          });
          created++;
          publish("application:created", { id: (application as { id: string }).id });
        } catch (err) {
          errors.push({
            candidateId,
            jobId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (created > 0) {
      revalidatePath("/pipeline");
      revalidatePath("/overzicht");
    }

    return {
      total: candidateIds.length * jobIds.length,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  batch_match_kandidaten: async (raw) => {
    const { jobId, candidateIds, topN } = batchMatchKandidatenSchema.parse(raw);
    const effectiveTopN = topN ?? 3;

    const results: Array<{
      candidateId: string;
      matchCount: number;
      topScore: number | null;
      error?: string;
    }> = [];

    for (const candidateId of candidateIds) {
      try {
        const matches = await autoMatchCandidateToJobs(candidateId, effectiveTopN);
        const jobMatches = matches.filter((m) => m.jobId === jobId);
        for (const m of jobMatches) {
          publish("match:created", { id: m.matchId, candidateId: m.candidateId, jobId: m.jobId });
        }
        results.push({
          candidateId,
          matchCount: jobMatches.length,
          topScore:
            jobMatches.length > 0
              ? Math.max(...jobMatches.map((m) => m.structuredResult?.overallScore ?? m.quickScore))
              : null,
        });
      } catch (err) {
        results.push({
          candidateId,
          matchCount: 0,
          topScore: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (results.some((r) => r.matchCount > 0)) {
      revalidatePath("/kandidaten");
      revalidatePath("/vacatures");
      revalidatePath("/pipeline");
      revalidatePath("/overzicht");
    }

    return {
      jobId,
      totalCandidates: candidateIds.length,
      matched: results.filter((r) => r.matchCount > 0).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  },

  batch_update_fase: async (raw) => {
    const { applicationIds, stage, notes } = batchUpdateFaseSchema.parse(raw);

    let updated = 0;
    let failed = 0;
    const errors: Array<{ applicationId: string; error: string }> = [];

    for (const applicationId of applicationIds) {
      try {
        const result = await updateApplicationStage(applicationId, stage, notes);
        if (result) {
          updated++;
          publish("application:stage_changed", { id: applicationId, stage });
        } else {
          failed++;
          errors.push({
            applicationId,
            error: "Sollicitatie niet gevonden of ongeldige fase",
          });
        }
      } catch (err) {
        failed++;
        errors.push({
          applicationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (updated > 0) {
      revalidatePath("/pipeline");
    }

    return {
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};
