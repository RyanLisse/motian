import { type NextRequest, NextResponse } from "next/server";
import { findSimilarJobs } from "../../../../services/embedding";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query : "";
    const limit = typeof body.limit === "number" ? body.limit : 10;

    if (!query || query.length < 3) {
      return NextResponse.json({ error: "Query moet minimaal 3 tekens bevatten" }, { status: 400 });
    }

    const results = await findSimilarJobs(query, { limit });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[API /opdrachten/zoeken] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}
