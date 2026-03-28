import { withApiHandler } from "@/src/lib/api-handler";
import { a2uiEnvelopeSchema } from "@/src/schemas/a2ui";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withApiHandler(
  async (req: Request, { params }: RouteParams) => {
    const { id } = await params;
    const body = await req.json();
    const parsed = a2uiEnvelopeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldig A2UI-bericht", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // TODO: inject envelope into chat session message stream
    return Response.json(
      {
        ok: true,
        sessionId: id,
        component: parsed.data.component,
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "chat-sessies/[id]/a2ui POST", rateLimit: { interval: 60_000, limit: 30 } },
);
