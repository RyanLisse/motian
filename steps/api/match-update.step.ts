import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { updateMatchStatus } from "../../src/services/matches";

const updateSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewedBy: z.string().optional(),
});

export const config = {
  name: "UpdateMatchStatus",
  description: "Match status bijwerken (goedkeuren of afwijzen)",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/matches/:id",
      input: updateSchema,
    },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
    };
  }

  try {
    const updated = await updateMatchStatus(id, parsed.data);

    if (!updated) {
      return { status: 404, body: { error: "Match niet gevonden" } };
    }

    logger.info(`Match ${id} status: ${parsed.data.status}`);
    return { status: 200, body: { data: updated } };
  } catch (err) {
    logger.error(`Fout bij bijwerken match ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
