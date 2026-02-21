import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import { updateCandidate } from "../../src/services/candidates";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
});

export const config = {
  name: "UpdateCandidate",
  description: "Kandidaat bijwerken",
  triggers: [
    {
      type: "http",
      method: "PATCH",
      path: "/api/kandidaten/:id",
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
    const updated = await updateCandidate(id, parsed.data);

    if (!updated) {
      return { status: 404, body: { error: "Kandidaat niet gevonden" } };
    }

    logger.info(`Kandidaat ${id} bijgewerkt`);
    return { status: 200, body: { data: updated } };
  } catch (err) {
    logger.error(`Fout bij bijwerken kandidaat ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
