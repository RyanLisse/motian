import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { eraseCandidateData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ kandidaatId: string }> }) => {
    const { kandidaatId } = await params;
    const requestedBy = _request.headers.get("x-requested-by") ?? "system";
    const result = await eraseCandidateData(kandidaatId, requestedBy);

    if (!result.deletedCandidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }

    return Response.json({ data: result });
  },
  {
    logPrefix: "Fout bij verwijderen kandidaatgegevens",
    errorMessage: "Kan kandidaatgegevens niet verwijderen",
    rateLimit: { interval: 60_000, limit: 5 },
  },
);
