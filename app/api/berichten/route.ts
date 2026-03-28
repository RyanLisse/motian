import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { publish } from "@/src/lib/event-bus";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { countMessages, createMessage, listMessages } from "@/src/services/messages";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = parsePagination(searchParams);
  const applicationId = searchParams.get("applicationId") ?? undefined;
  const direction = searchParams.get("direction") ?? undefined;
  const channel = searchParams.get("channel") ?? undefined;

  const data = await listMessages({
    applicationId,
    direction,
    channel,
    limit,
    offset,
  });
  const total = await countMessages({ applicationId, direction, channel });
  return Response.json(paginatedResponse(data, total, { page, limit, offset }), {
    headers: { "Cache-Control": "no-store" },
  });
});

const CreateSchema = z.object({
  applicationId: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  channel: z.enum(["email", "phone", "platform"]),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export const POST = withApiHandler(async (req: Request) => {
  const body = await req.json();
  const result = CreateSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const message = await createMessage(result.data);
  if (!message) {
    return Response.json({ error: "Ongeldig kanaal of richting" }, { status: 400 });
  }
  revalidatePath("/messages");
  publish("message:created", { messageId: message.id, direction: result.data.direction });
  return Response.json(
    { data: message },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-cache, no-store" },
    },
  );
});
