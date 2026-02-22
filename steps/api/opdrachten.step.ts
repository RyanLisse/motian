import { StepConfig, Handlers } from "motia";
import { listJobs } from "../../src/services/jobs";

export const config = {
  name: "ListOpdrachten",
  description: "Opdrachten ophalen met paginering en filters",
  triggers: [
    {
      type: "http",
      method: "GET",
      path: "/api/opdrachten",
      queryParams: [
        { name: "q", description: "Zoekterm op titel" },
        { name: "platform", description: "Platform filter" },
        { name: "provincie", description: "Filter op provincie" },
        { name: "tariefMin", description: "Minimaal uurtarief" },
        { name: "tariefMax", description: "Maximaal uurtarief" },
        { name: "contractType", description: "Contract type (freelance, interim, vast)" },
        { name: "limit", description: "Aantal resultaten (default: 50)" },
        { name: "offset", description: "Offset voor paginering (default: 0)" },
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

    const rawOffset = req.queryParams?.offset;
    const offset =
      Number(Array.isArray(rawOffset) ? rawOffset[0] : rawOffset) || 0;

    const rawPlatform = req.queryParams?.platform;
    const platform = Array.isArray(rawPlatform)
      ? rawPlatform[0]
      : rawPlatform;

    const rawQ = req.queryParams?.q;
    const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;

    const rawProvincie = req.queryParams?.provincie;
    const province = Array.isArray(rawProvincie) ? rawProvincie[0] : rawProvincie;

    const rawTariefMin = req.queryParams?.tariefMin;
    const rateMin = Number(Array.isArray(rawTariefMin) ? rawTariefMin[0] : rawTariefMin) || undefined;

    const rawTariefMax = req.queryParams?.tariefMax;
    const rateMax = Number(Array.isArray(rawTariefMax) ? rawTariefMax[0] : rawTariefMax) || undefined;

    const rawContractType = req.queryParams?.contractType;
    const contractType = Array.isArray(rawContractType) ? rawContractType[0] : rawContractType;

    const result = await listJobs({ limit, offset, platform, q, province, rateMin, rateMax, contractType });
    return { status: 200, body: result };
  } catch (err) {
    logger.error(`Fout bij ophalen opdrachten: ${String(err)}`);
    return { status: 500, body: { error: "Interne serverfout" } };
  }
};
