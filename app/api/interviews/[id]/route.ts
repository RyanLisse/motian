import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { deleteInterview, getInterviewById, updateInterview } from "@/src/services/interviews";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const interview = await getInterviewById(id);
    if (!interview) {
      return Response.json({ error: "Interview niet gevonden" }, { status: 404 });
    }
    return Response.json(
      { data: interview },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  },
  { logPrefix: "GET /api/interviews/[id] error" },
);

const PatchSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  feedback: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const PATCH = withApiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await req.json();
    const result = PatchSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
    }

    const { interview, emptyUpdate } = await updateInterview(id, result.data);
    if (emptyUpdate) {
      return Response.json({ error: "Geen geldige velden opgegeven" }, { status: 400 });
    }
    if (!interview) {
      return Response.json({ error: "Interview niet gevonden" }, { status: 404 });
    }
    revalidatePath("/interviews");
    return Response.json(
      { data: interview },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "PATCH /api/interviews/[id] error" },
);

export const DELETE = withApiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deleted = await deleteInterview(id);
    if (!deleted) {
      return Response.json({ error: "Interview niet gevonden" }, { status: 404 });
    }
    revalidatePath("/interviews");
    return Response.json(
      { data: { id } },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "DELETE /api/interviews/[id] error" },
);
