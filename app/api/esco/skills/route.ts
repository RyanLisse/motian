import { NextResponse } from "next/server";
import { listEscoSkillsForFilter } from "@/src/services/esco";

/**
 * GET /api/esco/skills
 * List ESCO skills for recruiter filter dropdowns.
 * Query: ?q= optional search on preferred labels (NL/EN).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const skills = await listEscoSkillsForFilter(q);
  return NextResponse.json(skills);
}
