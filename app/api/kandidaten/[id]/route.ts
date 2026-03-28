import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { deleteCandidate, getCandidateById, updateCandidate } from "@/src/services/candidates";
import { withCandidateCanonicalSkills } from "@/src/services/esco";

export const dynamic = "force-dynamic";

const updateCandidateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  headline: z.string().optional(),
  hourlyRate: z.number().optional(),
  availability: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const candidate = await getCandidateById(id);
    if (!candidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
    return Response.json(
      { data: await withCandidateCanonicalSkills(candidate) },
      {
        headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
      },
    );
  },
  { logPrefix: "GET /api/kandidaten/[id] error" },
);

export const PATCH = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
    revalidatePath("/kandidaten");
    return Response.json(
      { data: await withCandidateCanonicalSkills(candidate) },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "PATCH /api/kandidaten/[id] error" },
);

export const DELETE = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deleted = await deleteCandidate(id);
    if (!deleted) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
    revalidatePath("/kandidaten");
    return Response.json(
      { data: { id, deleted: true } },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "DELETE /api/kandidaten/[id] error" },
);
