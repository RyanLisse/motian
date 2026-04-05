import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { buildCommercialCvDraft } from "@/src/services/commercial-cv-generation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1).optional(),
});

/**
 * POST /api/commercieel-cv — recruiter commercial CV draft (markdown).
 */
export const POST = withApiHandler(
  async (req: Request) => {
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
      const draft = await buildCommercialCvDraft(parsed.data);
      return Response.json(
        { data: draft },
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
  { logPrefix: "POST /api/commercieel-cv error" },
);
