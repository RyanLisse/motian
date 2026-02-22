import { StepConfig, Handlers } from "motia";
import {
  findExpiredRetentionCandidates,
  eraseCandidateData,
} from "../../src/services/gdpr";

export const config = {
  name: "DataRetentionCheck",
  description:
    "Dagelijkse controle op verlopen dataretentie — verwijdert automatisch",
  triggers: [{ type: "cron", expression: "0 0 2 * * *" }], // Elke dag om 02:00
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (_input, { logger }) => {
  logger.info("Data-retentie controle gestart");

  const expired = await findExpiredRetentionCandidates();

  if (expired.length === 0) {
    logger.info("Geen kandidaten met verlopen dataretentie gevonden");
    return;
  }

  logger.info(
    `${expired.length} kandidaten met verlopen dataretentie gevonden`,
  );

  let totalErased = 0;
  const errors: string[] = [];

  for (const candidate of expired) {
    try {
      const result = await eraseCandidateData(candidate.id);
      if (result.deletedCandidate) {
        totalErased++;
        logger.info(
          `Kandidaat "${candidate.name}" (${candidate.id}) verwijderd — retentie verlopen op ${candidate.dataRetentionUntil.toISOString()}`,
        );
      }
    } catch (err) {
      const msg = `Fout bij verwijderen kandidaat ${candidate.id}: ${String(err)}`;
      errors.push(msg);
      logger.error(msg);
    }
  }

  logger.info(
    `Data-retentie controle voltooid: ${totalErased}/${expired.length} kandidaten verwijderd${errors.length > 0 ? `, ${errors.length} fouten` : ""}`,
  );
};
