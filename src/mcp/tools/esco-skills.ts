import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  getCandidateSkills,
  getJobSkills,
  getSkillsCatalogStatusCached,
  listSkillsForFilterOptions,
} from "../../services/esco";

// ========== Schemas ==========

const zoekSkillsSchema = z.object({
  query: z.string().optional().describe("Zoekterm om vaardigheden op naam te filteren"),
});

const skillsStatusSchema = z.object({});

const kandidaatSkillsSchema = z.object({
  kandidaatId: z.string().uuid().describe("UUID van de kandidaat"),
});

const vacatureSkillsSchema = z.object({
  vacatureId: z.string().uuid().describe("UUID van de vacature"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_skills",
    description:
      "Zoek vaardigheden op naam. Retourneert een lijst van vaardigheden die matchen met de zoekterm.",
    inputSchema: zodToJsonSchema(zoekSkillsSchema, { $refStrategy: "none" }),
  },
  {
    name: "skills_status",
    description: "Controleer de vaardigheden-catalogusstatus. Toont of de catalogus geladen is.",
    inputSchema: zodToJsonSchema(skillsStatusSchema, { $refStrategy: "none" }),
  },
  {
    name: "kandidaat_skills",
    description: "Haal de canonieke vaardigheden op voor een kandidaat op basis van UUID.",
    inputSchema: zodToJsonSchema(kandidaatSkillsSchema, { $refStrategy: "none" }),
  },
  {
    name: "vacature_skills",
    description: "Haal de canonieke vaardigheden op voor een vacature op basis van UUID.",
    inputSchema: zodToJsonSchema(vacatureSkillsSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_skills: async (raw) => {
    const { query } = zoekSkillsSchema.parse(raw);
    return listSkillsForFilterOptions(query);
  },

  skills_status: async () => {
    const catalogus = await getSkillsCatalogStatusCached();
    return { catalogus };
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
