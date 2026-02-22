import { listMatches } from "@/src/services/matches";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const data = await listMatches({
      jobId: searchParams.get("jobId") ?? undefined,
      candidateId: searchParams.get("candidateId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return Response.json({ data, total: data.length });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
