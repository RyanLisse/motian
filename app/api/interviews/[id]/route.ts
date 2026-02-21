import { NextRequest, NextResponse } from "next/server"
import { updateInterview } from "../../../../src/services/interviews"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, feedback, rating } = body

    const result = await updateInterview(id, { status, feedback, rating })

    if (!result) {
      return NextResponse.json(
        { error: "Interview niet gevonden" },
        { status: 404 },
      )
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("PATCH /api/interviews/[id] error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
