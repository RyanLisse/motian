import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import {
  listInterviews,
  createInterview,
  getUpcomingInterviews,
} from "../../src/services/interviews";

const createSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  type: z.enum(["phone", "video", "onsite", "technical"]),
  interviewer: z.string().min(1),
  duration: z.number().min(15).max(480).optional(),
  location: z.string().optional(),
});

export const config = {
  name: "ListOrCreateInterviews",
  description: "Interviews ophalen of inplannen",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/interviews",
      queryParams: [
        { name: "applicationId", description: "Filter op sollicitatie-ID" },
        { name: "status", description: "Filter op status" },
        { name: "upcoming", description: "true = alleen aankomende" },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
      ],
    },
    {
      type: "http",
      method: "POST",
      path: "/api/interviews",
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

      const interview = await createInterview({
        ...parsed.data,
        scheduledAt: new Date(parsed.data.scheduledAt),
      });
      logger.info(`Interview ingepland: ${interview.id}`);
      return { status: 201, body: { data: interview } };
    }

    // GET — upcoming mode
    const rawUpcoming = req.queryParams?.upcoming;
    const upcoming =
      (Array.isArray(rawUpcoming) ? rawUpcoming[0] : rawUpcoming) === "true";
    if (upcoming) {
      const results = await getUpcomingInterviews();
      return { status: 200, body: { data: results, total: results.length } };
    }

    // GET — list mode
    const rawLimit = req.queryParams?.limit;
    const limit =
      Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50;
    const rawAppId = req.queryParams?.applicationId;
    const applicationId = Array.isArray(rawAppId) ? rawAppId[0] : rawAppId;
    const rawStatus = req.queryParams?.status;
    const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

    const results = await listInterviews({ applicationId, status, limit });
    return { status: 200, body: { data: results, total: results.length } };
  } catch (err) {
    logger.error(`Fout bij interviews: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
