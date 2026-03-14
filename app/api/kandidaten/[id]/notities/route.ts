import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { addNoteToCandidate } from "@/src/services/candidates";

export const dynamic = "force-dynamic";

const addNoteSchema = z.object({
  note: z.string().min(1, "Notitie mag niet leeg zijn"),
});

export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = addNoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const candidate = await addNoteToCandidate(id, parsed.data.note);
    if (!candidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
    revalidatePath("/kandidaten");
    return Response.json({ data: { notes: candidate.notes } });
  },
  { logPrefix: "POST /api/kandidaten/[id]/notities error" },
);
