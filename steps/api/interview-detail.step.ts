import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import {
  getInterviewById,
  updateInterview,
} from "../../src/services/interviews";

const updateSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  feedback: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const config = {
  name: "InterviewDetail",
  description: "Interview ophalen of bijwerken",
  triggers: [
    { type: "http", method: "GET", path: "/api/interviews/:id" },
    {
      type: "http",
      method: "PATCH",
      path: "/api/interviews/:id",
      input: updateSchema,
    },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  try {
    const id = req.pathParams?.id;
    if (!id) {
      return { status: 400, body: { error: "ID is verplicht" } };
    }

    if (req.method === "PATCH") {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return {
          status: 400,
          body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
        };
      }

      const { interview, emptyUpdate } = await updateInterview(
        id,
        parsed.data,
      );
      if (emptyUpdate) {
        return {
          status: 400,
          body: { error: "Geen geldige velden opgegeven" },
        };
      }
      if (!interview) {
        return { status: 404, body: { error: "Interview niet gevonden" } };
      }

      logger.info(`Interview ${id} bijgewerkt`);
      return { status: 200, body: { data: interview } };
    }

    // GET
    const interview = await getInterviewById(id);
    if (!interview) {
      return { status: 404, body: { error: "Interview niet gevonden" } };
    }
    return { status: 200, body: { data: interview } };
  } catch (err) {
    logger.error(`Fout bij interview detail: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
