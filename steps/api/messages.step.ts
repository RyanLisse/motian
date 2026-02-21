import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { listMessages, createMessage } from "../../src/services/messages";

const createSchema = z.object({
  applicationId: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  channel: z.enum(["email", "phone", "platform"]),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export const config = {
  name: "ListOrCreateMessages",
  description: "Berichten ophalen of versturen",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/berichten",
      queryParams: [
        { name: "applicationId", description: "Filter op sollicitatie-ID" },
        {
          name: "direction",
          description: "Filter op richting (inbound/outbound)",
        },
        {
          name: "channel",
          description: "Filter op kanaal (email/phone/platform)",
        },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
      ],
    },
    {
      type: "http",
      method: "POST",
      path: "/api/berichten",
      input: createSchema,
    },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  try {
    if (req.method === "POST") {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return {
          status: 400,
          body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
        };
      }

      const msg = await createMessage(parsed.data);
      if (!msg) {
        return {
          status: 400,
          body: { error: "Ongeldig kanaal of richting" },
        };
      }

      logger.info(`Bericht aangemaakt: ${msg.id}`);
      return { status: 201, body: { data: msg } };
    }

    // GET
    const rawLimit = req.queryParams?.limit;
    const limit =
      Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50;
    const rawAppId = req.queryParams?.applicationId;
    const applicationId = Array.isArray(rawAppId) ? rawAppId[0] : rawAppId;
    const rawDir = req.queryParams?.direction;
    const direction = Array.isArray(rawDir) ? rawDir[0] : rawDir;
    const rawChannel = req.queryParams?.channel;
    const channel = Array.isArray(rawChannel) ? rawChannel[0] : rawChannel;

    const results = await listMessages({
      applicationId,
      direction,
      channel,
      limit,
    });
    return { status: 200, body: { data: results, total: results.length } };
  } catch (err) {
    logger.error(`Fout bij berichten: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
