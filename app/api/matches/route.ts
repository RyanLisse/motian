import { countMatches, listMatches } from "@/src/services/matches";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(
      1,
      parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? searchParams.get("perPage") ?? "50", 10)),
    );
    const offset = (page - 1) * limit;
    const jobId = searchParams.get("jobId") ?? undefined;
    const candidateId = searchParams.get("candidateId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const data = await listMatches({
      jobId,
      candidateId,
      status,
      limit,
      offset,
    });
    const total = await countMatches({ jobId, candidateId, status });
    return Response.json({
      data,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
