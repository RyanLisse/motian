import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { generateMatchesForJob } from "@/src/services/match-generation";

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
        { status: 400 },
      );
    }

    const { jobId, candidateIds, limit } = parsed.data;

    let result: Awaited<ReturnType<typeof generateMatchesForJob>>;
    try {
      result = await generateMatchesForJob({ jobId, candidateIds, limit });
    } catch (err) {
      if (err instanceof Error && err.message === "Opdracht niet gevonden") {
        return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
      }
      throw err;
    }

    revalidatePath("/matching");
    revalidatePath("/overzicht");
    publish("matches:generated", { jobId, matchesCreated: result.matchesCreated });

    return Response.json({
      message: "Match generatie voltooid",
      jobId,
      matchesCreated: result.matchesCreated,
      duplicateMatches: result.duplicateMatches,
      totalCandidatesScored: result.totalCandidatesScored,
      topScore: result.topScore,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    });
  } catch (_err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
