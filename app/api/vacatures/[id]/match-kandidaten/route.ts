import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { listApplications } from "@/src/services/applications";
import { autoMatchJobToCandidates } from "@/src/services/auto-matching";

export const dynamic = "force-dynamic";

/**
 * POST /api/vacatures/[id]/match-kandidaten
 * Runs auto-match for the job and returns top-3 candidate matches plus already-linked candidate IDs.
 */
export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: jobId } = await params;
    const matches = await autoMatchJobToCandidates(jobId, 3);
    const existing = await listApplications({ jobId });
    const alreadyLinked = existing
      .map((a) => a.candidateId)
      .filter((candidateId): candidateId is string => candidateId != null);
    return Response.json(
      {
        matches: matches.map((m) => ({
          candidateId: m.candidateId,
          candidateName: m.candidateName,
          quickScore: m.quickScore,
          matchId: m.matchId,
          reasoning: m.structuredResult?.recommendationReasoning ?? null,
        })),
        alreadyLinked,
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "POST /api/vacatures/[id]/match-kandidaten error" },
);
