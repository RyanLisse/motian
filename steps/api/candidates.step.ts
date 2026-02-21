import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import {
  listCandidates,
  searchCandidates,
  createCandidate,
} from "../../src/services/candidates";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
});

export const config = {
  name: "ListOrCreateCandidates",
  description: "Kandidaten ophalen of aanmaken",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/kandidaten",
      queryParams: [
        { name: "q", description: "Zoekterm" },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
      ],
    },
    {
      type: "http",
      method: "POST",
      path: "/api/kandidaten",
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

      const candidate = await createCandidate(parsed.data);
      logger.info(`Kandidaat aangemaakt: ${candidate.id}`);
      return { status: 201, body: { data: candidate } };
    }

    // GET
    const rawLimit = req.queryParams?.limit;
    const limit =
      Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit) || 50;
    const rawQ = req.queryParams?.q;
    const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;

    if (q) {
      const results = await searchCandidates({ query: q, limit });
      return { status: 200, body: { data: results, total: results.length } };
    }

    const candidates = await listCandidates(limit);
    return { status: 200, body: { data: candidates, total: candidates.length } };
  } catch (err) {
    logger.error(`Fout bij kandidaten: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
