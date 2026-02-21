import { StepConfig, Handlers } from "motia";
import { listMatches } from "../../src/services/matches";

export const config = {
  name: "ListMatches",
  description: "Matches ophalen met optionele filters",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/matches",
      queryParams: [
        { name: "jobId", description: "Filter op vacature" },
        { name: "candidateId", description: "Filter op kandidaat" },
        { name: "status", description: "Filter op status" },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
      ],
    },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  try {
    const rawLimit = req.queryParams?.limit;
    const limit =
      Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50;

    const rawJobId = req.queryParams?.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

    const rawCandidateId = req.queryParams?.candidateId;
    const candidateId = Array.isArray(rawCandidateId)
      ? rawCandidateId[0]
      : rawCandidateId;

    const rawStatus = req.queryParams?.status;
    const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

    const matches = await listMatches({ jobId, candidateId, status, limit });

    return { status: 200, body: { data: matches, total: matches.length } };
  } catch (err) {
    logger.error(`Fout bij ophalen matches: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
