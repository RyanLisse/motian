import { NextRequest, NextResponse } from "next/server"
import { listMatches } from "../../../src/services/matches"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const jobId = searchParams.get("jobId") ?? undefined
    const candidateId = searchParams.get("candidateId") ?? undefined
    const status = searchParams.get("status") ?? undefined
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined

    const matches = await listMatches({ jobId, candidateId, status, limit })
    return NextResponse.json(matches)
  } catch (error: unknown) {
    console.error("GET /api/matches error:", error)
    const message = error instanceof Error ? error.message : "Onbekende fout"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { candidateId } = body

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is vereist" },
        { status: 400 },
      )
    }

    const matches = await listMatches({ candidateId })
    return NextResponse.json(matches)
  } catch (error: unknown) {
    console.error("POST /api/matches error:", error)
    const message = error instanceof Error ? error.message : "Onbekende fout"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
