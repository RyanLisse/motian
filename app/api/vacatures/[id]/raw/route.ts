import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getJobById } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

/** Ruwe gescrapede JSON (raw_payload) van een vacature, voor inspectie in scrape-detail. */
export const GET = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const job = await getJobById(id);
    if (!job) {
      return Response.json({ error: "Vacature niet gevonden" }, { status: 404 });
    }
    return Response.json(
      {
        data: {
          id: job.id,
          title: job.title,
          platform: job.platform,
          externalId: job.externalId,
          rawPayload: job.rawPayload ?? null,
        },
      },
      {
        headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
      },
    );
  },
  {
    logPrefix: "GET /api/vacatures/[id]/raw",
    errorMessage: "Kan ruwe payload niet ophalen",
  },
);
