import { NextRequest, NextResponse } from "next/server"
import { listMessages, createMessage, VALID_DIRECTIONS, VALID_CHANNELS } from "../../../src/services/messages"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const applicationId = searchParams.get("applicationId") ?? undefined
    const direction = searchParams.get("direction") ?? undefined
    const channel = searchParams.get("channel") ?? undefined
    const rawLimit = searchParams.get("limit")
    const limit = rawLimit ? parseInt(rawLimit, 10) : undefined

    const messageRecords = await listMessages({
      applicationId,
      direction,
      channel,
      limit: Number.isNaN(limit) ? undefined : limit,
    })
    return NextResponse.json(messageRecords)
  } catch (error: unknown) {
    console.error("GET /api/messages error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { applicationId, direction, channel, subject, body: messageBody } = body

    if (!applicationId || !direction || !channel || !messageBody) {
      return NextResponse.json(
        { error: "applicationId, direction, channel en body zijn vereist" },
        { status: 400 },
      )
    }

    if (!VALID_DIRECTIONS.includes(direction)) {
      return NextResponse.json(
        { error: "Ongeldige direction waarde" },
        { status: 400 },
      )
    }

    if (!VALID_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: "Ongeldige channel waarde" },
        { status: 400 },
      )
    }

    const message = await createMessage({
      applicationId,
      direction,
      channel,
      subject,
      body: messageBody,
    })
    return NextResponse.json(message, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/messages error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
