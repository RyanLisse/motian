import { StepConfig, Handlers } from "motia";
import { deleteInterview } from "../../src/services/interviews";

export const config = {
  name: "DeleteInterview",
  description: "Interview verwijderen",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/interviews/:id" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  try {
    const deleted = await deleteInterview(id);

    if (!deleted) {
      return { status: 404, body: { error: "Interview niet gevonden" } };
    }

    logger.info(`Interview ${id} verwijderd`);
    return { status: 200, body: { data: { id, deleted: true } } };
  } catch (err) {
    logger.error(`Fout bij verwijderen interview ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
