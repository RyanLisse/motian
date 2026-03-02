import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { rateLimit } from "@/src/lib/rate-limit";
import { generateMatchesForJob } from "@/src/services/match-generation";

export const dynamic = "force-dynamic";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

const generateSchema = z.object({
  jobId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).optional(),
  limit: z.number().optional().default(10),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous";
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }

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
