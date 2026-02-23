import type { NextRequest } from "next/server";
import { eraseCandidateData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kandidaatId: string }> },
) {
  try {
    const { kandidaatId } = await params;
    const result = await eraseCandidateData(kandidaatId);

    if (!result.deletedCandidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }

    return Response.json({ data: result });
  } catch (error) {
    console.error("Fout bij verwijderen kandidaatgegevens:", error);
    return Response.json({ error: "Kan kandidaatgegevens niet verwijderen" }, { status: 500 });
  }
}
