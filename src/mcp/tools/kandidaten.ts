import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus";
import { autoMatchCandidateToJobs } from "../../services/auto-matching";
import {
  addNoteToCandidate,
  createCandidate,
  deleteCandidate,
  getCandidateById,
  listCandidates,
  searchCandidates,
  updateCandidate,
} from "../../services/candidates";
import { withCandidateCanonicalSkills, withCandidatesCanonicalSkills } from "../../services/esco";

// ========== Schemas ==========

const zoekKandidatenSchema = z.object({
  query: z.string().optional().describe("Zoekterm voor naam, rol of locatie"),
  location: z.string().optional().describe("Filter op locatie"),
  skills: z.string().optional().describe("Filter op vaardigheden"),
  role: z.string().optional().describe("Filter op rol/functie"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum aantal resultaten (standaard 50)"),
  offset: z.number().int().min(0).optional().describe("Offset voor paginering"),
});

const kandidaatDetailSchema = z.object({
  id: z.string().uuid().describe("UUID van de kandidaat"),
});

const maakKandidaatSchema = z.object({
  name: z.string().min(1).describe("Volledige naam van de kandidaat"),
  email: z.string().email().optional().describe("E-mailadres"),
  phone: z.string().optional().describe("Telefoonnummer"),
  role: z.string().optional().describe("Gewenste rol/functie"),
  skills: z.array(z.string()).optional().describe("Lijst van vaardigheden"),
  location: z.string().optional().describe("Locatie/woonplaats"),
  source: z.string().optional().describe("Bron (bijv. linkedin, referral)"),
  linkedinUrl: z.string().url().optional().describe("LinkedIn profiel-URL"),
  headline: z.string().optional().describe("Professionele kop/samenvatting"),
  hourlyRate: z.number().optional().describe("Gewenst uurtarief in euro"),
  availability: z
    .string()
    .optional()
    .describe("Beschikbaarheid (bijv. 'per direct', '32 uur/week')"),
  notes: z.string().optional().describe("Vrije notities"),
});

const updateKandidaatSchema = z.object({
  id: z.string().uuid().describe("UUID van de kandidaat"),
  name: z.string().min(1).optional().describe("Volledige naam"),
  email: z.string().email().optional().describe("E-mailadres"),
  phone: z.string().optional().describe("Telefoonnummer"),
  role: z.string().optional().describe("Gewenste rol/functie"),
  skills: z.array(z.string()).optional().describe("Lijst van vaardigheden"),
  location: z.string().optional().describe("Locatie/woonplaats"),
  source: z.string().optional().describe("Bron"),
  linkedinUrl: z.string().url().optional().describe("LinkedIn profiel-URL"),
  headline: z.string().optional().describe("Professionele kop/samenvatting"),
  hourlyRate: z.number().optional().describe("Gewenst uurtarief in euro"),
  availability: z.string().optional().describe("Beschikbaarheid"),
  notes: z.string().optional().describe("Vrije notities"),
});

const verwijderKandidaatSchema = z.object({
  id: z.string().uuid().describe("UUID van de kandidaat"),
});

const voegNotitieToeSchema = z.object({
  id: z.string().uuid().describe("UUID van de kandidaat"),
  note: z.string().min(1).describe("De notitie om toe te voegen"),
});

const autoMatchKandidaatSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat om te matchen"),
});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "zoek_kandidaten",
    description:
      "Zoek kandidaten op naam, locatie, vaardigheden of rol. Zonder filters worden de nieuwste kandidaten getoond.",
    inputSchema: zodToJsonSchema(zoekKandidatenSchema, { $refStrategy: "none" }),
  },
  {
    name: "kandidaat_detail",
    description: "Haal volledige details op van een kandidaat op basis van UUID.",
    inputSchema: zodToJsonSchema(kandidaatDetailSchema, { $refStrategy: "none" }),
  },
  {
    name: "maak_kandidaat_aan",
    description:
      "Maak een nieuwe kandidaat aan in het systeem. Naam is verplicht, overige velden optioneel.",
    inputSchema: zodToJsonSchema(maakKandidaatSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_kandidaat",
    description: "Werk een bestaande kandidaat bij. Geef het UUID en de te wijzigen velden mee.",
    inputSchema: zodToJsonSchema(updateKandidaatSchema, { $refStrategy: "none" }),
  },
  {
    name: "verwijder_kandidaat",
    description:
      "Verwijder een kandidaat (soft-delete). De data blijft bewaard maar is niet meer zichtbaar.",
    inputSchema: zodToJsonSchema(verwijderKandidaatSchema, { $refStrategy: "none" }),
  },
  {
    name: "voeg_notitie_toe",
    description: "Voeg een notitie toe aan een kandidaat met automatisch tijdstempel.",
    inputSchema: zodToJsonSchema(voegNotitieToeSchema, { $refStrategy: "none" }),
  },
  {
    name: "auto_match_kandidaat",
    description:
      "Match een kandidaat automatisch met de best passende vacatures (top 3). Gebruikt AI-scoring en deep matching.",
    inputSchema: zodToJsonSchema(autoMatchKandidaatSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  zoek_kandidaten: async (raw) => {
    const opts = zoekKandidatenSchema.parse(raw);
    if (opts.query || opts.location || opts.skills || opts.role) {
      return withCandidatesCanonicalSkills(await searchCandidates(opts));
    }
    return withCandidatesCanonicalSkills(
      await listCandidates({ limit: opts.limit, offset: opts.offset }),
    );
  },

  kandidaat_detail: async (raw) => {
    const { id } = kandidaatDetailSchema.parse(raw);
    const result = await getCandidateById(id);
    if (!result) return { error: "Kandidaat niet gevonden" };
    return withCandidateCanonicalSkills(result);
  },

  maak_kandidaat_aan: async (raw) => {
    const data = maakKandidaatSchema.parse(raw);
    const candidate = await createCandidate(data);
    revalidatePath("/kandidaten");
    revalidatePath("/overzicht");
    publish("candidate:created", { id: candidate.id, name: candidate.name });
    return withCandidateCanonicalSkills(candidate);
  },

  update_kandidaat: async (raw) => {
    const { id, ...data } = updateKandidaatSchema.parse(raw);
    const result = await updateCandidate(id, data);
    if (!result) return { error: "Kandidaat niet gevonden" };
    revalidatePath("/kandidaten");
    revalidatePath(`/kandidaten/${id}`);
    publish("candidate:updated", { id, name: result.name });
    return withCandidateCanonicalSkills(result);
  },

  verwijder_kandidaat: async (raw) => {
    const { id } = verwijderKandidaatSchema.parse(raw);
    const deleted = await deleteCandidate(id);
    if (!deleted) return { error: "Kandidaat niet gevonden of al verwijderd" };
    revalidatePath("/kandidaten");
    publish("candidate:deleted", { id });
    return { success: true, message: "Kandidaat verwijderd" };
  },

  voeg_notitie_toe: async (raw) => {
    const { id, note } = voegNotitieToeSchema.parse(raw);
    const result = await addNoteToCandidate(id, note);
    if (!result) return { error: "Kandidaat niet gevonden" };
    revalidatePath(`/kandidaten/${id}`);
    publish("candidate:updated", { id, action: "note_added" });
    return result;
  },

  auto_match_kandidaat: async (raw) => {
    const { candidateId } = autoMatchKandidaatSchema.parse(raw);
    const results = await autoMatchCandidateToJobs(candidateId);
    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/overzicht");
    revalidatePath(`/kandidaten/${candidateId}`);
    publish("match:created", { candidateId, count: Array.isArray(results) ? results.length : 0 });
    return results;
  },
};
