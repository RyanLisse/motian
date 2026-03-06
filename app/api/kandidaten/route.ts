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
import { withCandidateCanonicalSkills, withCandidatesCanonicalSkills } from "@/src/services/esco";

export const dynamic = "force-dynamic";

const createCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  source: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  headline: z.string().optional(),
  hourlyRate: z.number().int().positive().optional(),
  availability: z.enum(["direct", "1_maand", "3_maanden"]).optional(),
  notes: z.string().optional(),
  experience: z
    .array(z.object({ title: z.string(), company: z.string(), duration: z.string() }))
    .optional(),
  education: z
    .array(z.object({ school: z.string(), degree: z.string(), duration: z.string() }))
    .optional(),
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
  const dataWithCanonicalSkills = await withCandidatesCanonicalSkills(data);

  return Response.json(paginatedResponse(dataWithCanonicalSkills, total, { page, limit, offset }));
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
  revalidatePath("/kandidaten");
  return Response.json({ data: await withCandidateCanonicalSkills(candidate) }, { status: 201 });
});
