import { tool } from "ai";
import { z } from "zod";
import { and, db, desc, eq, gte, inArray } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";

export const renderCanvas = tool({
  description:
    "Genereer een visueel match-netwerk (canvas) dat kandidaten en vacatures als nodes toont met hun matchscores als verbindingen. Gebruik dit wanneer de recruiter een visueel overzicht wil van wie bij welke vacature past.",
  inputSchema: z.object({
    vacatureIds: z
      .array(z.string())
      .optional()
      .describe("Optioneel: filter op specifieke vacature IDs"),
    kandidaatIds: z
      .array(z.string())
      .optional()
      .describe("Optioneel: filter op specifieke kandidaat IDs"),
    minScore: z
      .number()
      .min(0)
      .max(100)
      .default(50)
      .describe("Minimale matchscore om te tonen (standaard: 50)"),
    limit: z.number().max(100).default(50).describe("Maximum aantal matches (standaard: 50)"),
  }),
  execute: async (params) => {
    const conditions = [gte(jobMatches.matchScore, params.minScore)];
    if (params.vacatureIds?.length) {
      conditions.push(inArray(jobMatches.jobId, params.vacatureIds));
    }
    if (params.kandidaatIds?.length) {
      conditions.push(inArray(jobMatches.candidateId, params.kandidaatIds));
    }

    const matchRows = await db
      .select({
        matchScore: jobMatches.matchScore,
        status: jobMatches.status,
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
        jobTitle: jobs.title,
        jobCompany: jobs.company,
        jobPlatform: jobs.platform,
        candidateName: candidates.name,
        candidateRole: candidates.role,
      })
      .from(jobMatches)
      .innerJoin(jobs, eq(jobMatches.jobId, jobs.id))
      .innerJoin(candidates, eq(jobMatches.candidateId, candidates.id))
      .where(and(...conditions))
      .orderBy(desc(jobMatches.matchScore))
      .limit(params.limit);

    if (matchRows.length === 0) {
      return { error: "Geen matches gevonden met deze criteria" };
    }

    const kandidatenMap = new Map<string, { id: string; name: string; role: string | null }>();
    const vacatureMap = new Map<
      string,
      { id: string; title: string; company: string | null; platform: string }
    >();

    for (const row of matchRows) {
      if (row.candidateId && !kandidatenMap.has(row.candidateId)) {
        kandidatenMap.set(row.candidateId, {
          id: row.candidateId,
          name: row.candidateName ?? "Onbekend",
          role: row.candidateRole ?? null,
        });
      }
      if (row.jobId && !vacatureMap.has(row.jobId)) {
        vacatureMap.set(row.jobId, {
          id: row.jobId,
          title: row.jobTitle ?? "Onbekend",
          company: row.jobCompany ?? null,
          platform: row.jobPlatform ?? "onbekend",
        });
      }
    }

    return {
      type: "match-network" as const,
      kandidaten: Array.from(kandidatenMap.values()),
      vacatures: Array.from(vacatureMap.values()),
      matches: matchRows
        .filter((r) => r.candidateId && r.jobId)
        .map((r) => ({
          kandidaatId: r.candidateId as string,
          vacatureId: r.jobId as string,
          score: r.matchScore ?? 0,
          status: r.status ?? "pending",
        })),
    };
  },
});
