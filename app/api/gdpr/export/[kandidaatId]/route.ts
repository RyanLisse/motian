import type { NextRequest } from "next/server";
import { exportCandidateData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kandidaatId: string }> },
) {
  try {
    const { kandidaatId } = await params;
    const requestedBy = _request.headers.get("x-requested-by") ?? "system";
    const data = await exportCandidateData(kandidaatId, requestedBy);

    if (!data) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }

    return Response.json({ data });
  } catch (error) {
    console.error("Fout bij exporteren kandidaatgegevens:", error);
    return Response.json({ error: "Kan kandidaatgegevens niet exporteren" }, { status: 500 });
  }
}
