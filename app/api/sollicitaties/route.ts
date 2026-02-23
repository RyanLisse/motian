import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import {
  countApplications,
  createApplication,
  getApplicationStats,
  listApplications,
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
    const page = Math.max(1, parseInt(params.get("pagina") ?? params.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(params.get("limit") ?? params.get("perPage") ?? "50", 10)),
    );
    const offset = (page - 1) * limit;

    const data = await listApplications({ jobId, candidateId, stage, limit, offset });
    const total = await countApplications({ jobId, candidateId, stage });
    return Response.json({
      data,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    });
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
    revalidatePath("/pipeline");
    revalidatePath("/overzicht");
    publish("application:created", { applicationId: application.id });
    return Response.json({ data: application }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sollicitaties error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
