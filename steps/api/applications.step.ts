import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import {
  listApplications,
  createApplication,
  getApplicationStats,
} from "../../src/services/applications";

const createSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  matchId: z.string().uuid().optional(),
  source: z.enum(["match", "manual", "import"]).optional(),
  notes: z.string().optional(),
});

export const config = {
  name: "ListOrCreateApplications",
  description: "Sollicitaties ophalen of aanmaken",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/sollicitaties",
      queryParams: [
        { name: "jobId", description: "Filter op vacature-ID" },
        { name: "candidateId", description: "Filter op kandidaat-ID" },
        { name: "stage", description: "Filter op stage" },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
        { name: "stats", description: "true = alleen statistieken" },
      ],
    },
    {
      type: "http",
      method: "POST",
      path: "/api/sollicitaties",
      input: createSchema,
    },
  ],
  flows: ["recruitment-pipeline"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  try {
    if (req.method === "POST") {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return {
          status: 400,
          body: { error: "Ongeldige invoer", details: parsed.error.flatten() },
        };
      }

      const app = await createApplication(parsed.data);
      logger.info(`Sollicitatie aangemaakt: ${app.id}`);
      return { status: 201, body: { data: app } };
    }

    // GET — stats mode
    const rawStats = req.queryParams?.stats;
    const statsFlag = Array.isArray(rawStats) ? rawStats[0] : rawStats;
    if (statsFlag === "true") {
      const stats = await getApplicationStats();
      return { status: 200, body: { data: stats } };
    }

    // GET — list mode
    const rawLimit = req.queryParams?.limit;
    const limit =
      Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50;
    const rawJobId = req.queryParams?.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    const rawCandidateId = req.queryParams?.candidateId;
    const candidateId = Array.isArray(rawCandidateId)
      ? rawCandidateId[0]
      : rawCandidateId;
    const rawStage = req.queryParams?.stage;
    const stage = Array.isArray(rawStage) ? rawStage[0] : rawStage;

    const results = await listApplications({
      jobId,
      candidateId,
      stage,
      limit,
    });
    return { status: 200, body: { data: results, total: results.length } };
  } catch (err) {
    logger.error(`Fout bij sollicitaties: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
