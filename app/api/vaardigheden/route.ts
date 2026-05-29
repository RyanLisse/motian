import { NextResponse } from "next/server";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";

export const dynamic = "force-dynamic";

function hasPaginationQuery(searchParams: URLSearchParams): boolean {
  return ["pagina", "page", "limit", "perPage"].some((key) => searchParams.has(key));
}

/**
 * GET /api/vaardigheden
 * List canonical recruiter-friendly skills for filter dropdowns.
 * Query: ?q= optional search on skill labels.
 */
export async function GET(req: Request) {
  const { countSkillFilterOptions, listSkillsForFilterOptions } = await import(
    "@/src/services/esco"
  );
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const headers = {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  };

  if (!hasPaginationQuery(searchParams)) {
    const skills = await listSkillsForFilterOptions(q);
    return NextResponse.json(skills, { headers });
  }

  const { page, limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 100 });
  const [skills, total] = await Promise.all([
    listSkillsForFilterOptions(q, { limit, offset }),
    countSkillFilterOptions(q),
  ]);

  return NextResponse.json(paginatedResponse(skills, total, { page, limit, offset }), { headers });
}
