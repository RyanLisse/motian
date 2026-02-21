import { NextRequest, NextResponse } from "next/server"
import { getApplicationById, updateApplicationStage, VALID_STAGES } from "../../../../src/services/applications"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const application = await getApplicationById(id)

    if (!application) {
      return NextResponse.json(
        { error: "Sollicitatie niet gevonden" },
        { status: 404 },
      )
    }

    return NextResponse.json(application)
  } catch (error: unknown) {
    console.error("GET /api/sollicitaties/[id] error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { stage, notes } = body

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: "Ongeldige stage waarde" },
        { status: 400 },
      )
    }

    const result = await updateApplicationStage(id, stage, notes)

    if (!result) {
      return NextResponse.json(
        { error: "Sollicitatie niet gevonden" },
        { status: 404 },
      )
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("PATCH /api/sollicitaties/[id] error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
