import type { ParsedArgs } from "./parse-args";

// ========== Kandidaten ==========

import {
  searchCandidates,
  listCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  addNoteToCandidate,
} from "../services/candidates";

import {
  autoMatchCandidateToJobs,
  autoMatchJobToCandidates,
} from "../services/auto-matching";

// ========== Vacatures ==========

import {
  searchJobsByTitle,
  listJobs,
  getJobById,
  updateJob,
  deleteJob,
} from "../services/jobs";

// ========== Matches ==========

import {
  listMatches,
  getMatchById,
  createMatch,
  updateMatchStatus,
  deleteMatch,
} from "../services/matches";

// ========== Sollicitaties ==========

import {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplicationStage,
  getApplicationStats,
} from "../services/applications";

// ========== Interviews ==========

import {
  listInterviews,
  createInterview,
  updateInterview,
} from "../services/interviews";

// ========== Berichten ==========

import { listMessages, createMessage } from "../services/messages";

// ========== GDPR ==========

import {
  exportCandidateData,
  eraseCandidateData,
  scrubContactData,
} from "../services/gdpr";

// ========== Operaties ==========

import {
  importJobsFromActiveScrapers,
  runCandidateScoringBatch,
  reviewGdprRetention,
} from "../services/operations-console";

// ========== Helpers ==========

function requireArg(args: ParsedArgs, key: string): string {
  const val = args[key];
  if (!val || typeof val === "boolean") {
    throw new Error(`Verplicht argument ontbreekt: --${key}`);
  }
  return val;
}

function optionalString(args: ParsedArgs, key: string): string | undefined {
  const val = args[key];
  return typeof val === "string" ? val : undefined;
}

function optionalNumber(args: ParsedArgs, key: string): number | undefined {
  const val = args[key];
  if (typeof val === "string") {
    const n = Number(val);
    if (Number.isNaN(n)) throw new Error(`Argument --${key} moet een getal zijn`);
    return n;
  }
  return undefined;
}

function optionalStringList(args: ParsedArgs, key: string): string[] | undefined {
  const val = args[key];
  return typeof val === "string" ? val.split(",").map((s) => s.trim()) : undefined;
}

// ========== Command Registry ==========

export type Command = {
  description: string;
  usage: string;
  handler: (args: ParsedArgs) => Promise<unknown>;
};

