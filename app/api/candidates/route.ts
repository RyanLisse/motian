import { NextRequest, NextResponse } from "next/server"
import { searchCandidates, listCandidates } from "../../../src/services/candidates"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const query = searchParams.get("query") ?? undefined
    const location = searchParams.get("location") ?? undefined
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined

    // Use searchCandidates when filters are provided, listCandidates otherwise
    const candidates =
      query || location
        ? await searchCandidates({ query, location, limit })
        : await listCandidates(limit)

    return NextResponse.json(candidates)
  } catch (error: unknown) {
    console.error("GET /api/candidates error:", error)
    const message = error instanceof Error ? error.message : "Onbekende fout"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
