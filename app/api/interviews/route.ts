import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import {
  countInterviews,
  createInterview,
  getUpcomingInterviews,
  listInterviews,
} from "@/src/services/interviews";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("upcoming") === "true") {
      const data = await getUpcomingInterviews();
      return Response.json({
        data,
        total: data.length,
        page: 1,
        perPage: data.length,
        totalPages: 1,
      });
    }

    const page = Math.max(
      1,
      parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? searchParams.get("perPage") ?? "50", 10)),
    );
    const offset = (page - 1) * limit;
    const applicationId = searchParams.get("applicationId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const data = await listInterviews({
      applicationId,
      status,
      limit,
      offset,
    });
    const total = await countInterviews({ applicationId, status });
    return Response.json({
      data,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  type: z.enum(["phone", "video", "onsite", "technical"]),
  interviewer: z.string().min(1),
  duration: z.number().int().min(15).max(480).optional(),
  location: z.string().optional(),
});

export async function POST(req: Request) {
  try {
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
    return Response.json({ data: interview }, { status: 201 });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
