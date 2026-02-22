import { z } from "zod";
import { listMessages, createMessage } from "@/src/services/messages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const data = await listMessages({
      applicationId: searchParams.get("applicationId") ?? undefined,
      direction: searchParams.get("direction") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return Response.json({ data, total: data.length });
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
    return Response.json({ data: message }, { status: 201 });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
