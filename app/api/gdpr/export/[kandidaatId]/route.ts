import { exportCandidateData } from "@/src/services/gdpr";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kandidaatId: string }> }
) {
  try {
    const { kandidaatId } = await params;
    const data = await exportCandidateData(kandidaatId);

    if (!data) {
      return Response.json(
        { error: "Kandidaat niet gevonden" },
        { status: 404 }
      );
    }

    return Response.json({ data });
  } catch (error) {
    console.error("Fout bij exporteren kandidaatgegevens:", error);
    return Response.json(
      { error: "Kan kandidaatgegevens niet exporteren" },
      { status: 500 }
    );
  }
}
