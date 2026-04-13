import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/esco/skills
 * Legacy alias for the recruiter skills endpoint.
 * Query: ?q= optional search on canonical skill labels.
 */
export async function GET(req: Request) {
  const { listSkillsForFilterOptions } = await import("@/src/services/esco");
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const skills = await listSkillsForFilterOptions(q);
  return NextResponse.json(skills, {
    headers: {
      // Canonical skills rarely change; cache aggressively
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
