import { NextRequest } from "next/server";
import { findExpiredRetentionCandidates, eraseCandidateData } from "@/src/services/gdpr";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await findExpiredRetentionCandidates();

    if (expired.length === 0) {
      return Response.json({ message: "Geen kandidaten met verlopen dataretentie" });
    }

    let totalErased = 0;
    const errors: string[] = [];

    for (const candidate of expired) {
      try {
        const result = await eraseCandidateData(candidate.id);
        if (result.deletedCandidate) totalErased++;
      } catch (err) {
        errors.push(`Kandidaat ${candidate.id}: ${String(err)}`);
      }
    }

    return Response.json({
      message: `${totalErased}/${expired.length} kandidaten verwijderd`,
      totalErased,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
