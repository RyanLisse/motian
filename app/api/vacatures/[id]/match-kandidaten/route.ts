import { runs, tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { matchKandidatenRunQuerySchema } from "@/src/schemas/match-kandidaten";
import { listApplications } from "@/src/services/applications";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * POST /api/vacatures/[id]/match-kandidaten
 *
 * Triggers the agent-matcher background task for a job and returns immediately
 * with a `runId`. The client polls GET …/match-kandidaten?runId=… for results.
 *
 * Also returns already-linked candidate IDs so the UI can render them right away.
 */
export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: jobId } = await params;

    const [handle, existing] = await Promise.all([
      tasks.trigger("agent-matcher", {
        mode: "job" as const,
        jobId,
        topN: 3,
      }),
      listApplications({ jobId }),
    ]);

    const alreadyLinked = existing
      .map((a) => a.candidateId)
      .filter((candidateId): candidateId is string => candidateId != null);

    return Response.json(
      { runId: handle.id, status: "running", matches: [], alreadyLinked },
      { status: 202, headers: { "Cache-Control": "private, no-cache, no-store" } },
    );
  },
  { logPrefix: "POST /api/vacatures/[id]/match-kandidaten error" },
);

/**
 * GET /api/vacatures/[id]/match-kandidaten?runId=…
 *
 * Polls the agent-matcher task status. Returns matches when complete.
 */
export const GET = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: jobId } = await params;
    const parsedQuery = matchKandidatenRunQuerySchema.safeParse({
      runId: request.nextUrl.searchParams.get("runId"),
    });

    if (!parsedQuery.success) {
      return Response.json(
        { error: parsedQuery.error.issues[0]?.message ?? "runId is verplicht" },
        { status: 400 },
      );
    }

    const { runId } = parsedQuery.data;
    const run = await runs.retrieve(runId);
    const runPayload = (run as { payload?: { jobId?: string | null } }).payload;
    const runMetadata = run.metadata as { jobId?: string | null } | undefined;
    const runJobId = runPayload?.jobId ?? runMetadata?.jobId ?? null;

    if (runJobId && runJobId !== jobId) {
      return Response.json(
        { error: "Deze match-run hoort niet bij deze vacature." },
        { status: 403 },
      );
    }

    if (run.isSuccess) {
      const output = run.output as {
        matches: Array<{
          matchId: string;
          candidateId: string;
          candidateName: string;
          quickScore: number;
          overallScore: number;
          recommendation: string | null;
          recommendationReasoning: string | null;
        }>;
      } | null;

      return Response.json(
        {
          status: "completed",
          matches: (output?.matches ?? []).map((m) => ({
            candidateId: m.candidateId,
            candidateName: m.candidateName,
            quickScore: m.quickScore,
            matchId: m.matchId,
            // Prefer the detailed reasoning text; fall back to the enum label
            // so older runs still have something to display.
            reasoning: m.recommendationReasoning ?? m.recommendation,
          })),
        },
        { headers: { "Cache-Control": "private, no-cache, no-store" } },
      );
    }

    if (run.isFailed) {
      return Response.json(
        { status: "failed", error: "Matching is mislukt. Probeer het opnieuw." },
        { status: 500, headers: { "Cache-Control": "private, no-cache, no-store" } },
      );
    }

    // Still running
    return Response.json(
      { status: "running", matches: [] },
      { headers: { "Cache-Control": "private, no-cache, no-store" } },
    );
  },
  { logPrefix: "GET /api/vacatures/[id]/match-kandidaten error" },
);
