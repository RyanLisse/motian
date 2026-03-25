import { tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { autoMatchCandidateToJobs } from "@/src/services/auto-matching";
import type { Candidate } from "@/src/services/candidates";
import {
  addNoteToCandidate,
  createCandidate,
  deleteCandidate,
  getCandidateById,
  listCandidates,
  searchCandidates,
  updateCandidate,
} from "@/src/services/candidates";
import { withCandidateCanonicalSkills, withCandidatesCanonicalSkills } from "@/src/services/esco";
import { getJobById } from "@/src/services/jobs";
import { getMatchesForCandidate } from "@/src/services/matches";

export const zoekKandidaten = tool({
  description:
    "Zoek en lijst kandidaten. Gebruik een zoekopdracht om op naam te zoeken, of filter op locatie, vaardigheden of rol. Zonder parameters worden alle kandidaten opgehaald.",
  inputSchema: z.object({
    query: z.string().optional().describe("Zoekterm om kandidaten op naam te vinden"),
    location: z.string().optional().describe("Filter op locatie, bijv. Amsterdam, Utrecht"),
    skills: z.string().optional().describe("Filter op vaardigheid, bijv. React, Python, Java"),
    role: z.string().optional().describe("Filter op functietitel, bijv. Developer, Consultant"),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async ({ query, location, skills, role, limit }) => {
    let results: Candidate[];
    if (query || location || skills || role) {
      results = await searchCandidates({ query, location, skills, role, limit });
    } else {
      results = await listCandidates(limit);
    }
    const withSkills = await withCandidatesCanonicalSkills(results);
    const kandidaten = withSkills.map((c) => normalizeCandidateForDisplay(c));
    return { total: kandidaten.length, kandidaten };
  },
});

/** Normaliseer kandidaat voor AI-weergave: profileSummary altijd een string (geen null). */
function normalizeCandidateForDisplay<
  T extends { profileSummary?: string | null; headline?: string | null },
>(c: T): T & { profileSummary: string } {
  const profileSummary =
    c.profileSummary?.trim() || c.headline?.trim() || "Geen samenvatting beschikbaar.";
  return { ...c, profileSummary };
}

export const getKandidaatDetail = tool({
  description:
    "Haal volledige details op van een kandidaat op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifieke kandidaat.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ id }) => {
    const candidate = await getCandidateById(id);
    if (!candidate) return { error: "Kandidaat niet gevonden" };
    const withSkills = await withCandidateCanonicalSkills(candidate);
    return normalizeCandidateForDisplay(withSkills);
  },
});

export const maakKandidaatAan = tool({
  description:
    "Maak een nieuwe kandidaat aan in het systeem. Naam is verplicht, overige velden zijn optioneel.",
  inputSchema: z.object({
    name: z.string().describe("Volledige naam van de kandidaat"),
    email: z.string().email().optional().describe("E-mailadres van de kandidaat"),
    phone: z.string().optional().describe("Telefoonnummer"),
    role: z.string().optional().describe("Functie of rol van de kandidaat"),
    skills: z
      .array(z.string())
      .optional()
      .describe("Lijst van vaardigheden, bijv. ['React', 'TypeScript']"),
    location: z.string().optional().describe("Locatie of woonplaats van de kandidaat"),
    source: z.string().optional().describe("Bron waar de kandidaat vandaan komt, bijv. LinkedIn"),
    linkedinUrl: z.string().url().optional().describe("LinkedIn profiel URL"),
    headline: z.string().optional().describe("LinkedIn headline of korte omschrijving"),
    hourlyRate: z.number().optional().describe("Uurtarief in EUR"),
    availability: z.string().optional().describe("Beschikbaarheid: direct, 1_maand, 3_maanden"),
    notes: z.string().optional().describe("Notities of opmerkingen over de kandidaat"),
  }),
  execute: async (data) => {
    const candidate = await createCandidate(data);
    revalidatePath("/kandidaten");
    publish("candidate:created", { id: candidate.id, name: candidate.name });
    return withCandidateCanonicalSkills(candidate);
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
      phone: z.string().optional().describe("Telefoonnummer"),
      role: z.string().optional().describe("Nieuwe functie of rol"),
      skills: z.array(z.string()).optional().describe("Bijgewerkte lijst van vaardigheden"),
      location: z.string().optional().describe("Nieuwe locatie of woonplaats"),
      source: z.string().optional().describe("Bijgewerkte bron"),
      linkedinUrl: z.string().url().optional().describe("LinkedIn profiel URL"),
      headline: z.string().optional().describe("LinkedIn headline of korte omschrijving"),
      hourlyRate: z.number().optional().describe("Uurtarief in EUR"),
      availability: z.string().optional().describe("Beschikbaarheid: direct, 1_maand, 3_maanden"),
      notes: z.string().optional().describe("Notities of opmerkingen over de kandidaat"),
    })
    .refine(({ id: _id, ...rest }) => Object.values(rest).some((v) => v !== undefined), {
      message: "Minimaal één veld om bij te werken is vereist",
    }),
  execute: async ({ id, ...data }) => {
    const candidate = await updateCandidate(id, data);
    if (!candidate) return { error: "Kandidaat niet gevonden" };
    revalidatePath("/kandidaten");
    revalidatePath(`/kandidaten/${id}`);
    publish("candidate:updated", { id, name: candidate.name });
    return withCandidateCanonicalSkills(candidate);
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
    revalidatePath("/kandidaten");
    publish("candidate:deleted", { id });
    return { success: true, message: "Kandidaat succesvol verwijderd" };
  },
});

export const autoMatchKandidaat = tool({
  description:
    "Start automatische matching voor een kandidaat. Zoekt de top 3 best passende vacatures en geeft een gedetailleerde beoordeling per criterium.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ id }) => {
    try {
      const results = await autoMatchCandidateToJobs(id);
      if (results.length === 0) {
        return { message: "Geen geschikte vacatures gevonden", matches: [] };
      }
      revalidatePath("/kandidaten");
      revalidatePath("/vacatures");
      revalidatePath("/overzicht");
      revalidatePath(`/kandidaten/${id}`);
      publish("match:created", { candidateId: id, count: results.length });
      return { total: results.length, matches: results };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Auto-matching mislukt" };
    }
  },
});

