import { type NextRequest, NextResponse } from "next/server";
import { runJobPageSearch } from "@/src/lib/job-search-runner";
import { HYBRID_SEARCH_MAX_REACHABLE_RESULTS } from "@/src/services/jobs/hybrid-search-policy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const out = await runJobPageSearch(params);

  if (!out.ok) {
    return NextResponse.json(out.error.body, { status: out.error.status });
  }

  const { result, page, limit } = out.data;

  return NextResponse.json(
    {
      jobs: result.data,
      total: result.total,
      page,
      perPage: limit,
      // `total` is every match; hybrid search can only rank what it retrieved,
      // so stop offering pages past the retrieval window rather than handing
      // out page numbers that come back empty.
      totalPages: Math.ceil(Math.min(result.total, HYBRID_SEARCH_MAX_REACHABLE_RESULTS) / limit),
    },
    {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    },
  );
}
