import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { getJobById, updateJob, deleteJob } from "../../src/services/jobs";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  rateMin: z.number().int().optional(),
  rateMax: z.number().int().optional(),
  contractType: z.string().optional(),
  workArrangement: z.string().optional(),
});

export const config = {
  name: "OpdrachtDetail",
  description: "Opdracht ophalen, bijwerken of verwijderen",
  triggers: [
    { type: "http", method: "GET", path: "/api/opdrachten/:id" },
    {
      type: "http",
      method: "PATCH",
      path: "/api/opdrachten/:id",
      input: updateSchema,
    },
    { type: "http", method: "DELETE", path: "/api/opdrachten/:id" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  try {
    if (req.method === "DELETE") {
      const deleted = await deleteJob(id);

      if (!deleted) {
        return { status: 404, body: { error: "Opdracht niet gevonden" } };
      }

      logger.info(`Opdracht ${id} verwijderd (soft delete)`);
      return { status: 200, body: { data: { id, deleted: true } } };
    }

    if (req.method === "PATCH") {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return {
          status: 400,
          body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
        };
      }

      const updated = await updateJob(id, parsed.data);

      if (!updated) {
        return { status: 404, body: { error: "Opdracht niet gevonden" } };
      }

      logger.info(`Opdracht ${id} bijgewerkt`);
      return { status: 200, body: { data: updated } };
    }

    // GET
    const job = await getJobById(id);

    if (!job) {
      return { status: 404, body: { error: "Opdracht niet gevonden" } };
    }

    return { status: 200, body: { data: job } };
  } catch (err) {
    logger.error(`Fout bij opdracht ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
