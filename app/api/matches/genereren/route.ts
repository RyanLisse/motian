import { NextRequest } from "next/server";
import { z } from "zod";
import { getJobById } from "@/src/services/jobs";
import { listActiveCandidates, getCandidatesByIds } from "@/src/services/candidates";
import { createMatch } from "@/src/services/matches";
import { computeMatchScore } from "@/src/services/scoring";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  jobId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).optional(),
  limit: z.number().optional().default(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { jobId, candidateIds, limit } = parsed.data;

    const job = await getJobById(jobId);
    if (!job) {
      return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    }

    const candidates = candidateIds?.length
      ? await getCandidatesByIds(candidateIds)
      : await listActiveCandidates(200);

    if (candidates.length === 0) {
      return Response.json({
        message: "Geen kandidaten beschikbaar",
        jobId,
        matchesCreated: 0,
      });
    }

    // Score and sort
    const scored = candidates.map((candidate) => ({
      candidate,
      ...computeMatchScore(job, candidate),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, limit);

    // Create matches
    let matchesCreated = 0;
    const errors: string[] = [];

    for (const match of topMatches) {
      try {
        await createMatch({
          jobId: job.id,
          candidateId: match.candidate.id,
          matchScore: match.score,
          confidence: match.confidence,
          reasoning: match.reasoning,
          model: "rule-based-v1",
        });
        matchesCreated++;
      } catch (err) {
        const errMsg = String(err);
        if (!errMsg.includes("unique") && !errMsg.includes("duplicate")) {
          errors.push(`Kandidaat ${match.candidate.id}: ${errMsg}`);
        }
      }
    }

    return Response.json({
      message: "Match generatie voltooid",
      jobId,
      matchesCreated,
      totalCandidatesScored: candidates.length,
      topScore: topMatches[0]?.score ?? 0,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
