import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { publish } from "@/src/lib/event-bus";
import {
  deleteApplication,
  getApplicationById,
  updateApplicationNotes,
  updateApplicationStage,
} from "@/src/services/applications";

export const dynamic = "force-dynamic";

const updateApplicationSchema = z
  .object({
    stage: z.enum(["new", "screening", "interview", "offer", "hired", "rejected"]).optional(),
    notes: z.string().optional(),
  })
  .refine((body) => body.stage !== undefined || body.notes !== undefined, {
    message: "Minstens één van stage of notes is verplicht",
  });

export const GET = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const application = await getApplicationById(id);
    if (!application) {
      return Response.json({ error: "Sollicitatie niet gevonden" }, { status: 404 });
    }
    return Response.json(
      { data: application },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  },
  { logPrefix: "GET /api/sollicitaties/[id] error" },
);

export const PATCH = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { stage, notes } = parsed.data;
    const application =
      stage !== undefined
        ? await updateApplicationStage(id, stage, notes)
        : notes !== undefined
          ? await updateApplicationNotes(id, notes)
          : null;
    if (!application) {
      return Response.json({ error: "Sollicitatie niet gevonden" }, { status: 404 });
    }
    revalidatePath("/pipeline");
    publish("application:updated", { applicationId: id, stage: parsed.data.stage });
    return Response.json(
      { data: application },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "PATCH /api/sollicitaties/[id] error" },
);

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deleted = await deleteApplication(id);
    if (!deleted) {
      return Response.json({ error: "Sollicitatie niet gevonden" }, { status: 404 });
    }
    revalidatePath("/pipeline");
    return Response.json(
      { data: { id, deleted: true } },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "DELETE /api/sollicitaties/[id] error" },
);
