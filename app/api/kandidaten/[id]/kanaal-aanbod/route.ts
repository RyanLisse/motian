import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { prepareChannelOfferHandoff } from "@/src/services/channel-offer-handoff";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  channelHint: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/kandidaten/[id]/kanaal-aanbod — prepare recruiter handoff for external channels/sources.
 */
export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await prepareChannelOfferHandoff({
      candidateId: id,
      channelHint: parsed.data.channelHint,
      notes: parsed.data.notes,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 404 });
    }

    return Response.json(
      { data: result },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "POST /api/kandidaten/[id]/kanaal-aanbod error" },
);
