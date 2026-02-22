import { z } from "zod";
import { listInterviews, createInterview, getUpcomingInterviews } from "@/src/services/interviews";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("upcoming") === "true") {
      const data = await getUpcomingInterviews();
      return Response.json({ data, total: data.length });
    }

    const data = await listInterviews({
      applicationId: searchParams.get("applicationId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return Response.json({ data, total: data.length });
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
    return Response.json({ data: interview }, { status: 201 });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
