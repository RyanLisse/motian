import { NextRequest, NextResponse } from "next/server"
import { listInterviews, createInterview } from "../../../src/services/interviews"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const applicationId = searchParams.get("applicationId") ?? undefined
    const status = searchParams.get("status") ?? undefined
    const rawLimit = searchParams.get("limit")
    const limit = rawLimit ? parseInt(rawLimit, 10) : undefined

    const interviewRecords = await listInterviews({
      applicationId,
      status,
      limit: Number.isNaN(limit) ? undefined : limit,
    })
    return NextResponse.json(interviewRecords)
  } catch (error: unknown) {
    console.error("GET /api/interviews error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { applicationId, scheduledAt, type, interviewer, duration, location } = body

    if (!applicationId || !scheduledAt || !type || !interviewer) {
      return NextResponse.json(
        { error: "applicationId, scheduledAt, type en interviewer zijn vereist" },
        { status: 400 },
      )
    }

    const parsedDate = new Date(scheduledAt)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Ongeldige scheduledAt datum" },
        { status: 400 },
      )
    }

    const interview = await createInterview({
      applicationId,
      scheduledAt: parsedDate,
      type,
      interviewer,
      duration,
      location,
    })
    return NextResponse.json(interview, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/interviews error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
