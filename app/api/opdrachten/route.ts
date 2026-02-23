import type { NextRequest } from "next/server";
import { listJobs } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get("q") ?? undefined;
    const platform = params.get("platform") ?? undefined;
    const provincie = params.get("provincie") ?? undefined;
    const tariefMin = params.get("tariefMin");
    const tariefMax = params.get("tariefMax");
    const contractType = params.get("contractType") ?? undefined;
    const limit = parseInt(params.get("limit") ?? "50", 10);
    const offset = parseInt(params.get("offset") ?? "0", 10);

    const result = await listJobs({
      q,
      platform,
      province: provincie,
      rateMin: tariefMin ? parseFloat(tariefMin) : undefined,
      rateMax: tariefMax ? parseFloat(tariefMax) : undefined,
      contractType,
      limit,
      offset,
    });

    return Response.json({ data: result.data, total: result.total });
  } catch (error) {
    console.error("GET /api/opdrachten error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
