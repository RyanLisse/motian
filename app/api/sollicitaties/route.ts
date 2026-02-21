import { NextRequest, NextResponse } from "next/server"
import { listApplications, createApplication } from "../../../src/services/applications"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const jobId = searchParams.get("jobId") ?? undefined
    const candidateId = searchParams.get("candidateId") ?? undefined
    const stage = searchParams.get("stage") ?? undefined
    const rawLimit = searchParams.get("limit")
    const limit = rawLimit ? parseInt(rawLimit, 10) : undefined

    const applications = await listApplications({
      jobId,
      candidateId,
      stage,
      limit: Number.isNaN(limit) ? undefined : limit,
    })
    return NextResponse.json(applications)
  } catch (error: unknown) {
    console.error("GET /api/sollicitaties error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { jobId, candidateId, matchId, source, notes } = body

    if (!jobId || !candidateId) {
      return NextResponse.json(
        { error: "jobId en candidateId zijn vereist" },
        { status: 400 },
      )
    }

    const application = await createApplication({ jobId, candidateId, matchId, source, notes })
    return NextResponse.json(application, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/sollicitaties error:", error)
    return NextResponse.json({ error: "Er is een interne fout opgetreden" }, { status: 500 })
  }
}
