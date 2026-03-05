import { llm, voice } from "@livekit/agents";
import { z } from "zod";

// ========== Direct service imports (no HTTP overhead) ==========

import {
  createApplication,
  deleteApplication,
  getApplicationById,
  getApplicationStats,
  listApplications,
  updateApplicationStage,
} from "../services/applications.js";
import { autoMatchCandidateToJobs, autoMatchJobToCandidates } from "../services/auto-matching.js";
import {
  addNoteToCandidate,
  createCandidate,
  deleteCandidate,
  getCandidateById,
  searchCandidates,
  updateCandidate,
} from "../services/candidates.js";
import { findSimilarJobs } from "../services/embedding.js";
import {
  eraseCandidateData,
  exportCandidateData,
  exportContactData,
  scrubContactData,
} from "../services/gdpr.js";
import {
  createInterview,
  deleteInterview,
  getInterviewById,
  listInterviews,
  updateInterview,
} from "../services/interviews.js";
import { deleteJob, getJobById, listJobs, updateJob } from "../services/jobs.js";
import { deleteMatch, getMatchById, listMatches, updateMatchStatus } from "../services/matches.js";
import { createMessage, deleteMessage, listMessages } from "../services/messages.js";
import {
  importJobsFromActiveScrapers,
  reviewGdprRetention,
  runCandidateScoringBatch,
} from "../services/operations-console.js";
import { extractRequirements } from "../services/requirement-extraction.js";
import { runScrapePipeline } from "../services/scrape-pipeline.js";
import { getTimeSeriesAnalytics } from "../services/scrape-results.js";
import { getAllConfigs } from "../services/scrapers.js";
import { runStructuredMatch } from "../services/structured-matching.js";

/**
 * Motian recruitment voice agent — full tool parity.
 *
 * Every tool calls service functions directly (same as MCP + chat agent).
 * No HTTP overhead, fully typed, shared DB connection pool.
 */