export const cvIntakeResultaat = tool({
  description:
    "Toon het resultaat van een CV-intake met kandidaatprofiel en gevonden vacaturematches. Alleen-lezen: haalt bestaande matches op zonder opnieuw te matchen.",
  inputSchema: z.object({
    candidateId: z.string().uuid().describe("UUID van de kandidaat na CV-intake"),
  }),
  execute: async ({ candidateId }) => {
    try {
      const candidate = await getCandidateById(candidateId);
      if (!candidate) return { error: "Kandidaat niet gevonden" };

      const enriched = await withCandidateCanonicalSkills(candidate);
      const skills = Array.isArray(enriched.skills) ? enriched.skills : [];
      const topSkills = skills.slice(0, 6);

      const existingMatches = await getMatchesForCandidate(candidateId, 5);
      const matches = await Promise.all(
        existingMatches.map(async (m) => {
          const job = m.jobId ? await getJobById(m.jobId) : null;
          return {
            jobId: m.jobId ?? "",
            jobTitle: job?.title ?? "Onbekende vacature",
            company: job?.company ?? null,
            quickScore: m.matchScore,
            recommendation: m.recommendation as "go" | "no-go" | "conditional" | null,
            reasoning: m.reasoning ?? null,
          };
        }),
      );

      return {
        candidateId: enriched.id,
        candidateName: enriched.name,
        candidateRole: enriched.role ?? null,
        topSkills,
        matches,
        candidateUrl: `/kandidaten/${enriched.id}`,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Intake resultaat ophalen mislukt" };
    }
  },
});

export const voegNotitieToe = tool({
  description:
    "Voeg een notitie toe aan een kandidaat. De notitie wordt met datum toegevoegd aan bestaande notities.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de kandidaat"),
    note: z.string().describe("De notitie tekst om toe te voegen"),
  }),
  execute: async ({ id, note }) => {
    const candidate = await addNoteToCandidate(id, note);
    if (!candidate) return { error: "Kandidaat niet gevonden" };
    revalidatePath(`/kandidaten/${id}`);
    publish("candidate:updated", { id, action: "note_added" });
    return { success: true, notes: candidate.notes };
  },
});
