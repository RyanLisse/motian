import type { NextRequest } from "next/server";
import { z } from "zod";
import { deleteJob, getJobById, updateJob } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

const updateJobSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  rateMin: z.number().optional(),
  rateMax: z.number().optional(),
  contractType: z.string().optional(),
  workArrangement: z.string().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJobById(id);
    if (!job) {
      return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: job });
  } catch (error) {
    console.error("GET /api/opdrachten/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const job = await updateJob(id, parsed.data);
    if (!job) {
      return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: job });
  } catch (error) {
    console.error("PATCH /api/opdrachten/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteJob(id);
    if (!deleted) {
      return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error("DELETE /api/opdrachten/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
