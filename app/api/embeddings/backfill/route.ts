import type { NextRequest } from "next/server";
import { requirePrincipal } from "@/src/lib/api-auth";
import { embedCandidatesBatch } from "@/src/services/embedding";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Admission is API_SECRET bearer only (same contract as scrape/starten).
  // A second distinct cron bearer must not be required — that made the route unreachable.
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);

  const result = await embedCandidatesBatch({ limit });

  return Response.json(
    {
      message: `${result.embedded} kandidaten geëmbed, ${result.skipped} overgeslagen`,
      ...result,
    },
    {
      headers: { "Cache-Control": "private, no-cache, no-store" },
    },
  );
}
