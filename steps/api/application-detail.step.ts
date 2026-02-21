import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import {
  getApplicationById,
  updateApplicationStage,
} from "../../src/services/applications";

const updateSchema = z.object({
  stage: z.enum([
    "new",
    "screening",
    "interview",
    "offer",
    "hired",
    "rejected",
  ]),
  notes: z.string().optional(),
});

export const config = {
  name: "ApplicationDetail",
  description: "Sollicitatie ophalen of stage wijzigen",
  triggers: [
    { type: "http", method: "GET", path: "/api/sollicitaties/:id" },
    {
      type: "http",
      method: "PATCH",
      path: "/api/sollicitaties/:id",
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

      const updated = await updateApplicationStage(
        id,
        parsed.data.stage,
        parsed.data.notes,
      );
      if (!updated) {
        return { status: 404, body: { error: "Sollicitatie niet gevonden" } };
      }

      logger.info(`Sollicitatie ${id} bijgewerkt naar ${parsed.data.stage}`);
      return { status: 200, body: { data: updated } };
    }

    // GET
    const app = await getApplicationById(id);
    if (!app) {
      return { status: 404, body: { error: "Sollicitatie niet gevonden" } };
    }
    return { status: 200, body: { data: app } };
  } catch (err) {
    logger.error(`Fout bij sollicitatie detail: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
