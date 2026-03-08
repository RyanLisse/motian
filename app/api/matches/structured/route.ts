import type { NextRequest } from "next/server";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import {
  revalidateStructuredMatchViews,
  runStructuredMatchReview,
} from "@/src/services/structured-match-review";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { jobId, candidateId } = parsed.data;

    const outcome = await runStructuredMatchReview(jobId, candidateId);

    if (!outcome.ok) {
      const status = outcome.reason === "requirements_not_found" ? 422 : 404;
      return Response.json({ error: outcome.message }, { status });
    }

    revalidateStructuredMatchViews(jobId, candidateId);
    publish("matches:structured", {
      jobId,
      candidateId,
      recommendation: outcome.result.recommendation,
    });

    return Response.json({
      message: "Gestructureerde beoordeling voltooid",
      result: outcome.result,
    });
  } catch (_err) {
    console.error("[Structured Match API]", _err);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
