import { StepConfig, Handlers } from "motia";
import { eraseCandidateData } from "../../src/services/gdpr";

export const config = {
  name: "GdprDelete",
  description:
    "GDPR recht op vergetelheid — alle kandidaatdata verwijderen (Art. 17)",
  triggers: [
    {
      type: "http",
      method: "DELETE",
      path: "/api/gdpr/verwijder/:kandidaatId",
    },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { kandidaatId } = req.pathParams;

  try {
    const result = await eraseCandidateData(kandidaatId);

    if (!result.deletedCandidate) {
      return { status: 404, body: { error: "Kandidaat niet gevonden" } };
    }

    logger.info(
      `GDPR erasure voltooid voor kandidaat ${kandidaatId}: ${result.deletedApplications} sollicitaties, ${result.deletedInterviews} interviews, ${result.deletedMessages} berichten, ${result.deletedMatches} matches verwijderd`,
    );

    return { status: 200, body: { data: result } };
  } catch (err) {
    logger.error(
      `Fout bij GDPR verwijdering voor kandidaat ${kandidaatId}: ${String(err)}`,
    );
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
