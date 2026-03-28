import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { reviewCandidateMatches } from "@/src/services/candidate-intake";

export const dynamic = "force-dynamic";

/**
 * POST /api/kandidaten/[id]/match
 * Runs auto-match for the candidate and returns top-5 matches plus recommendation metadata.
 */
export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: candidateId } = await params;
    const result = await reviewCandidateMatches(candidateId, {
      topN: 5,
      matchingStatus: "in_review",
    });

    return Response.json(
      {
        candidate: result.candidate,
        profile: result.profile,
        matches: result.matches,
        recommendation: result.recommendation,
        matchingStatus: result.matchingStatus,
        alreadyLinked: result.alreadyLinked,
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "POST /api/kandidaten/[id]/match error" },
);
