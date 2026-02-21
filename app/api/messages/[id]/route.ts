import { NextRequest, NextResponse } from "next/server"
import { getMessageById } from "../../../../src/services/messages"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const message = await getMessageById(id)

    if (!message) {
      return NextResponse.json(
        { error: "Bericht niet gevonden" },
        { status: 404 },
      )
    }

    return NextResponse.json(message)
  } catch (error: unknown) {
    console.error("GET /api/messages/[id] error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
