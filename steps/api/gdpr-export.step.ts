import { StepConfig, Handlers } from "motia";
import { exportCandidateData } from "../../src/services/gdpr";

export const config = {
  name: "GdprExport",
  description: "GDPR data-export voor kandidaat (Art. 15 — recht op inzage)",
  triggers: [
    { type: "http", method: "GET", path: "/api/gdpr/export/:kandidaatId" },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { kandidaatId } = req.pathParams;

  try {
    const data = await exportCandidateData(kandidaatId);

    if (!data) {
      return { status: 404, body: { error: "Kandidaat niet gevonden" } };
    }

    logger.info(`GDPR data-export uitgevoerd voor kandidaat ${kandidaatId}`);
    return { status: 200, body: { data } };
  } catch (err) {
    logger.error(
      `Fout bij GDPR export voor kandidaat ${kandidaatId}: ${String(err)}`,
    );
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
