import { NextRequest, NextResponse } from "next/server";
import { enrichJobsBatch } from "../../../../services/ai-enrichment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === "string" ? body.platform : undefined;
    const limit = typeof body.limit === "number" ? body.limit : 50;

    const result = await enrichJobsBatch({ platform, limit });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[API /opdrachten/verrijken] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}
