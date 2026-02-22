import { StepConfig, Handlers } from "motia";
import { deleteApplication } from "../../src/services/applications";

export const config = {
  name: "DeleteApplication",
  description: "Sollicitatie verwijderen (soft delete)",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/sollicitaties/:id" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  try {
    const deleted = await deleteApplication(id);

    if (!deleted) {
      return { status: 404, body: { error: "Sollicitatie niet gevonden" } };
    }

    logger.info(`Sollicitatie ${id} verwijderd (soft delete)`);
    return { status: 200, body: { data: { id, deleted: true } } };
  } catch (err) {
    logger.error(`Fout bij verwijderen sollicitatie ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
