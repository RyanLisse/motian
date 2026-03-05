import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { listApplications } from "@/src/services/applications";
import { autoMatchCandidateToJobs } from "@/src/services/auto-matching";

export const dynamic = "force-dynamic";

/**
 * POST /api/kandidaten/[id]/match
 * Runs auto-match for the candidate and returns top-3 matches plus already-linked job IDs.
 */
export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: candidateId } = await params;
    const matches = await autoMatchCandidateToJobs(candidateId, 3);
    const existing = await listApplications({ candidateId });
    const alreadyLinked = existing
      .map((a) => a.jobId)
      .filter((jobId): jobId is string => jobId != null);
    return Response.json({
      matches: matches.map((m) => ({
        jobId: m.jobId,
        jobTitle: m.jobTitle,
        company: m.company,
        location: m.location,
        quickScore: m.quickScore,
        matchId: m.matchId,
        reasoning: m.structuredResult?.recommendationReasoning ?? null,
      })),
      alreadyLinked,
    });
  },
  { logPrefix: "POST /api/kandidaten/[id]/match error" },
);
