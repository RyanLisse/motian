import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/esco/skills
 * List ESCO skills for recruiter filter dropdowns.
 * Query: ?q= optional search on preferred labels (NL/EN).
 */
export async function GET(req: Request) {
  const { listEscoSkillsForFilter } = await import("@/src/services/esco");
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const skills = await listEscoSkillsForFilter(q);
  return NextResponse.json(skills);
}
