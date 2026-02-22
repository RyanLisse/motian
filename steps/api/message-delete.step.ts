import { StepConfig, Handlers } from "motia";
import { deleteMessage } from "../../src/services/messages";

export const config = {
  name: "DeleteMessage",
  description: "Bericht verwijderen",
  triggers: [
    { type: "http", method: "DELETE", path: "/api/berichten/:id" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  try {
    const deleted = await deleteMessage(id);

    if (!deleted) {
      return { status: 404, body: { error: "Bericht niet gevonden" } };
    }

    logger.info(`Bericht ${id} verwijderd`);
    return { status: 200, body: { data: { id, deleted: true } } };
  } catch (err) {
    logger.error(`Fout bij verwijderen bericht ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
