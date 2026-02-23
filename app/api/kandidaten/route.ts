import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
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

export const GET = withApiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? undefined;
  const location = params.get("locatie") ?? params.get("location") ?? undefined;
  const { page, limit, offset } = parsePagination(params);

  const useSearch = Boolean(q || location);
  const data = useSearch
    ? await searchCandidates({ query: q, location, limit, offset })
    : await listCandidates({ limit, offset });
  const total = useSearch ? await countCandidates({ query: q, location }) : await countCandidates();

  return Response.json(paginatedResponse(data, total, { page, limit, offset }));
});

export const POST = withApiHandler(async (request: Request) => {
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
});
