import type { NextRequest } from "next/server";
import { z } from "zod";
import { deleteCandidate, getCandidateById, updateCandidate } from "@/src/services/candidates";

export const dynamic = "force-dynamic";

const updateCandidateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const candidate = await getCandidateById(id);
    if (!candidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: candidate });
  } catch (error) {
    console.error("GET /api/kandidaten/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const candidate = await updateCandidate(id, parsed.data);
    if (!candidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: candidate });
  } catch (error) {
    console.error("PATCH /api/kandidaten/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteCandidate(id);
    if (!deleted) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error("DELETE /api/kandidaten/[id] error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
