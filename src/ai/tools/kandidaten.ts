import { tool } from "ai";
import { z } from "zod";
import {
  createCandidate,
  deleteCandidate,
  getCandidateById,
  listCandidates,
  searchCandidates,
  updateCandidate,
} from "@/src/services/candidates";

export const zoekKandidaten = tool({
  description:
    "Zoek en lijst kandidaten. Gebruik een zoekopdracht om op naam te zoeken, of filter op locatie. Zonder parameters worden alle kandidaten opgehaald.",
  inputSchema: z.object({
    query: z.string().optional().describe("Zoekterm om kandidaten op naam te vinden"),
    location: z.string().optional().describe("Filter op locatie, bijv. Amsterdam, Utrecht"),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async ({ query, location, limit }) => {
    if (query || location) {
      const results = await searchCandidates({ query, location, limit });
      return { total: results.length, kandidaten: results };
    }
    const results = await listCandidates(limit);
    return { total: results.length, kandidaten: results };
  },
});

export const getKandidaatDetail = tool({
  description:
    "Haal volledige details op van een kandidaat op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifieke kandidaat.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ id }) => {
    const candidate = await getCandidateById(id);
    if (!candidate) return { error: "Kandidaat niet gevonden" };
    return candidate;
  },
});

export const maakKandidaatAan = tool({
  description:
    "Maak een nieuwe kandidaat aan in het systeem. Naam is verplicht, overige velden zijn optioneel.",
  inputSchema: z.object({
    name: z.string().describe("Volledige naam van de kandidaat"),
    email: z.string().email().optional().describe("E-mailadres van de kandidaat"),
    role: z.string().optional().describe("Functie of rol van de kandidaat"),
    skills: z
      .array(z.string())
      .optional()
      .describe("Lijst van vaardigheden, bijv. ['React', 'TypeScript']"),
    location: z.string().optional().describe("Locatie of woonplaats van de kandidaat"),
    source: z.string().optional().describe("Bron waar de kandidaat vandaan komt, bijv. LinkedIn"),
  }),
  execute: async (data) => {
    const candidate = await createCandidate(data);
    return candidate;
  },
});

export const updateKandidaat = tool({
  description:
    "Werk een bestaande kandidaat bij. Geef het ID en minimaal één veld dat gewijzigd moet worden.",
  inputSchema: z
    .object({
      id: z.string().uuid().describe("UUID van de kandidaat"),
      name: z.string().optional().describe("Nieuwe naam van de kandidaat"),
      email: z.string().email().optional().describe("Nieuw e-mailadres"),
      role: z.string().optional().describe("Nieuwe functie of rol"),
      skills: z.array(z.string()).optional().describe("Bijgewerkte lijst van vaardigheden"),
      location: z.string().optional().describe("Nieuwe locatie of woonplaats"),
      source: z.string().optional().describe("Bijgewerkte bron"),
    })
    .refine(({ id: _id, ...rest }) => Object.values(rest).some((v) => v !== undefined), {
      message: "Minimaal één veld om bij te werken is vereist",
    }),
  execute: async ({ id, ...data }) => {
    const candidate = await updateCandidate(id, data);
    if (!candidate) return { error: "Kandidaat niet gevonden" };
    return candidate;
  },
});

export const verwijderKandidaat = tool({
  description:
    "Verwijder een kandidaat uit het systeem (soft-delete). Gebruik dit wanneer een kandidaat niet meer relevant is.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de kandidaat die verwijderd moet worden"),
  }),
  execute: async ({ id }) => {
    const success = await deleteCandidate(id);
    if (!success) return { error: "Kandidaat niet gevonden of kon niet verwijderd worden" };
    return { success: true, message: "Kandidaat succesvol verwijderd" };
  },
});
