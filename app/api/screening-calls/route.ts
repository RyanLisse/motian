import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import {
  createScreeningCall,
  listScreeningCalls,
} from "@/src/services/screening-calls";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  initiatedBy: z.enum(["recruiter", "ai_agent"]).default("recruiter"),
});

export const POST = withApiHandler(async (request: Request) => {
  try {
    const body = await request.json();
    const input = createSchema.parse(body);
    const call = await createScreeningCall(input);
    return Response.json({ data: call }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Ongeldige invoer", details: error.errors },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
});

export const GET = withApiHandler(async (request: Request) => {
  const candidateId = new URL(request.url).searchParams.get("candidateId");
  if (!candidateId) {
    return Response.json(
      { error: "candidateId is required" },
      { status: 400 },
    );
  }
  const calls = await listScreeningCalls(candidateId);
  return Response.json({ data: calls });
});
