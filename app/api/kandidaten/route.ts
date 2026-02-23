import type { NextRequest } from "next/server";
import { z } from "zod";
import { createCandidate, listCandidates, searchCandidates } from "@/src/services/candidates";

export const dynamic = "force-dynamic";

const createCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get("q") ?? undefined;
    const limit = parseInt(params.get("limit") ?? "50", 10);

    const data = q ? await searchCandidates({ query: q, limit }) : await listCandidates(limit);

    return Response.json({ data, total: data.length });
  } catch (error) {
    console.error("GET /api/kandidaten error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const candidate = await createCandidate(parsed.data);
    return Response.json({ data: candidate }, { status: 201 });
  } catch (error) {
    console.error("POST /api/kandidaten error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
