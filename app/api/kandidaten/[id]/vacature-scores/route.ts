import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { scoreVacaturesForCandidate } from "@/src/services/job-candidate-vacature-fit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1).max(30),
});

/**
 * POST /api/kandidaten/[id]/vacature-scores — match scores vs explicit job ids.
 */
export const POST = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: candidateId } = await params;
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        {
          status: 400,
        },
      );
    }

    try {
      const scores = await scoreVacaturesForCandidate(candidateId, parsed.data.jobIds);
      return Response.json(
        { data: { scores } },
        { headers: { "Cache-Control": "private, no-cache, no-store" } },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Onbekende fout";
      if (message.includes("niet gevonden")) {
        return Response.json({ error: message }, { status: 404 });
      }
      throw e;
    }
  },
  { logPrefix: "POST /api/kandidaten/[id]/vacature-scores error" },
);
