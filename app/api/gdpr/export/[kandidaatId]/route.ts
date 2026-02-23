import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { exportCandidateData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ kandidaatId: string }> }) => {
    const { kandidaatId } = await params;
    const requestedBy = _request.headers.get("x-requested-by") ?? "system";
    const data = await exportCandidateData(kandidaatId, requestedBy);

    if (!data) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }

    return Response.json({ data });
  },
  {
    logPrefix: "Fout bij exporteren kandidaatgegevens",
    errorMessage: "Kan kandidaatgegevens niet exporteren",
  },
);
