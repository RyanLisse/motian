import { isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  candidateSkills,
  candidates,
  escoSkills,
  jobMatches,
  jobSkills,
  jobs,
} from "@/src/db/schema";
import { withApiHandler } from "@/src/lib/api-handler";
import {
  buildCandidateNode,
  buildEdgesFromMatches,
  buildEdgesFromSkills,
  buildJobNode,
  buildSkillNode,
  filterEdgesByNodes,
  filterNodesByType,
} from "@/src/lib/graph-data";
import type { GraphNodeType, GraphResponse } from "@/src/types/graph";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;

// Zod validation for query parameters
const graphQuerySchema = z.object({
  types: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [] as GraphNodeType[];
      return val
        .split(",")
        .filter((t): t is GraphNodeType => ["job", "candidate", "skill"].includes(t));
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const n = val ? Number.parseInt(val, 10) : DEFAULT_LIMIT;
      return Number.isNaN(n) || n < 1 ? DEFAULT_LIMIT : Math.min(n, 500);
    }),
});

export const GET = withApiHandler(
  async (req: Request) => {
    const { searchParams } = new URL(req.url);
    const params = graphQuerySchema.safeParse({
      types: searchParams.get("types") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!params.success) {
      return Response.json(
        { error: "Ongeldige queryparameters", details: params.error.flatten() },
        { status: 400 },
      );
    }

    const { types, limit } = params.data;

    // Fetch top N+1 matches to determine hasMore
    const fetchLimit = limit + 1;

    const matchRows = await db
      .select({
        id: jobMatches.id,
        jobId: jobMatches.jobId,
        candidateId: jobMatches.candidateId,
        matchScore: jobMatches.matchScore,
        status: jobMatches.status,
      })
      .from(jobMatches)
      .orderBy(jobMatches.matchScore)
      .limit(fetchLimit);

    // Sort DESC in-memory (SQLite desc not imported, avoid extra import)
    matchRows.sort((a, b) => b.matchScore - a.matchScore);

    const hasMore = matchRows.length > limit;
    const limitedMatches = matchRows.slice(0, limit);

    // Collect unique job and candidate IDs from matches
    const matchedJobIds = new Set(limitedMatches.map((m) => m.jobId).filter(Boolean) as string[]);
    const matchedCandidateIds = new Set(
      limitedMatches.map((m) => m.candidateId).filter(Boolean) as string[],
    );

    // Fetch jobs connected via matches (not deleted)
    const jobRows =
      matchedJobIds.size > 0
        ? await db
            .select({
              id: jobs.id,
              title: jobs.title,
              company: jobs.company,
              location: jobs.location,
              platform: jobs.platform,
              status: jobs.status,
            })
            .from(jobs)
            .where(isNull(jobs.deletedAt))
        : [];

    // Filter to only jobs that appear in the matches
    const connectedJobRows = jobRows.filter((j) => matchedJobIds.has(j.id));

    // Fetch candidates connected via matches (not deleted)
    const candidateRows =
      matchedCandidateIds.size > 0
        ? await db
            .select({
              id: candidates.id,
              name: candidates.name,
              role: candidates.role,
              location: candidates.location,
            })
            .from(candidates)
            .where(isNull(candidates.deletedAt))
        : [];

    // Filter to only candidates that appear in the matches
    const connectedCandidateRows = candidateRows.filter((c) => matchedCandidateIds.has(c.id));

    // Collect valid entity IDs after deletedAt filter
    const validJobIds = new Set(connectedJobRows.map((j) => j.id));
    const validCandidateIds = new Set(connectedCandidateRows.map((c) => c.id));

    // Get job skills for connected jobs
    const allJobSkillRows =
      validJobIds.size > 0
        ? await db
            .select({
              id: jobSkills.id,
              jobId: jobSkills.jobId,
              escoUri: jobSkills.escoUri,
              confidence: jobSkills.confidence,
              required: jobSkills.required,
              critical: jobSkills.critical,
            })
            .from(jobSkills)
        : [];
    const filteredJobSkillRows = allJobSkillRows.filter((js) => validJobIds.has(js.jobId));

    const allCandidateSkillRows =
      validCandidateIds.size > 0
        ? await db
            .select({
              id: candidateSkills.id,
              candidateId: candidateSkills.candidateId,
              escoUri: candidateSkills.escoUri,
              confidence: candidateSkills.confidence,
            })
            .from(candidateSkills)
        : [];
    const filteredCandidateSkillRows = allCandidateSkillRows.filter((cs) =>
      validCandidateIds.has(cs.candidateId),
    );

    // Collect all skill URIs referenced
    const referencedSkillUris = new Set([
      ...filteredJobSkillRows.map((js) => js.escoUri),
      ...filteredCandidateSkillRows.map((cs) => cs.escoUri),
    ]);

    // Fetch top-level ESCO skills (broaderUri IS NULL)
    const allSkillRows =
      referencedSkillUris.size > 0
        ? await db
            .select({
              uri: escoSkills.uri,
              preferredLabelEn: escoSkills.preferredLabelEn,
              preferredLabelNl: escoSkills.preferredLabelNl,
              escoVersion: escoSkills.escoVersion,
              skillType: escoSkills.skillType,
              broaderUri: escoSkills.broaderUri,
            })
            .from(escoSkills)
            .where(isNull(escoSkills.broaderUri))
        : [];
    const filteredSkillRows = allSkillRows.filter((s) => referencedSkillUris.has(s.uri));

    // Build nodes
    const jobNodes = connectedJobRows.map(buildJobNode);
    const candidateNodes = connectedCandidateRows.map(buildCandidateNode);
    const skillNodes = filteredSkillRows.map(buildSkillNode);

    let allNodes = [...jobNodes, ...candidateNodes, ...skillNodes];

    // Build edges
    const matchEdges = buildEdgesFromMatches(
      limitedMatches.filter(
        (m) =>
          m.jobId &&
          validJobIds.has(m.jobId) &&
          m.candidateId &&
          validCandidateIds.has(m.candidateId),
      ),
    );

    const skillEdges = buildEdgesFromSkills({
      jobSkills: filteredJobSkillRows,
      candidateSkills: filteredCandidateSkillRows,
    });

    let allEdges = [...matchEdges, ...skillEdges];

    // Apply type filter if provided
    if (types.length > 0) {
      allNodes = filterNodesByType(allNodes, types);
      const nodeIds = new Set(allNodes.map((n) => n.id));
      allEdges = filterEdgesByNodes(allEdges, nodeIds);
    }

    const response: GraphResponse = {
      nodes: allNodes,
      edges: allEdges,
      hasMore,
    };

    return Response.json(response);
  },
  {
    logPrefix: "GET /api/visualisatie/graph",
  },
);
