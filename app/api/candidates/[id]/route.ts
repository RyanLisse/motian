import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, eq } from "@/src/db";
import { candidates } from "@/src/db/schema";
import { deleteFile } from "@/src/lib/file-storage";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
});

/** PATCH /api/candidates/[id] — update candidate fields */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Geen velden om bij te werken" }, { status: 400 });
  }

  const [updated] = await db
    .update(candidates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(candidates.id, id))
    .returning({ id: candidates.id, name: candidates.name });

  if (!updated) {
    return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
  }

  return Response.json(updated);
}

/** DELETE /api/candidates/[id] — soft-delete candidate + remove blob file */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  // Get the resume URL before soft-deleting
  const [candidate] = await db
    .select({ id: candidates.id, resumeUrl: candidates.resumeUrl })
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);

  if (!candidate) {
    return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
  }

  // Soft-delete the candidate
  await db
    .update(candidates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(candidates.id, id));

  // Clean up blob storage (fire-and-forget)
  if (candidate.resumeUrl) {
    deleteFile(candidate.resumeUrl).catch((err) =>
      console.error("[Candidates] Failed to delete blob:", err),
    );
  }

  return Response.json({ deleted: true });
}
