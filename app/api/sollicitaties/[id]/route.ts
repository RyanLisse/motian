import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  deleteApplication,
  getApplicationById,
  updateApplicationStage,
} from "@/src/services/applications";

export const dynamic = "force-dynamic";

const updateApplicationSchema = z.object({
  stage: z.enum(["new", "screening", "interview", "offer", "hired", "rejected"]),
  notes: z.string().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const application = await getApplicationById(id);
    if (!application) {
      return Response.json({ error: "Sollicitatie niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: application });
  } catch (error) {
    console.error("GET /api/sollicitaties/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const application = await updateApplicationStage(id, parsed.data.stage, parsed.data.notes);
    if (!application) {
      return Response.json({ error: "Sollicitatie niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: application });
  } catch (error) {
    console.error("PATCH /api/sollicitaties/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteApplication(id);
    if (!deleted) {
      return Response.json({ error: "Sollicitatie niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error("DELETE /api/sollicitaties/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
