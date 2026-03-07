import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { publish } from "@/src/lib/event-bus";
import { createApplicationsForJob } from "@/src/services/applications";
import { updateCandidateMatchingStatus } from "@/src/services/candidates";
import { getMatchById } from "@/src/services/matches";

export const dynamic = "force-dynamic";

const koppelOpdrachtBodySchema = z
  .object({
    matchIds: z.array(z.string().uuid()).optional(),
    candidateIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => (data.matchIds?.length ?? 0) > 0 || (data.candidateIds?.length ?? 0) > 0, {
    message: "matchIds of candidateIds verplicht (minimaal één item)",
  });

/**
 * POST /api/opdrachten/[id]/koppel
 * Create applications in screening stage from selected matchIds or candidateIds (vacancy-side linking).
 */
export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: jobId } = await params;
    const body = await request.json();
    const parsed = koppelOpdrachtBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { matchIds, candidateIds } = parsed.data;
    let pairs: Array<{ candidateId: string; matchId?: string | null }>;
    if (matchIds?.length) {
      const matchRecords = await Promise.all(matchIds.map((id) => getMatchById(id)));
      pairs = matchRecords
        .filter(
          (m): m is NonNullable<typeof m> & { candidateId: string } =>
            m != null && m.jobId === jobId && m.candidateId != null,
        )
        .map((m) => ({ candidateId: m.candidateId, matchId: m.id }));
    } else if (candidateIds?.length) {
      pairs = candidateIds.map((candidateId) => ({ candidateId }));
    } else {
      return Response.json(
        { error: "matchIds of candidateIds verplicht (minimaal één item)" },
        { status: 400 },
      );
    }
    const result = await createApplicationsForJob(jobId, pairs, "screening");
    const linkedCandidateIds = new Set([
      ...result.created
        .map((application) => application.candidateId)
        .filter((candidateId): candidateId is string => candidateId != null),
      ...result.alreadyLinked,
    ]);
    await Promise.all(
      [...linkedCandidateIds].map((candidateId) =>
        updateCandidateMatchingStatus(candidateId, "linked"),
      ),
    );
    for (const app of result.created) {
      publish("application:created", { applicationId: app.id });
    }
    revalidatePath("/matching");
    revalidatePath("/professionals");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    revalidatePath("/opdrachten");
    revalidatePath(`/opdrachten/${jobId}`);
    return Response.json({
      created: result.created.length,
      alreadyLinked: result.alreadyLinked,
    });
  },
  { logPrefix: "POST /api/opdrachten/[id]/koppel error" },
);
