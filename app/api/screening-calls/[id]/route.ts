import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import {
  getScreeningCall,
  updateScreeningCall,
} from "@/src/services/screening-calls";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const call = await getScreeningCall(id);
    if (!call) {
      return Response.json({ error: "Niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: call });
  },
);

const updateSchema = z.object({
  status: z
    .enum(["pending", "ringing", "active", "completed", "failed", "cancelled"])
    .optional(),
  transcript: z.array(z.unknown()).optional(),
  callSummary: z.string().optional(),
  callNotes: z.string().optional(),
  callDurationSeconds: z.number().optional(),
  candidateSentiment: z.enum(["positive", "neutral", "negative"]).optional(),
  recommendedNextStep: z.enum(["proceed", "reject", "follow_up"]).optional(),
  screeningQuestions: z.array(z.unknown()).optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

export const PATCH = withApiHandler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const body = await request.json();
      const data = updateSchema.parse(body);
      const updated = await updateScreeningCall(id, {
        ...data,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      });
      if (!updated) {
        return Response.json({ error: "Niet gevonden" }, { status: 404 });
      }
      return Response.json({ data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Response.json(
          { error: "Ongeldige invoer", details: error.errors },
          { status: 400 },
        );
      }
      return Response.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
);
