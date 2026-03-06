import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { publish } from "@/src/lib/event-bus";
import { koppelBodySchema } from "@/src/schemas/koppeling";
import { createApplicationsFromMatches } from "@/src/services/applications";
import { getMatchById } from "@/src/services/matches";

export const dynamic = "force-dynamic";

/**
 * POST /api/kandidaten/[id]/koppel
 * Create applications in screening stage from selected matchIds or jobIds.
 */
export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: candidateId } = await params;
    const body = await request.json();
    const parsed = koppelBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { matchIds, jobIds } = parsed.data;
    let pairs: Array<{ jobId: string; matchId?: string | null }>;
    if (matchIds?.length) {
      const matchRecords = await Promise.all(matchIds.map((id) => getMatchById(id)));
      pairs = matchRecords
        .filter(
          (m): m is NonNullable<typeof m> & { jobId: string } =>
            m != null && m.candidateId === candidateId && m.jobId != null,
        )
        .map((m) => ({ jobId: m.jobId, matchId: m.id }));
    } else if (jobIds?.length) {
      pairs = jobIds.map((jobId) => ({ jobId }));
    } else {
      return Response.json(
        { error: "matchIds of jobIds verplicht (minimaal één item)" },
        { status: 400 },
      );
    }
    const result = await createApplicationsFromMatches(candidateId, pairs, "screening");
    for (const app of result.created) {
      publish("application:created", { applicationId: app.id });
    }
    revalidatePath("/kandidaten");
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    revalidatePath("/opdrachten");
    revalidatePath(`/kandidaten/${candidateId}`);
    return Response.json({
      created: result.created.length,
      alreadyLinked: result.alreadyLinked,
    });
  },
  { logPrefix: "POST /api/kandidaten/[id]/koppel error" },
);