export class MotianAgent extends voice.Agent {
  constructor() {
    super({
      instructions: `Je bent Motian AI, de slimme recruitment assistent.
Antwoord in het Nederlands tenzij de gebruiker Engels spreekt.
Je helpt met vacatures zoeken, kandidaten beheren, matches maken, sollicitaties volgen, interviews plannen en meer.
Houd antwoorden kort en duidelijk — je praat via spraak.
Gebruik een professionele maar vriendelijke toon.
Als je iets niet weet, zeg dat eerlijk.
Bij gevaarlijke acties (verwijderen, GDPR wissen) vraag altijd om bevestiging.`,

      tools: {
        // ========== Opdrachten (Jobs) ==========

        zoekOpdrachten: llm.tool({
          description:
            "Zoek opdrachten/vacatures op trefwoord, platform, provincie, tarief of sorteer op tarief/deadline",
          parameters: z.object({
            query: z.string().optional().describe("Zoekterm"),
            platform: z.string().optional().describe("Platform filter"),
            provincie: z.string().optional().describe("Provincie filter"),
            rateMin: z.number().optional().describe("Minimum uurtarief in EUR"),
            rateMax: z.number().optional().describe("Maximum uurtarief in EUR"),
            contractType: z
              .string()
              .optional()
              .describe("Contract type: freelance, interim, vast, opdracht"),
            sortBy: z
              .enum(["nieuwste", "tarief_hoog", "tarief_laag", "deadline"])
              .optional()
              .describe("Sortering"),
            limit: z.number().optional().describe("Max resultaten (standaard 10)"),
          }),
          execute: async ({
            query,
            platform,
            provincie,
            rateMin,
            rateMax,
            contractType,
            sortBy,
            limit,
          }) => {
            const result = await listJobs({
              q: query,
              platform,
              province: provincie,
              rateMin,
              rateMax,
              contractType,
              sortBy,
              limit: limit ?? 10,
              offset: 0,
            });
            return {
              total: result.total,
              opdrachten: result.data.map((j) => ({
                id: j.id,
                title: j.title,
                company: j.company,
                location: j.location,
                platform: j.platform,
                rateMin: j.rateMin,
                rateMax: j.rateMax,
              })),
            };
          },
        }),

        getOpdrachtDetail: llm.tool({
          description: "Haal alle details van een opdracht op via UUID",
          parameters: z.object({
            id: z.string().describe("UUID van de opdracht"),
          }),
          execute: async ({ id }) => {
            const job = await getJobById(id);
            if (!job) return { error: "Opdracht niet gevonden" };
            return job;
          },
        }),

        updateOpdracht: llm.tool({
          description: "Werk een opdracht bij",
          parameters: z.object({
            id: z.string().describe("UUID van de opdracht"),
            title: z.string().optional().describe("Nieuwe titel"),
            description: z.string().optional().describe("Nieuwe beschrijving"),
            location: z.string().optional().describe("Nieuwe locatie"),
            rateMin: z.number().optional().describe("Minimum tarief"),
            rateMax: z.number().optional().describe("Maximum tarief"),
          }),
          execute: async ({ id, ...data }) => {
            const job = await updateJob(id, data);
            if (!job) return { error: "Opdracht niet gevonden" };
            return job;
          },
        }),

        verwijderOpdracht: llm.tool({
          description: "Verwijder een opdracht. Vraag altijd om bevestiging!",
          parameters: z.object({
            id: z.string().describe("UUID van de opdracht"),
          }),
          execute: async ({ id }) => {
            const deleted = await deleteJob(id);
            if (!deleted) return { error: "Opdracht niet gevonden" };
            return { success: true, message: "Opdracht verwijderd" };
          },
        }),

        // ========== Kandidaten (Candidates) ==========

        zoekKandidaten: llm.tool({
          description: "Zoek kandidaten op naam, rol, skills of locatie",
          parameters: z.object({
            query: z.string().optional().describe("Zoekterm"),
            locatie: z.string().optional().describe("Locatie filter"),
            limit: z.number().optional().describe("Max resultaten (standaard 20)"),
          }),
          execute: async ({ query, locatie, limit }) => {
            const data = await searchCandidates({
              query,
              location: locatie,
              limit: limit ?? 20,
              offset: 0,
            });
            return {
              total: data.length,
              kandidaten: data.map((c) => ({
                id: c.id,
                name: c.name,
                role: c.role,
                location: c.location,
                skills: c.skills,
              })),
            };
          },
        }),

        getKandidaatDetail: llm.tool({
          description: "Haal alle details van een kandidaat op via UUID",
          parameters: z.object({
            id: z.string().describe("UUID van de kandidaat"),
          }),
          execute: async ({ id }) => {
            const candidate = await getCandidateById(id);
            if (!candidate) return { error: "Kandidaat niet gevonden" };
            return candidate;
          },
        }),

        maakKandidaatAan: llm.tool({
          description: "Maak een nieuwe kandidaat aan",
          parameters: z.object({
            name: z.string().describe("Naam"),
            email: z.string().optional().describe("E-mailadres"),
            phone: z.string().optional().describe("Telefoonnummer"),
            role: z.string().optional().describe("Functie/rol"),
            skills: z.array(z.string()).optional().describe("Vaardigheden"),
            location: z.string().optional().describe("Locatie"),
            hourlyRate: z.number().optional().describe("Uurtarief"),
            availability: z
              .enum(["direct", "1_maand", "3_maanden"])
              .optional()
              .describe("Beschikbaarheid"),
          }),
          execute: async (data) => createCandidate(data),
        }),

        updateKandidaat: llm.tool({
          description: "Werk een kandidaat bij",
          parameters: z.object({
            id: z.string().describe("UUID van de kandidaat"),
            name: z.string().optional().describe("Naam"),
            email: z.string().optional().describe("E-mailadres"),
            phone: z.string().optional().describe("Telefoonnummer"),
            role: z.string().optional().describe("Functie/rol"),
            skills: z.array(z.string()).optional().describe("Vaardigheden"),
            location: z.string().optional().describe("Locatie"),
            hourlyRate: z.number().optional().describe("Uurtarief"),
            notes: z.string().optional().describe("Notities"),
          }),
          execute: async ({ id, ...data }) => {
            const candidate = await updateCandidate(id, data);
            if (!candidate) return { error: "Kandidaat niet gevonden" };
            return candidate;
          },
        }),

        verwijderKandidaat: llm.tool({
          description: "Verwijder een kandidaat. Vraag altijd om bevestiging!",
          parameters: z.object({
            id: z.string().describe("UUID van de kandidaat"),
          }),
          execute: async ({ id }) => {
            const deleted = await deleteCandidate(id);
            if (!deleted) return { error: "Kandidaat niet gevonden" };
            return { success: true, message: "Kandidaat verwijderd" };
          },
        }),

        voegNotitieToe: llm.tool({
          description: "Voeg een notitie toe aan een kandidaat",
          parameters: z.object({
            kandidaatId: z.string().describe("UUID van de kandidaat"),
            notitie: z.string().describe("Inhoud van de notitie"),
          }),
          execute: async ({ kandidaatId, notitie }) => {
            const candidate = await addNoteToCandidate(kandidaatId, notitie);
            if (!candidate) return { error: "Kandidaat niet gevonden" };
            return { success: true, message: "Notitie toegevoegd" };
          },
        }),

        // ========== Matches ==========

        zoekMatches: llm.tool({
          description: "Zoek matches. Filter op vacature, kandidaat of status",
          parameters: z.object({
            jobId: z.string().optional().describe("Filter op vacature-UUID"),
            candidateId: z.string().optional().describe("Filter op kandidaat-UUID"),
            status: z.string().optional().describe("Status: pending, approved, rejected"),
            limit: z.number().optional().describe("Max resultaten"),
          }),
          execute: async ({ jobId, candidateId, status, limit }) =>
            listMatches({ jobId, candidateId, status, limit }),
        }),

        getMatchDetail: llm.tool({
          description: "Haal details van een match op via UUID",
          parameters: z.object({
            id: z.string().describe("UUID van de match"),
          }),
          execute: async ({ id }) => {
            const match = await getMatchById(id);
            if (!match) return { error: "Match niet gevonden" };
            return match;
          },
        }),

        autoMatch: llm.tool({
          description: "Zoek automatisch passende matches voor een kandidaat of vacature",
          parameters: z.object({
            candidateId: z
              .string()
              .optional()
              .describe("UUID van de kandidaat (match naar vacatures)"),
            jobId: z.string().optional().describe("UUID van de vacature (match naar kandidaten)"),
          }),
          execute: async ({ candidateId, jobId }) => {
            if (!candidateId && !jobId) return { error: "candidateId of jobId is verplicht" };
            const matches = candidateId
              ? await autoMatchCandidateToJobs(candidateId)
              : await autoMatchJobToCandidates(jobId as string);
            return {
              total: matches.length,
              message:
                matches.length > 0
                  ? `${matches.length} matches gevonden`
                  : "Geen geschikte matches gevonden",
              matches: matches.map((m) => ({
                jobId: m.jobId,
                jobTitle: m.jobTitle,
                company: m.company,
                location: m.location,
                candidateId: m.candidateId,
              })),
            };
          },
        }),

        keurMatchGoed: llm.tool({
          description: "Keur een match goed (approve)",
          parameters: z.object({
            id: z.string().describe("UUID van de match"),
          }),
          execute: async ({ id }) => {
            const match = await updateMatchStatus(id, "approved");
            if (!match) return { error: "Match niet gevonden" };
            return { success: true, message: "Match goedgekeurd" };
          },
        }),

        wijsMatchAf: llm.tool({
          description: "Wijs een match af (reject)",
          parameters: z.object({
            id: z.string().describe("UUID van de match"),
          }),
          execute: async ({ id }) => {
            const match = await updateMatchStatus(id, "rejected");
            if (!match) return { error: "Match niet gevonden" };
            return { success: true, message: "Match afgewezen" };
          },
        }),

        verwijderMatch: llm.tool({
          description: "Verwijder een match",
          parameters: z.object({
            id: z.string().describe("UUID van de match"),
          }),
          execute: async ({ id }) => {
            const deleted = await deleteMatch(id);
            if (!deleted) return { error: "Match niet gevonden" };
            return { success: true, message: "Match verwijderd" };
          },
        }),

        gestructureerdeMatch: llm.tool({
          description:
            "Voer een diepgaande gestructureerde matching uit (Mariënne-methodologie). Evalueert een kandidaat tegen alle eisen van een vacature.",
          parameters: z.object({
            jobId: z.string().describe("UUID van de vacature"),
            candidateId: z.string().describe("UUID van de kandidaat"),
          }),
          execute: async ({ jobId, candidateId }) => {
            const [job, candidate] = await Promise.all([
              getJobById(jobId),
              getCandidateById(candidateId),
            ]);
            if (!job) return { error: `Vacature niet gevonden (${jobId})` };
            if (!candidate) return { error: `Kandidaat niet gevonden (${candidateId})` };
            if (!job.description || job.description.length < 50)
              return { error: "Vacatureomschrijving te kort (min 50 tekens)" };
            if (!candidate.resumeRaw)
              return {
                error: `Kandidaat "${candidate.name}" heeft geen CV-tekst`,
              };

            const requirements = await extractRequirements({
              title: job.title,
              description: job.description,
              requirements: job.requirements as unknown[] | undefined,
              wishes: job.wishes as unknown[] | undefined,
              competences: job.competences as unknown[] | undefined,
            });
            if (requirements.length === 0)
              return {
                error: "Kon geen eisen extraheren uit vacatureomschrijving",
              };

            return runStructuredMatch({
              requirements,
              candidateName: candidate.name,
              cvText: candidate.resumeRaw,
            });
          },
        }),

        semantischZoeken: llm.tool({
          description:
            "Zoek opdrachten semantisch op basis van een profielbeschrijving (vector embeddings)",
          parameters: z.object({
            query: z.string().describe("Beschrijving van het profiel"),
            limit: z.number().optional().describe("Max resultaten"),
            minScore: z.number().optional().describe("Minimale similarity score 0-1"),
          }),
          execute: async ({ query, limit, minScore }) => {
            const matches = await findSimilarJobs(query, {
              limit: limit ?? 10,
              minScore: minScore ?? 0.5,
            });
            return {
              total: matches.length,
              matches: matches.map((m) => ({
                id: m.id,
                title: m.title,
                similarity: Math.round(m.similarity * 100) / 100,
              })),
            };
          },
        }),

        // ========== Sollicitaties (Applications) ==========

        zoekSollicitaties: llm.tool({
          description: "Zoek sollicitaties. Filter op vacature, kandidaat of fase",
          parameters: z.object({
            jobId: z.string().optional().describe("Filter op vacature-UUID"),
            candidateId: z.string().optional().describe("Filter op kandidaat-UUID"),
            stage: z
              .string()
              .optional()
              .describe("Fase: new, screening, interview, offer, hired, rejected"),
            limit: z.number().optional().describe("Max resultaten"),
          }),
          execute: async (opts) => listApplications(opts),
        }),

        getSollicitatieDetail: llm.tool({
          description: "Haal details van een sollicitatie op",
          parameters: z.object({
            id: z.string().describe("UUID van de sollicitatie"),
          }),
          execute: async ({ id }) => {
            const app = await getApplicationById(id);
            if (!app) return { error: "Sollicitatie niet gevonden" };
            return app;
          },
        }),

        maakSollicitatieAan: llm.tool({
          description: "Maak een nieuwe sollicitatie aan voor een kandidaat bij een vacature",
          parameters: z.object({
            jobId: z.string().describe("UUID van de vacature"),
            candidateId: z.string().describe("UUID van de kandidaat"),
            matchId: z.string().optional().describe("UUID van een match"),
            source: z.string().optional().describe("Bron"),
            notes: z.string().optional().describe("Notities"),
          }),
          execute: async (data) => createApplication(data),
        }),

        updateSollicitatieFase: llm.tool({
          description: "Verander de fase van een sollicitatie",
          parameters: z.object({
            id: z.string().describe("UUID van de sollicitatie"),
            stage: z
              .enum(["new", "screening", "interview", "offer", "hired", "rejected"])
              .describe("Nieuwe fase"),
            notes: z.string().optional().describe("Toelichting"),
          }),
          execute: async ({ id, stage, notes }) => {
            const app = await updateApplicationStage(id, stage, notes);
            if (!app) return { error: "Sollicitatie niet gevonden" };
            return app;
          },
        }),

        verwijderSollicitatie: llm.tool({
          description: "Verwijder een sollicitatie",
          parameters: z.object({
            id: z.string().describe("UUID van de sollicitatie"),
          }),
          execute: async ({ id }) => {
            const deleted = await deleteApplication(id);
            if (!deleted) return { error: "Sollicitatie niet gevonden" };
            return { success: true, message: "Sollicitatie verwijderd" };
          },
        }),

        sollicitatieStats: llm.tool({
          description: "Bekijk statistieken van alle sollicitaties per fase",
          parameters: z.object({}),
          execute: async () => getApplicationStats(),
        }),

        // ========== Interviews ==========

        zoekInterviews: llm.tool({
          description: "Zoek interviews. Filter op sollicitatie of status",
          parameters: z.object({
            applicationId: z.string().optional().describe("Filter op sollicitatie-UUID"),
            status: z.string().optional().describe("Status: scheduled, completed, cancelled"),
            limit: z.number().optional().describe("Max resultaten"),
          }),
          execute: async (opts) => listInterviews(opts),
        }),

        getInterviewDetail: llm.tool({
          description: "Haal details van een interview op",
          parameters: z.object({
            id: z.string().describe("UUID van het interview"),
          }),
          execute: async ({ id }) => {
            const interview = await getInterviewById(id);
            if (!interview) return { error: "Interview niet gevonden" };
            return interview;
          },
        }),

        planInterview: llm.tool({
          description: "Plan een nieuw interview",
          parameters: z.object({
            applicationId: z.string().describe("UUID van de sollicitatie"),
            scheduledAt: z.string().describe("Datum en tijd (ISO 8601)"),
            type: z.enum(["phone", "video", "onsite", "technical"]).describe("Type interview"),
            interviewer: z.string().describe("Naam interviewer"),
            duration: z.number().optional().describe("Duur in minuten (standaard 60)"),
            location: z.string().optional().describe("Locatie of videolink"),
          }),
          execute: async ({ scheduledAt, ...rest }) =>
            createInterview({
              ...rest,
              scheduledAt: new Date(scheduledAt),
            }),
        }),

        updateInterview: llm.tool({
          description: "Werk een interview bij met status, feedback of beoordeling",
          parameters: z.object({
            id: z.string().describe("UUID van het interview"),
            status: z
              .enum(["scheduled", "completed", "cancelled"])
              .optional()
              .describe("Nieuwe status"),
            feedback: z.string().optional().describe("Feedback"),
            rating: z.number().optional().describe("Beoordeling 1-5"),
          }),
          execute: async ({ id, ...data }) => {
            const { interview, emptyUpdate } = await updateInterview(id, data);
            if (emptyUpdate) return { error: "Geen velden opgegeven" };
            if (!interview) return { error: "Interview niet gevonden" };
            return interview;
          },
        }),

        verwijderInterview: llm.tool({
          description: "Verwijder een interview",
          parameters: z.object({
            id: z.string().describe("UUID van het interview"),
          }),
          execute: async ({ id }) => {
            const deleted = await deleteInterview(id);
            if (!deleted) return { error: "Interview niet gevonden" };
            return { success: true, message: "Interview verwijderd" };
          },
        }),

        // ========== Berichten (Messages) ==========

        zoekBerichten: llm.tool({
          description: "Zoek berichten. Filter op sollicitatie, richting of kanaal",
          parameters: z.object({
            applicationId: z.string().optional().describe("Filter op sollicitatie-UUID"),
            direction: z.enum(["inbound", "outbound"]).optional().describe("Richting"),
            channel: z.enum(["email", "phone", "platform"]).optional().describe("Kanaal"),
            limit: z.number().optional().describe("Max resultaten"),
          }),
          execute: async (opts) => listMessages(opts),
        }),

        stuurBericht: llm.tool({
          description: "Registreer een bericht bij een sollicitatie",
          parameters: z.object({
            applicationId: z.string().describe("UUID van de sollicitatie"),
            direction: z.enum(["inbound", "outbound"]).describe("Richting"),
            channel: z.enum(["email", "phone", "platform"]).describe("Kanaal"),
            subject: z.string().optional().describe("Onderwerp"),
            body: z.string().describe("Inhoud van het bericht"),
          }),
          execute: async (data) => {
            const msg = await createMessage(data);
            if (!msg) return { error: "Ongeldig kanaal of richting" };
            return msg;
          },
        }),

        verwijderBericht: llm.tool({
          description: "Verwijder een bericht",
          parameters: z.object({
            id: z.string().describe("UUID van het bericht"),
          }),
          execute: async ({ id }) => {
            const deleted = await deleteMessage(id);
            if (!deleted) return { error: "Bericht niet gevonden" };
            return { success: true, message: "Bericht verwijderd" };
          },
        }),

        // ========== Scraper / Operations ==========

        startScraper: llm.tool({
          description:
            "Start een scraper voor een specifiek platform. Dit kan even duren (30s-2min).",
          parameters: z.object({
            platform: z.string().describe("Platform (bijv. striive, flextender, opdrachtoverheid)"),
          }),
          execute: async ({ platform }) => {
            const configs = await getAllConfigs();
            const config = configs.find((c) => c.platform === platform);
            if (!config) return { error: `Geen configuratie voor ${platform}` };
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
        }),

        importeerOpdrachtenBatch: llm.tool({
          description: "Start een batch-import van vacatures vanuit alle actieve scrapers",
          parameters: z.object({
            platform: z.string().optional().describe("Specifiek platform (optioneel)"),
          }),
          execute: async ({ platform }) => importJobsFromActiveScrapers(platform),
        }),

        runScoringBatch: llm.tool({
          description:
            "Draai de kandidaat-scoring batch: genereer matchscores voor alle actieve vacatures en kandidaten",
          parameters: z.object({}),
          execute: async () => runCandidateScoringBatch(),
        }),

        scraperAnalyse: llm.tool({
          description:
            "Bekijk scraper analytics: hoeveel opdrachten gescraped over tijd, per platform",
          parameters: z.object({
            platform: z.string().optional().describe("Filter op platform"),
            groupBy: z.enum(["day", "week"]).optional().describe("Groepering (dag of week)"),
          }),
          execute: async ({ platform, groupBy }) =>
            getTimeSeriesAnalytics({
              platform,
              groupBy,
            }),
        }),

        // ========== GDPR ==========

        exporteerKandidaatData: llm.tool({
          description: "Exporteer alle data van een kandidaat (GDPR Art. 15 — recht op inzage)",
          parameters: z.object({
            kandidaatId: z.string().describe("UUID van de kandidaat"),
          }),
          execute: async ({ kandidaatId }) => {
            const data = await exportCandidateData(kandidaatId);
            if (!data) return { error: "Kandidaat niet gevonden" };
            return data;
          },
        }),

        wisKandidaatData: llm.tool({
          description:
            "Verwijder ALLE data van een kandidaat permanent (GDPR Art. 17). ONOMKEERBAAR! Vraag altijd om bevestiging!",
          parameters: z.object({
            kandidaatId: z.string().describe("UUID van de kandidaat"),
            bevestig: z.literal(true).describe("Moet true zijn om verwijdering te bevestigen"),
          }),
          execute: async ({ kandidaatId, bevestig }) => {
            if (!bevestig)
              return {
                error:
                  "Bevestiging vereist: zet bevestig op true om de verwijdering door te voeren.",
              };
            return eraseCandidateData(kandidaatId);
          },
        }),

        scrubContactGegevens: llm.tool({
          description: "Anonimiseer contactgegevens van een agent/recruiter in vacatures",
          parameters: z.object({
            identifier: z.string().describe("E-mailadres of naam van het contact"),
          }),
          execute: async ({ identifier }) => scrubContactData(identifier),
        }),

        exporteerContactData: llm.tool({
          description: "Exporteer alle vacatures van een specifiek contact (agent/recruiter)",
          parameters: z.object({
            identifier: z.string().describe("E-mailadres of naam van het contact"),
          }),
          execute: async ({ identifier }) => exportContactData(identifier),
        }),

        reviewGdprRetentie: llm.tool({
          description:
            "Bekijk GDPR-retentiestatus: hoeveel kandidaten hebben een verlopen bewaartermijn",
          parameters: z.object({}),
          execute: async () => reviewGdprRetention(),
        }),
      },
    });
  }
}
