import { NextRequest, NextResponse } from "next/server"
import { updateMatchStatus } from "../../../../../src/services/matches"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await updateMatchStatus(id, "approved")

    if (!result) {
      return NextResponse.json(
        { error: "Match niet gevonden" },
        { status: 404 },
      )
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("PATCH /api/matches/[id]/approve error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
