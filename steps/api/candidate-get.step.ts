import { StepConfig, Handlers } from "motia";
import { getCandidateById } from "../../src/services/candidates";

export const config = {
  name: "GetCandidate",
  description: "Kandidaat ophalen op ID",
  triggers: [
    { type: "http", method: "GET", path: "/api/kandidaten/:id" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { id } = req.pathParams;

  try {
    const candidate = await getCandidateById(id);

    if (!candidate) {
      return { status: 404, body: { error: "Kandidaat niet gevonden" } };
    }

    return { status: 200, body: { data: candidate } };
  } catch (err) {
    logger.error(`Fout bij ophalen kandidaat ${id}: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
