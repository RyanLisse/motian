import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { updateMatchStatus } from "@/src/services/matches";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewedBy: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = PatchSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
    }

    const match = await updateMatchStatus(id, result.data.status, result.data.reviewedBy);
    if (!match) {
      return Response.json({ error: "Match niet gevonden" }, { status: 404 });
    }
    revalidatePath("/matching");
    publish("match:updated", { matchId: id, status: result.data.status });
    return Response.json({ data: match });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
