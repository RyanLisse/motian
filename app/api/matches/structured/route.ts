import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import { publish } from "@/src/lib/event-bus";
import { getCandidateById } from "@/src/services/candidates";
import { getJobById } from "@/src/services/jobs";
import { getMatchByJobAndCandidate } from "@/src/services/matches";
import { extractRequirements } from "@/src/services/requirement-extraction";
import { runStructuredMatch } from "@/src/services/structured-matching";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { jobId, candidateId } = parsed.data;

    const [job, candidate] = await Promise.all([getJobById(jobId), getCandidateById(candidateId)]);
    if (!job) return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    if (!candidate) return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });

    // Phase 1: Extract requirements
    const requirements = await extractRequirements({
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      wishes: job.wishes,
      competences: job.competences,
    });

    if (requirements.length === 0) {
      return Response.json({ error: "Geen eisen gevonden in opdracht" }, { status: 422 });
    }

    // Phase 2: Run structured match
    const cvText =
      candidate.resumeRaw ??
      [
        candidate.name,
        candidate.role,
        ...(Array.isArray(candidate.skills) ? (candidate.skills as string[]) : []),
      ].join(" ");

    const result = await runStructuredMatch({
      requirements,
      candidateName: candidate.name,
      cvText,
    });

    // Phase 3: Store results
    const existing = await getMatchByJobAndCandidate(jobId, candidateId);
    const matchData = {
      matchScore: result.overallScore,
      reasoning: result.recommendationReasoning,
      model: "marienne-v1",
      criteriaBreakdown: result.criteriaBreakdown,
      riskProfile: result.riskProfile,
      enrichmentSuggestions: result.enrichmentSuggestions,
      recommendation: result.recommendation,
      recommendationConfidence: result.recommendationConfidence,
      assessmentModel: "marienne-v1",
    };

    if (existing) {
      await db.update(jobMatches).set(matchData).where(eq(jobMatches.id, existing.id));
    } else {
      await db.insert(jobMatches).values({
        jobId,
        candidateId,
        status: "pending",
        ...matchData,
      });
    }

    revalidatePath("/matching");
    publish("matches:structured", { jobId, candidateId, recommendation: result.recommendation });

    return Response.json({
      message: "Gestructureerde beoordeling voltooid",
      result,
    });
  } catch (_err) {
    console.error("[Structured Match API]", _err);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
