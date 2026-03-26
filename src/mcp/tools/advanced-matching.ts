import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getCandidateById } from "../../services/candidates";
import { findSimilarJobs } from "../../services/embedding";
import { getJobById } from "../../services/jobs";
import { extractRequirements } from "../../services/requirement-extraction";
import { runStructuredMatch } from "../../services/structured-matching";

// ========== Schemas ==========

const semantischZoekenSchema = z.object({
  query: z.string().min(1).describe("Beschrijving van het profiel of de opdracht om op te matchen"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum aantal resultaten (standaard 10)"),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimale similarity score 0-1 (standaard 0.5)"),
});

const gestructureerdeMatchSchema = z.object({
  jobId: z.string().uuid().describe("UUID van de vacature"),
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "semantisch_zoeken",
    description:
      "Zoek opdrachten die semantisch vergelijkbaar zijn met een beschrijving. Gebruikt vector embeddings voor intelligente matching. Goed voor: 'zoek opdrachten vergelijkbaar met Java backend developer'.",
    inputSchema: zodToJsonSchema(semantischZoekenSchema, { $refStrategy: "none" }),
  },
  {
    name: "gestructureerde_match",
    description:
      "Voer een diepgaande gestructureerde matching uit (Mariënne-methodologie). Evalueert een kandidaat tegen alle eisen van een vacature met knock-out criteria, gunningscriteria en een eindbeoordeling.",
    inputSchema: zodToJsonSchema(gestructureerdeMatchSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  semantisch_zoeken: async (raw) => {
    const { query, limit = 10, minScore = 0.5 } = semantischZoekenSchema.parse(raw);
    const matches = await findSimilarJobs(query, { limit, minScore });
    return {
      total: matches.length,
      matches: matches.map((m) => ({
        id: m.id,
        title: m.title,
        similarity: Math.round(m.similarity * 100) / 100,
      })),
    };
  },

  gestructureerde_match: async (raw) => {
    const { jobId, candidateId } = gestructureerdeMatchSchema.parse(raw);

    const [job, candidate] = await Promise.all([getJobById(jobId), getCandidateById(candidateId)]);

    if (!job) return { error: `Vacature niet gevonden (id: ${jobId})` };
    if (!candidate) return { error: `Kandidaat niet gevonden (id: ${candidateId})` };

    if (!job.description || job.description.length < 50) {
      return {
        error:
          "Vacatureomschrijving is te kort of ontbreekt. Minimaal 50 tekens vereist voor een gestructureerde matching.",
      };
    }

    if (!candidate.resumeRaw) {
      return {
        error: `Kandidaat "${candidate.name}" heeft geen CV-tekst. Upload eerst een CV.`,
      };
    }

    const requirements = await extractRequirements({
      title: job.title,
      description: job.description,
      requirements: job.requirements as unknown[] | undefined,
      wishes: job.wishes as unknown[] | undefined,
      competences: job.competences as unknown[] | undefined,
    });

    if (requirements.length === 0) {
      return {
        error:
          "Kon geen eisen extraheren uit de vacatureomschrijving. Controleer of de omschrijving voldoende detail bevat.",
      };
    }

    return runStructuredMatch({
      requirements,
      candidateName: candidate.name,
      cvText: candidate.resumeRaw,
    });
  },
};
