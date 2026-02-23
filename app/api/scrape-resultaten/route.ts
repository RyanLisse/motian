import type { NextRequest } from "next/server";
import { getHistory } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const results = await getHistory({ platform, limit });
    return Response.json({ data: results, total: results.length });
  } catch (error) {
    console.error("Fout bij ophalen scrape resultaten:", error);
    return Response.json({ error: "Kan scrape resultaten niet ophalen" }, { status: 500 });
  }
}
