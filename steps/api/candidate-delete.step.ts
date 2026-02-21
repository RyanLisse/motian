import { StepConfig, Handlers } from "motia";
import { deleteCandidate } from "../../src/services/candidates";

export const config = {
  name: "DeleteCandidate",
  description: "Kandidaat verwijderen (soft delete)",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/kandidaten/:id" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  try {
    const deleted = await deleteCandidate(id);

    if (!deleted) {
      return { status: 404, body: { error: "Kandidaat niet gevonden" } };
    }

    logger.info(`Kandidaat ${id} verwijderd (soft delete)`);
    return { status: 200, body: { data: { id, deleted: true } } };
  } catch (err) {
    logger.error(`Fout bij verwijderen kandidaat ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
