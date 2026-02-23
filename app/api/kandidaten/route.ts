import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  countCandidates,
  createCandidate,
  listCandidates,
  searchCandidates,
} from "@/src/services/candidates";

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
    const location = params.get("locatie") ?? params.get("location") ?? undefined;
    const page = Math.max(1, parseInt(params.get("pagina") ?? params.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(params.get("limit") ?? params.get("perPage") ?? "50", 10)),
    );
    const offset = (page - 1) * limit;

    const useSearch = Boolean(q || location);
    const data = useSearch
      ? await searchCandidates({ query: q, location, limit, offset })
      : await listCandidates({ limit, offset });
    const total = useSearch
      ? await countCandidates({ query: q, location })
      : await countCandidates();

    return Response.json({
      data,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    });
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
    revalidatePath("/professionals");
    return Response.json({ data: candidate }, { status: 201 });
  } catch (error) {
    console.error("POST /api/kandidaten error:", error);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
