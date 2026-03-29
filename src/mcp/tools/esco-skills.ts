import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  getCandidateSkills,
  getEscoCatalogStatus,
  getEscoMappingStats,
  getJobSkills,
  listEscoSkillsForFilter,
} from "../../services/esco";

// ========== Schemas ==========

const zoekEscoSkillsSchema = z.object({
  query: z.string().optional().describe("Zoekterm om ESCO-skills op naam te filteren"),
});

const escoStatusSchema = z.object({});

const kandidaatSkillsSchema = z.object({
  kandidaatId: z.string().uuid().describe("UUID van de kandidaat"),
});

const vacatureSkillsSchema = z.object({
  vacatureId: z.string().uuid().describe("UUID van de vacature"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_esco_skills",
    description:
      "Zoek ESCO-skills op naam. Retourneert een lijst van ESCO-skills die matchen met de zoekterm.",
    inputSchema: zodToJsonSchema(zoekEscoSkillsSchema, { $refStrategy: "none" }),
  },
  {
    name: "esco_status",
    description:
      "Controleer de ESCO-catalogusstatus en mapping-statistieken. Toont of de catalogus geladen is en hoeveel skills gemapt zijn.",
    inputSchema: zodToJsonSchema(escoStatusSchema, { $refStrategy: "none" }),
  },
  {
    name: "kandidaat_skills",
    description: "Haal de canonieke ESCO-skills op voor een kandidaat op basis van UUID.",
    inputSchema: zodToJsonSchema(kandidaatSkillsSchema, { $refStrategy: "none" }),
  },
  {
    name: "vacature_skills",
    description: "Haal de canonieke ESCO-skills op voor een vacature op basis van UUID.",
    inputSchema: zodToJsonSchema(vacatureSkillsSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_esco_skills: async (raw) => {
    const { query } = zoekEscoSkillsSchema.parse(raw);
    return listEscoSkillsForFilter(query);
  },

  esco_status: async () => {
    const [catalogus, stats] = await Promise.all([getEscoCatalogStatus(), getEscoMappingStats()]);
    return { catalogus, stats };
  },

  kandidaat_skills: async (raw) => {
    const { kandidaatId } = kandidaatSkillsSchema.parse(raw);
    const skills = await getCandidateSkills(kandidaatId);
    return { kandidaatId, skills };
  },

  vacature_skills: async (raw) => {
    const { vacatureId } = vacatureSkillsSchema.parse(raw);
    const skills = await getJobSkills(vacatureId);
    return { vacatureId, skills };
  },
};
