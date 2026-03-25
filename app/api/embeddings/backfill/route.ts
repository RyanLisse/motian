import type { NextRequest } from "next/server";
import { embedCandidatesBatch } from "@/src/services/embedding";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);

  const result = await embedCandidatesBatch({ limit });

  return Response.json({
    message: `${result.embedded} kandidaten geëmbed, ${result.skipped} overgeslagen`,
    ...result,
  });
}
