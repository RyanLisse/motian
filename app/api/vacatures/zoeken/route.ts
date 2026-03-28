import { type NextRequest, NextResponse } from "next/server";
import { runJobPageSearch } from "@/src/lib/job-search-runner";

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
      totalPages: Math.ceil(result.total / limit),
    },
    {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    },
  );
}
