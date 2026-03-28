import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { publish } from "@/src/lib/event-bus";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import {
  countInterviews,
  createInterview,
  getUpcomingInterviews,
  listInterviews,
} from "@/src/services/interviews";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("upcoming") === "true") {
    const data = await getUpcomingInterviews();
    return Response.json(
      {
        data,
        total: data.length,
        page: 1,
        perPage: data.length,
        totalPages: 1,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      },
    );
  }

  const { page, limit, offset } = parsePagination(searchParams);
  const applicationId = searchParams.get("applicationId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const data = await listInterviews({
    applicationId,
    status,
    limit,
    offset,
  });
  const total = await countInterviews({ applicationId, status });
  return Response.json(paginatedResponse(data, total, { page, limit, offset }), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
});

const CreateSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  type: z.enum(["phone", "video", "onsite", "technical"]),
  interviewer: z.string().min(1),
  duration: z.number().int().min(15).max(480).optional(),
  location: z.string().optional(),
});

export const POST = withApiHandler(async (req: Request) => {
  const body = await req.json();
  const result = CreateSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { scheduledAt, ...rest } = result.data;
  const interview = await createInterview({
    ...rest,
    scheduledAt: new Date(scheduledAt),
  });
  revalidatePath("/interviews");
  publish("interview:created", { interviewId: interview.id });
  return Response.json(
    { data: interview },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-cache, no-store" },
    },
  );
});
