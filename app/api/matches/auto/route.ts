import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { autoMatchCandidateToJobs, autoMatchJobToCandidates } from "@/src/services/auto-matching";

export const dynamic = "force-dynamic";

const autoMatchSchema = z
  .object({
    candidateId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
  })
  .refine((data) => data.candidateId || data.jobId, {
    message: "candidateId of jobId is verplicht",
  });

export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const parsed = autoMatchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { candidateId, jobId } = parsed.data;

    const matches = candidateId
      ? await autoMatchCandidateToJobs(candidateId)
      : await autoMatchJobToCandidates(jobId as string);

    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/overzicht");
    if (candidateId) revalidatePath(`/kandidaten/${candidateId}`);
    if (jobId) revalidatePath(`/vacatures/${jobId}`);

    return Response.json(
      {
        message:
          matches.length > 0
            ? `${matches.length} matches gevonden`
            : "Geen geschikte matches gevonden",
        matches,
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "POST /api/matches/auto error",
    rateLimit: { interval: 60_000, limit: 10 },
  },
);
