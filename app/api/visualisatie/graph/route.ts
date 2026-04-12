import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  candidateSkillsV2,
  candidates,
  jobMatches,
  jobSkillsV2,
  jobs,
  skills,
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

    // Fetch jobs and candidates connected via matches in parallel (with IN clause, not full table scan)
    const jobIdArray = [...matchedJobIds];
    const candidateIdArray = [...matchedCandidateIds];

    const [connectedJobRows, connectedCandidateRows] = await Promise.all([
      jobIdArray.length > 0
        ? db
            .select({
              id: jobs.id,
              title: jobs.title,
              company: jobs.company,
              location: jobs.location,
              platform: jobs.platform,
              status: jobs.status,
            })
            .from(jobs)
            .where(and(isNull(jobs.deletedAt), inArray(jobs.id, jobIdArray)))
        : Promise.resolve([]),
      candidateIdArray.length > 0
        ? db
            .select({
              id: candidates.id,
              name: candidates.name,
              role: candidates.role,
              location: candidates.location,
            })
            .from(candidates)
            .where(and(isNull(candidates.deletedAt), inArray(candidates.id, candidateIdArray)))
        : Promise.resolve([]),
    ]);

    // Collect valid entity IDs after deletedAt filter
    const validJobIds = new Set(connectedJobRows.map((j) => j.id));
    const validCandidateIds = new Set(connectedCandidateRows.map((c) => c.id));

    // Get job skills and candidate skills in parallel (with IN clause)
    const validJobIdArray = [...validJobIds];
    const validCandidateIdArray = [...validCandidateIds];

    const [filteredJobSkillRows, filteredCandidateSkillRows] = await Promise.all([
      validJobIdArray.length > 0
        ? db
            .select({
              id: jobSkillsV2.id,
              jobId: jobSkillsV2.jobId,
              escoUri: skills.slug,
              confidence: jobSkillsV2.confidence,
              required: sql<boolean>`${jobSkillsV2.importance} = ${"must"}`.as("required"),
              critical: sql<boolean>`${jobSkillsV2.importance} = ${"must"}`.as("critical"),
            })
            .from(jobSkillsV2)
            .innerJoin(skills, eq(jobSkillsV2.skillId, skills.id))
            .where(inArray(jobSkillsV2.jobId, validJobIdArray))
        : Promise.resolve([]),
      validCandidateIdArray.length > 0
        ? db
            .select({
              id: candidateSkillsV2.id,
              candidateId: candidateSkillsV2.candidateId,
              escoUri: skills.slug,
              confidence: candidateSkillsV2.confidence,
            })
            .from(candidateSkillsV2)
            .innerJoin(skills, eq(candidateSkillsV2.skillId, skills.id))
            .where(inArray(candidateSkillsV2.candidateId, validCandidateIdArray))
        : Promise.resolve([]),
    ]);

    // Collect all skill URIs referenced
    const referencedSkillUris = [
      ...new Set([
        ...filteredJobSkillRows.map((js) => js.escoUri),
        ...filteredCandidateSkillRows.map((cs) => cs.escoUri),
      ]),
    ];

    const filteredSkillRows =
      referencedSkillUris.length > 0
        ? await db
            .select({
              uri: skills.slug,
              preferredLabelEn: skills.name,
              preferredLabelNl: sql<string | null>`${skills.name}`.as("preferredLabelNl"),
              escoVersion: sql<string>`'linkedin-style'`.as("escoVersion"),
              skillType: sql<string | null>`null`.as("skillType"),
            })
            .from(skills)
            .where(inArray(skills.slug, referencedSkillUris))
        : [];

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

    return Response.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  },
  {
    logPrefix: "GET /api/visualisatie/graph",
  },
);