export const commands: Record<string, Command> = {
  // ── Kandidaten ─────────────────────────────────────────────────────────

  "kandidaten:zoek": {
    description: "Zoek kandidaten op naam, locatie, vaardigheden of rol",
    usage: "[--query <term>] [--location <loc>] [--skills <skill>] [--role <rol>] [--limit <n>]",
    handler: async (args) => {
      const query = optionalString(args, "query");
      const location = optionalString(args, "location");
      const skills = optionalString(args, "skills");
      const role = optionalString(args, "role");
      const limit = optionalNumber(args, "limit");

      if (query || location || skills || role) {
        return searchCandidates({ query, location, skills, role, limit });
      }
      return listCandidates({ limit });
    },
  },

  "kandidaten:detail": {
    description: "Toon details van een kandidaat",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const candidate = await getCandidateById(id);
      if (!candidate) throw new Error("Kandidaat niet gevonden");
      return candidate;
    },
  },

  "kandidaten:maak-aan": {
    description: "Maak een nieuwe kandidaat aan",
    usage: "--name <naam> [--email, --phone, --role, --skills (komma-gescheiden), --location, --source]",
    handler: async (args) => {
      const name = requireArg(args, "name");
      return createCandidate({
        name,
        email: optionalString(args, "email"),
        phone: optionalString(args, "phone"),
        role: optionalString(args, "role"),
        skills: optionalStringList(args, "skills"),
        location: optionalString(args, "location"),
        source: optionalString(args, "source"),
      });
    },
  },

  "kandidaten:update": {
    description: "Werk een kandidaat bij",
    usage: "--id <uuid> [--name, --email, --phone, --role, --skills, --location, --source]",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const data: Record<string, unknown> = {};
      const fields = ["name", "email", "phone", "role", "location", "source"] as const;
      for (const f of fields) {
        const v = optionalString(args, f);
        if (v !== undefined) data[f] = v;
      }
      const skills = optionalStringList(args, "skills");
      if (skills) data.skills = skills;

      const result = await updateCandidate(id, data);
      if (!result) throw new Error("Kandidaat niet gevonden");
      return result;
    },
  },

  "kandidaten:verwijder": {
    description: "Verwijder een kandidaat (soft-delete)",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const ok = await deleteCandidate(id);
      if (!ok) throw new Error("Kandidaat niet gevonden");
      return { deleted: true, id };
    },
  },

  "kandidaten:notitie": {
    description: "Voeg een notitie toe aan een kandidaat",
    usage: "--id <uuid> --note <tekst>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const note = requireArg(args, "note");
      const result = await addNoteToCandidate(id, note);
      if (!result) throw new Error("Kandidaat niet gevonden");
      return result;
    },
  },

  "kandidaten:auto-match": {
    description: "Auto-match kandidaat naar beste vacatures (AI-scoring)",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      return autoMatchCandidateToJobs(id);
    },
  },

  // ── Vacatures ──────────────────────────────────────────────────────────

  "vacatures:zoek": {
    description: "Zoek vacatures op titel of platform",
    usage: "[--query <term>] [--platform <platform>] [--limit <n>]",
    handler: async (args) => {
      const query = optionalString(args, "query");
      const platform = optionalString(args, "platform");
      const limit = optionalNumber(args, "limit");

      if (query) {
        return searchJobsByTitle(query, limit);
      }
      return listJobs({ platform, limit });
    },
  },

  "vacatures:detail": {
    description: "Toon details van een vacature",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const job = await getJobById(id);
      if (!job) throw new Error("Vacature niet gevonden");
      return job;
    },
  },

  "vacatures:update": {
    description: "Werk een vacature bij",
    usage: "--id <uuid> [--title, --description, --location, --rate-min, --rate-max, --contract-type, --work-arrangement]",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const data: Record<string, unknown> = {};
      const stringFields = ["title", "description", "location", "contractType", "workArrangement"] as const;
      const argMap: Record<string, string> = {
        title: "title",
        description: "description",
        location: "location",
        contractType: "contract-type",
        workArrangement: "work-arrangement",
      };
      for (const f of stringFields) {
        const v = optionalString(args, argMap[f] ?? f);
        if (v !== undefined) data[f] = v;
      }
      const rateMin = optionalNumber(args, "rate-min");
      const rateMax = optionalNumber(args, "rate-max");
      if (rateMin !== undefined) data.rateMin = rateMin;
      if (rateMax !== undefined) data.rateMax = rateMax;

      const result = await updateJob(id, data);
      if (!result) throw new Error("Vacature niet gevonden");
      return result;
    },
  },

  "vacatures:verwijder": {
    description: "Verwijder een vacature (soft-delete)",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const ok = await deleteJob(id);
      if (!ok) throw new Error("Vacature niet gevonden");
      return { deleted: true, id };
    },
  },

  "vacatures:auto-match": {
    description: "Auto-match vacature naar beste kandidaten (AI-scoring)",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      return autoMatchJobToCandidates(id);
    },
  },

  // ── Matches ────────────────────────────────────────────────────────────

  "matches:zoek": {
    description: "Zoek matches met optionele filters",
    usage: "[--job-id <uuid>] [--candidate-id <uuid>] [--status <status>] [--limit <n>]",
    handler: async (args) => {
      return listMatches({
        jobId: optionalString(args, "job-id"),
        candidateId: optionalString(args, "candidate-id"),
        status: optionalString(args, "status"),
        limit: optionalNumber(args, "limit"),
      });
    },
  },

  "matches:detail": {
    description: "Toon details van een match",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const match = await getMatchById(id);
      if (!match) throw new Error("Match niet gevonden");
      return match;
    },
  },

  "matches:maak-aan": {
    description: "Maak een nieuwe match aan",
    usage: "--job-id <uuid> --candidate-id <uuid> --score <0-100> [--reasoning <tekst>] [--recommendation <tekst>]",
    handler: async (args) => {
      const jobId = requireArg(args, "job-id");
      const candidateId = requireArg(args, "candidate-id");
      const matchScore = optionalNumber(args, "score");
      if (matchScore === undefined) throw new Error("Verplicht argument ontbreekt: --score");

      return createMatch({
        jobId,
        candidateId,
        matchScore,
        reasoning: optionalString(args, "reasoning"),
        recommendation: optionalString(args, "recommendation"),
        model: optionalString(args, "model"),
      });
    },
  },

  "matches:goedkeuren": {
    description: "Keur een match goed",
    usage: "--id <uuid> [--reviewed-by <naam>]",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const result = await updateMatchStatus(id, "approved", optionalString(args, "reviewed-by"));
      if (!result) throw new Error("Match niet gevonden");
      return result;
    },
  },

  "matches:afwijzen": {
    description: "Wijs een match af",
    usage: "--id <uuid> [--reviewed-by <naam>]",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const result = await updateMatchStatus(id, "rejected", optionalString(args, "reviewed-by"));
      if (!result) throw new Error("Match niet gevonden");
      return result;
    },
  },

  "matches:verwijder": {
    description: "Verwijder een match (hard-delete)",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const ok = await deleteMatch(id);
      if (!ok) throw new Error("Match niet gevonden");
      return { deleted: true, id };
    },
  },

  // ── Sollicitaties ──────────────────────────────────────────────────────

  "sollicitaties:zoek": {
    description: "Zoek sollicitaties met optionele filters",
    usage: "[--job-id <uuid>] [--candidate-id <uuid>] [--stage <fase>] [--limit <n>]",
    handler: async (args) => {
      return listApplications({
        jobId: optionalString(args, "job-id"),
        candidateId: optionalString(args, "candidate-id"),
        stage: optionalString(args, "stage"),
        limit: optionalNumber(args, "limit"),
      });
    },
  },

  "sollicitaties:detail": {
    description: "Toon details van een sollicitatie",
    usage: "--id <uuid>",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const app = await getApplicationById(id);
      if (!app) throw new Error("Sollicitatie niet gevonden");
      return app;
    },
  },

  "sollicitaties:maak-aan": {
    description: "Maak een nieuwe sollicitatie aan",
    usage: "--job-id <uuid> --candidate-id <uuid> [--source <bron>]",
    handler: async (args) => {
      return createApplication({
        jobId: requireArg(args, "job-id"),
        candidateId: requireArg(args, "candidate-id"),
        source: optionalString(args, "source"),
      });
    },
  },

  "sollicitaties:fase": {
    description: "Wijzig de fase van een sollicitatie",
    usage: "--id <uuid> --stage <new|screening|interview|offer|hired|rejected> [--notes <tekst>]",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const stage = requireArg(args, "stage");
      const result = await updateApplicationStage(id, stage, optionalString(args, "notes"));
      if (!result) throw new Error("Sollicitatie niet gevonden of ongeldige fase");
      return result;
    },
  },

  "sollicitaties:stats": {
    description: "Toon statistieken van alle sollicitaties per fase",
    usage: "",
    handler: async () => {
      return getApplicationStats();
    },
  },

  // ── Interviews ─────────────────────────────────────────────────────────

  "interviews:zoek": {
    description: "Zoek interviews met optionele filters",
    usage: "[--application-id <uuid>] [--status <status>] [--limit <n>]",
    handler: async (args) => {
      return listInterviews({
        applicationId: optionalString(args, "application-id"),
        status: optionalString(args, "status"),
        limit: optionalNumber(args, "limit"),
      });
    },
  },

  "interviews:plan": {
    description: "Plan een nieuw interview",
    usage: "--application-id <uuid> --type <phone|video|onsite|technical> --scheduled-at <ISO-datum> --interviewer <naam> [--location <locatie>] [--duration <minuten>]",
    handler: async (args) => {
      const scheduledAtStr = requireArg(args, "scheduled-at");
      const scheduledAt = new Date(scheduledAtStr);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error("Ongeldige datum voor --scheduled-at (gebruik ISO-8601 formaat)");
      }

      return createInterview({
        applicationId: requireArg(args, "application-id"),
        type: requireArg(args, "type"),
        scheduledAt,
        interviewer: requireArg(args, "interviewer"),
        location: optionalString(args, "location"),
        duration: optionalNumber(args, "duration"),
      });
    },
  },

  "interviews:update": {
    description: "Werk een interview bij (status, feedback, rating)",
    usage: "--id <uuid> [--status <scheduled|completed|cancelled>] [--feedback <tekst>] [--rating <1-5>]",
    handler: async (args) => {
      const id = requireArg(args, "id");
      const { interview, emptyUpdate } = await updateInterview(id, {
        status: optionalString(args, "status"),
        feedback: optionalString(args, "feedback"),
        rating: optionalNumber(args, "rating"),
      });
      if (emptyUpdate) throw new Error("Geen velden opgegeven om bij te werken");
      if (!interview) throw new Error("Interview niet gevonden of ongeldige waarden");
      return interview;
    },
  },

  // ── Berichten ──────────────────────────────────────────────────────────

  "berichten:zoek": {
    description: "Zoek berichten met optionele filters",
    usage: "[--application-id <uuid>] [--direction <inbound|outbound>] [--channel <email|phone|platform>] [--limit <n>]",
    handler: async (args) => {
      return listMessages({
        applicationId: optionalString(args, "application-id"),
        direction: optionalString(args, "direction"),
        channel: optionalString(args, "channel"),
        limit: optionalNumber(args, "limit"),
      });
    },
  },

  "berichten:stuur": {
    description: "Stuur een nieuw bericht",
    usage: "--application-id <uuid> --direction <inbound|outbound> --channel <email|phone|platform> --body <tekst> [--subject <onderwerp>]",
    handler: async (args) => {
      const result = await createMessage({
        applicationId: requireArg(args, "application-id"),
        direction: requireArg(args, "direction"),
        channel: requireArg(args, "channel"),
        body: requireArg(args, "body"),
        subject: optionalString(args, "subject"),
      });
      if (!result) throw new Error("Ongeldig kanaal of richting");
      return result;
    },
  },

  // ── GDPR ───────────────────────────────────────────────────────────────

  "gdpr:exporteer": {
    description: "Exporteer alle data van een kandidaat (GDPR Art. 15)",
    usage: "--candidate-id <uuid> [--requested-by <naam>]",
    handler: async (args) => {
      const candidateId = requireArg(args, "candidate-id");
      const result = await exportCandidateData(candidateId, optionalString(args, "requested-by"));
      if (!result) throw new Error("Kandidaat niet gevonden");
      return result;
    },
  },

  "gdpr:wis": {
    description: "Wis alle kandidaatdata permanent (GDPR Art. 17) — vereist --bevestig",
    usage: "--candidate-id <uuid> --bevestig [--requested-by <naam>]",
    handler: async (args) => {
      const candidateId = requireArg(args, "candidate-id");
      if (args.bevestig !== true) {
        throw new Error(
          "GDPR-wissing vereist bevestiging. Voeg --bevestig toe om door te gaan.\n" +
            "LET OP: Dit verwijdert alle data permanent en is niet terug te draaien.",
        );
      }
      return eraseCandidateData(candidateId, optionalString(args, "requested-by"));
    },
  },

  "gdpr:scrub": {
    description: "Verwijder contactdata van een persoon uit vacatures",
    usage: "--identifier <email-of-naam> [--requested-by <naam>]",
    handler: async (args) => {
      const identifier = requireArg(args, "identifier");
      return scrubContactData(identifier, optionalString(args, "requested-by"));
    },
  },

  "gdpr:retentie": {
    description: "Bekijk kandidaten met verlopen dataretentie",
    usage: "",
    handler: async () => {
      return reviewGdprRetention();
    },
  },

  // ── Operaties ──────────────────────────────────────────────────────────

  "ops:importeer": {
    description: "Importeer vacatures van actieve scrapers",
    usage: "[--platform <platform>]",
    handler: async (args) => {
      return importJobsFromActiveScrapers(optionalString(args, "platform"));
    },
  },

  "ops:scoring-batch": {
    description: "Batch scoring van kandidaten voor alle actieve vacatures",
    usage: "",
    handler: async () => {
      return runCandidateScoringBatch();
    },
  },
};
