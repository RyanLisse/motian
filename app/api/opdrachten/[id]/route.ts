import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { withJobCanonicalSkills } from "@/src/services/esco";
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

export const GET = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const job = await getJobById(id);
    if (!job) {
      return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: await withJobCanonicalSkills(job) });
  },
  { logPrefix: "GET /api/opdrachten/[id] error" },
);

export const PATCH = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
    return Response.json({ data: await withJobCanonicalSkills(job) });
  },
  { logPrefix: "PATCH /api/opdrachten/[id] error" },
);

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const archived = await deleteJob(id);
    if (!archived) {
      return Response.json({ error: "Opdracht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id, archived: true } });
  },
  { logPrefix: "DELETE /api/opdrachten/[id] error" },
);
