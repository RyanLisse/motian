import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { countMessages, createMessage, listMessages } from "@/src/services/messages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(
      1,
      parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? searchParams.get("perPage") ?? "50", 10)),
    );
    const offset = (page - 1) * limit;
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
    return Response.json({
      data,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  applicationId: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  channel: z.enum(["email", "phone", "platform"]),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function POST(req: Request) {
  try {
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
    return Response.json({ data: message }, { status: 201 });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
