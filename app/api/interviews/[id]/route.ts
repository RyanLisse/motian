import { z } from "zod";
import { getInterviewById, updateInterview, deleteInterview } from "@/src/services/interviews";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const interview = await getInterviewById(id);
    if (!interview) {
      return Response.json({ error: "Interview niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: interview });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

const PatchSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  feedback: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
    return Response.json({ data: interview });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteInterview(id);
    if (!deleted) {
      return Response.json({ error: "Interview niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id } });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
