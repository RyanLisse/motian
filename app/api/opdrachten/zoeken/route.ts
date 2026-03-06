import { type NextRequest, NextResponse } from "next/server";
import { parsePagination } from "@/src/lib/pagination";
import { searchJobsUnified } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

/** Thin adapter: delegates to unified search; returns shape expected by opdrachten-sidebar. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const platform = params.get("platform") ?? undefined;
  const provincie = params.get("provincie") ?? undefined;
  const contractType = params.get("contractType") ?? undefined;
  const tariefMinParam = params.get("tariefMin");
  const tariefMaxParam = params.get("tariefMax");
  const tariefMin = tariefMinParam ? Number.parseInt(tariefMinParam, 10) : undefined;
  const tariefMax = tariefMaxParam ? Number.parseInt(tariefMaxParam, 10) : undefined;
  const { page, limit, offset } = parsePagination(params, { limit: 10 });

  const result = await searchJobsUnified({
    q: q.length >= 2 ? q : undefined,
    platform,
    province: provincie,
    rateMin: Number.isFinite(tariefMin) ? tariefMin : undefined,
    rateMax: Number.isFinite(tariefMax) ? tariefMax : undefined,
    contractType: contractType || undefined,
    limit,
    offset,
  });

  const jobs = result.data.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    platform: j.platform,
    workArrangement: j.workArrangement,
    contractType: j.contractType,
  }));

  return NextResponse.json({
    jobs,
    total: result.total,
    page,
    perPage: limit,
    totalPages: Math.ceil(result.total / limit),
  });
}
