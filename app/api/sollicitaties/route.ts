import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { publish } from "@/src/lib/event-bus";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
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

export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const stats = params.get("stats");

  if (stats === "true") {
    const data = await getApplicationStats();
    return Response.json(
      { data },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const jobId = params.get("jobId") ?? undefined;
  const candidateId = params.get("candidateId") ?? undefined;
  const stage = params.get("stage") ?? undefined;
  const { page, limit, offset } = parsePagination(params);

  const data = await listApplications({ jobId, candidateId, stage, limit, offset });
  const total = await countApplications({ jobId, candidateId, stage });
  return Response.json(paginatedResponse(data, total, { page, limit, offset }), {
    headers: { "Cache-Control": "no-store" },
  });
});

export const POST = withApiHandler(async (request: Request) => {
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
  return Response.json(
    { data: application },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-cache, no-store" },
    },
  );
});
