import { NextRequest } from "next/server";
import { z } from "zod";
import {
  listApplications,
  createApplication,
  getApplicationStats,
} from "@/src/services/applications";

export const dynamic = "force-dynamic";

const createApplicationSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  matchId: z.string().uuid().optional(),
  source: z.enum(["manual", "match", "referral", "direct"]).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const stats = params.get("stats");

    if (stats === "true") {
      const data = await getApplicationStats();
      return Response.json({ data });
    }

    const jobId = params.get("jobId") ?? undefined;
    const candidateId = params.get("candidateId") ?? undefined;
    const stage = params.get("stage") ?? undefined;
    const limit = parseInt(params.get("limit") ?? "50", 10);

    const data = await listApplications({ jobId, candidateId, stage, limit });
    return Response.json({ data, total: data.length });
  } catch (error) {
    console.error("GET /api/sollicitaties error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const application = await createApplication(parsed.data);
    return Response.json({ data: application }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sollicitaties error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
