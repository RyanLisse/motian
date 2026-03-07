import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { updateCandidateMatchingStatus } from "@/src/services/candidates";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const candidate = await updateCandidateMatchingStatus(id, "no_match");
    if (!candidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }

    revalidatePath("/matching");
    revalidatePath("/professionals");
    revalidatePath(`/professionals/${id}`);

    return Response.json({
      candidate,
      matchingStatus: candidate.matchingStatus,
    });
  },
  { logPrefix: "POST /api/kandidaten/[id]/geen-match error" },
);
